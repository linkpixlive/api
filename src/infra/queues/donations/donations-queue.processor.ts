import { Processor, WorkerHost } from '@nestjs/bullmq';
import { BadRequestException, Logger } from '@nestjs/common';
import { Donation, User } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/client';
import { Job } from 'bullmq';
import { TransactionStatus } from 'src/common/interfaces/transaction-status.type';
import { DonationsRepository } from 'src/infra/db/repositories/donations.repositories';
import { UsersRepository } from 'src/infra/db/repositories/users.repositories';
import { GatewayContract } from 'src/infra/gateway/contract/gateway.contract';
import { SpeechContract } from 'src/infra/speech/contract/speech.contract';
import { StorageContract } from 'src/infra/storage/contract/storage.contract';
import { DashboardGateway } from 'src/infra/websocket/dashboard.gateway';
import { DonationHistoryEntity } from 'src/modules/dashboard/entities/donation-history.entity';
import { VoiceEntity } from 'src/modules/voices/entities/voice.entity';
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
      if (!donation) return;

      await this.verifyPaymentStatus(donation.transactionId, donation.amount);

      const { user, overlay, overlaySettings } = await this.getUserWithConfig(
        donation.userId,
      );

      const ttsKey = await this.generateAndUploadAudio({
        donation,
        user,
        message: donation.message ?? '',
        speakNameAmount: overlaySettings?.speakNameAmount ?? true,
        defaultVoiceId: overlaySettings?.defaultNarrator ?? null,
      });

      const updatedDonation = await this.donationsRepository.processDonation({
        donationId: donation.id,
        voiceUri: ttsKey,
      });

      const historyEntity = DonationHistoryEntity.fromDonation(updatedDonation);
      this.dashboardGateway.emitDonationCreated(
        updatedDonation.userId,
        historyEntity,
      );

      if (overlay) {
        await this.overlayService.handleNewDonation(
          overlay,
          updatedDonation.id,
        );
      }
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
    defaultVoiceId,
  }: {
    donation: Donation;
    user: User;
    message: string;
    speakNameAmount: boolean;
    defaultVoiceId?: string | null;
  }): Promise<string | null> {
    const nameAmountPrefix = speakNameAmount
      ? `${donation.name} mandou R$${String(donation.amount)}: `
      : '';

    const fullMessage = `${nameAmountPrefix}${message}`.trim();

    if (!fullMessage) {
      this.logger.warn(
        `Doação ${donation.id} sem texto para TTS; creditando sem áudio`,
      );
      return null;
    }

    let voice: VoiceEntity | null = null;
    try {
      voice = donation.voiceId
        ? await this.voiceService.findById(donation.voiceId)
        : null;
    } catch (error) {
      this.logger.warn(
        `Voz ${String(donation.voiceId)} indisponível para doação ${donation.id}; usando voz padrão. ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    if (!voice && defaultVoiceId) {
      try {
        voice = await this.voiceService.findById(defaultVoiceId);
      } catch (error) {
        this.logger.warn(
          `Voz padrão ${defaultVoiceId} do overlay indisponível para doação ${donation.id}; usando voz padrão do provedor. ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    try {
      const ttsBuffer = await this.speech.generateTTS({
        message: fullMessage,
        voice: voice?.voiceId,
        provider: voice?.provider,
      });

      const isGoogle = (voice?.provider ?? '').toLowerCase() === 'google';
      const ttsKey = `tts/${user.username}-${donation.id}.${isGoogle ? 'mp3' : 'wav'}`;

      await this.storage.upload(
        ttsBuffer,
        ttsKey,
        isGoogle ? 'audio/mpeg' : 'audio/wav',
      );
      return ttsKey;
    } catch (error) {
      this.logger.warn(
        `TTS indisponível para doação ${donation.id} (provider ${voice?.provider ?? 'gradium'}); creditando sem áudio. ${error instanceof Error ? error.message : String(error)}`,
      );
      return null;
    }
  }

  private async getDonation(id: string) {
    const donation = await this.donationsRepository.findById(id);

    if (!donation) {
      throw new BadRequestException('Doação não encontrada');
    }

    if (donation.status !== 'pending' && donation.status !== 'expired') {
      this.logger.warn(
        `Doação ${id} já processada (status ${donation.status}); ignorando`,
      );
      return null;
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

    if (!donationSettings) {
      throw new BadRequestException('Configurações de doação não encontradas');
    }

    const overlay = widgets[0] ?? null;

    return {
      user: userWithConfig,
      overlay,
      overlaySettings: overlay
        ? (overlay.settings as unknown as OverlayWidgetSettingsDto)
        : null,
    };
  }
}
