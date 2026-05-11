import { Processor, WorkerHost } from '@nestjs/bullmq';
import { BadRequestException, Logger } from '@nestjs/common';
import { Donation, DonationSettings, User } from '@prisma/client';
import { Job } from 'bullmq';
import { TransactionStatus } from 'src/common/interfaces/transaction-status.type';
import { AiContract } from 'src/infra/ai/contract/ai.contract';
import { DonationsRepository } from 'src/infra/db/repositories/donations.repositories';
import { UsersRepository } from 'src/infra/db/repositories/users.repositories';
import { GatewayContract } from 'src/infra/gateway/contract/gateway.contract';
import { SpeechContract } from 'src/infra/speech/contract/speech.contract';
import { StorageContract } from 'src/infra/storage/contract/storage.contract';
import { OverlayWidgetSettingsDto } from 'src/modules/widgets/dto/overlay-settings.dto';
import { OverlayService } from 'src/modules/widgets/overlay.service';

@Processor('donations-queue')
export class DonationsQueueProcessor extends WorkerHost {
  private readonly logger = new Logger(DonationsQueueProcessor.name);

  constructor(
    private readonly donationsRepository: DonationsRepository,
    private readonly gateway: GatewayContract,
    private readonly usersRepository: UsersRepository,
    private readonly aiService: AiContract,
    private readonly storage: StorageContract,
    private readonly speech: SpeechContract,
    private readonly overlayService: OverlayService,
  ) {
    super();
  }

  async process(job: Job<{ donation_id: string }>): Promise<void> {
    const { donation_id } = job.data;

    try {
      const donation = await this.getDonation(donation_id);
      await this.verifyPaymentStatus(donation.transactionId);

      const { user, donationSettings, overlay, overlaySettings } =
        await this.getUserWithConfig(donation.userId);

      const cleanMessage = await this.getCleanMessage(
        donation.messageRaw,
        donationSettings,
      );

      const ttsKey = await this.generateAndUploadAudio({
        donation,
        user,
        message: cleanMessage,
        speakNameAmount: overlaySettings.speakNameAmount,
      });

      const updatedDonation = await this.donationsRepository.processDonation({
        donationId: donation.id,
        message: cleanMessage,
        voiceUri: ttsKey,
      });

      await this.overlayService.handleNewDonation(overlay, updatedDonation.id);
    } catch (error) {
      this.logger.error(`Failed to process donation ${donation_id}:`, error);
      throw error;
    }
  }

  private async verifyPaymentStatus(transactionId: string) {
    const status = await this.gateway.getPixStatus(transactionId);

    if (status !== TransactionStatus.PAID) {
      throw new BadRequestException('Transaction not paid');
    }
  }

  private async generateAndUploadAudio({
    donation,
    user,
    message,
    speakNameAmount,
  }: {
    donation: Donation;
    user: User;
    message: string;
    speakNameAmount: boolean;
  }) {
    const nameAmountPrefix = speakNameAmount
      ? `${donation.name} mandou R$${String(donation.amount)}: `
      : '';

    const fullMessage = `${nameAmountPrefix}${message}`.trim();

    const tts = await this.speech.generateTTS({ message: fullMessage });
    const ttsBuffer = Buffer.from(tts, 'base64');
    const ttsKey = `tts/${user.username}-${donation.id}.mp3`;

    await this.storage.uploadAudio(ttsBuffer, ttsKey);
    return ttsKey;
  }

  private async getDonation(id: string) {
    const donation = await this.donationsRepository.findById(id);

    if (!donation || donation.status === 'paid') {
      throw new BadRequestException('Donation not found or already processed');
    }

    return donation;
  }

  private async getUserWithConfig(userId: string) {
    const userWithConfig =
      await this.usersRepository.findByIdWithConfig(userId);

    if (!userWithConfig) {
      throw new BadRequestException('User not found');
    }

    const { donationSettings, widgets } = userWithConfig;
    const overlay = widgets[0];

    if (!donationSettings) {
      throw new BadRequestException('Donation settings not found');
    }

    if (!overlay) {
      throw new BadRequestException('Active overlay not found');
    }

    return {
      user: userWithConfig,
      donationSettings,
      overlay,
      overlaySettings: overlay.settings as unknown as OverlayWidgetSettingsDto,
    };
  }

  private async getCleanMessage(
    rawMessage: string | null,
    settings: DonationSettings,
  ) {
    if (!rawMessage) return '';

    return await this.aiService.cleanMessage(rawMessage, {
      filterProfanity: settings.filterProfanity,
      filterSpam: settings.filterSpam,
      blockedWords: settings.blockedWords,
    });
  }
}
