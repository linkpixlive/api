import { Processor, WorkerHost } from '@nestjs/bullmq';
import { BadRequestException, Logger } from '@nestjs/common';
import { Donation, DonationSettings, User } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/client';
import { Job } from 'bullmq';
import { TransactionStatus } from 'src/common/interfaces/transaction-status.type';
import { AiContract } from 'src/infra/ai/contract/ai.contract';
import { DonationsRepository } from 'src/infra/db/repositories/donations.repositories';
import { UsersRepository } from 'src/infra/db/repositories/users.repositories';
import { GatewayContract } from 'src/infra/gateway/contract/gateway.contract';
import { SpeechContract } from 'src/infra/speech/contract/speech.contract';
import { StorageContract } from 'src/infra/storage/contract/storage.contract';
import { DashboardGateway } from 'src/infra/websocket/dashboard.gateway';
import { DonationHistoryEntity } from 'src/modules/dashboard/entities/donation-history.entity';
import { VoicesService } from 'src/modules/voices/voices.service';
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
    private readonly voiceService: VoicesService,
    private readonly dashboardGateway: DashboardGateway,
  ) {
    super();
  }

  async process(job: Job<{ donation_id: string }>): Promise<void> {
    const { donation_id } = job.data;

    try {
      const donation = await this.getDonation(donation_id);
      await this.verifyPaymentStatus(donation.transactionId, donation.amount);

      const { user, overlay, overlaySettings } = await this.getUserWithConfig(
        donation.userId,
      );

      // const cleanMessage = await this.getCleanMessage(
      //   donation.messageRaw,
      //   donationSettings,
      // );

      const ttsKey = await this.generateAndUploadAudio({
        donation,
        user,
        message: donation.messageRaw ?? '',
        speakNameAmount: overlaySettings.speakNameAmount,
      });

      const updatedDonation = await this.donationsRepository.processDonation({
        donationId: donation.id,
        message: donation.messageRaw ?? '',
        voiceUri: ttsKey,
      });

      const historyEntity = DonationHistoryEntity.fromDonation(updatedDonation);
      this.dashboardGateway.emitDonationCreated(
        updatedDonation.userId,
        historyEntity,
      );

      await this.overlayService.handleNewDonation(overlay, updatedDonation.id);
    } catch (error) {
      this.logger.error(`Falha ao processar doação ${donation_id}:`, error);
      throw error;
    }
  }

  private async verifyPaymentStatus(
    transactionId: string,
    expectedAmount: Decimal,
  ) {
    const result = await this.gateway.getPixStatus(transactionId);

    if (result.status !== TransactionStatus.PAID) {
      throw new BadRequestException('Transação não paga');
    }

    if (
      result.paidAmount !== undefined &&
      !new Decimal(result.paidAmount).equals(expectedAmount)
    ) {
      throw new BadRequestException(
        `Valor pago (R$${result.paidAmount}) difere do valor da doação (R$${String(expectedAmount)})`,
      );
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

    const voice = donation.voiceId
      ? await this.voiceService.findById(donation.voiceId)
      : null;

    const ttsBuffer = await this.speech.generateTTS({
      message: fullMessage,
      voice: voice?.voiceId,
    });
    const ttsKey = `tts/${user.username}-${donation.id}.wav`;

    await this.storage.uploadAudio(ttsBuffer, ttsKey);
    return ttsKey;
  }

  private async getDonation(id: string) {
    const donation = await this.donationsRepository.findById(id);

    if (!donation || donation.status === 'paid') {
      throw new BadRequestException('Doação não encontrada ou já processada');
    }

    return donation;
  }

  private async getUserWithConfig(userId: string) {
    const userWithConfig =
      await this.usersRepository.findByIdWithConfig(userId);

    if (!userWithConfig) {
      throw new BadRequestException('Usuário não encontrado');
    }

    const { donationSettings, widgets } = userWithConfig;
    const overlay = widgets[0];

    if (!donationSettings) {
      throw new BadRequestException('Configurações de doação não encontradas');
    }

    if (!overlay) {
      throw new BadRequestException('Overlay ativo não encontrado');
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
