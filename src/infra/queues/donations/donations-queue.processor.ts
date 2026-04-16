import { Processor, WorkerHost } from '@nestjs/bullmq';
import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Donation, User } from '@prisma/client';
import { Job } from 'bullmq';
import { TransactionStatus } from 'src/common/interfaces/transaction-status.type';
import { AiContract } from 'src/infra/ai/contract/ai.contract';
import { DonationsRepository } from 'src/infra/db/repositories/donations.repositories';
import { UsersRepository } from 'src/infra/db/repositories/users.repositories';
import { GatewayContract } from 'src/infra/gateway/contract/gateway.contract';
import { SpeechContract } from 'src/infra/speech/contract/speech.contract';
import { StorageContract } from 'src/infra/storage/contract/storage.contract';
import { OverlayGateway } from 'src/infra/websocket/overlay.gateway';
import { OverlayDonationEntity } from 'src/modules/donations/entities/overlay-donation.entity';

@Processor('donations-queue')
export class DonationsQueueProcessor extends WorkerHost {
  constructor(
    private readonly donationsRepository: DonationsRepository,
    private readonly gateway: GatewayContract,
    private readonly usersRepository: UsersRepository,
    private readonly aiService: AiContract,
    private readonly storage: StorageContract,
    private readonly speech: SpeechContract,
    private readonly overlay: OverlayGateway,
    private readonly configService: ConfigService,
  ) {
    super();
  }

  async process(job: Job): Promise<any> {
    try {
      const { data } = job as Job<{ donation_id: string }>;

      const donation = await this.validateAndGetDonation(data.donation_id);
      const user = await this.validateAndGetUser(donation.user_id);

      await this.verifyPaymentStatus(donation.transaction_id);

      const cleanMessage = donation.message_raw
        ? await this.aiService.cleanMessage(donation.message_raw)
        : '';

      const ttsKey = await this.processAudio({
        donation,
        user,
        message: cleanMessage,
      });

      const updatedDonation = await this.donationsRepository.processDonation({
        donationId: donation.id,
        message: cleanMessage,
        voiceUri: ttsKey,
      });

      const audioUrl = `${this.configService.get('BUCKET_URL')}/${ttsKey}`;

      this.overlay.emitNewDonation(
        user.overlay_key,
        OverlayDonationEntity.toResponse(updatedDonation, audioUrl),
      );
    } catch (error) {
      console.error(error);
      throw error;
    }
  }

  private async verifyPaymentStatus(transactionId: string) {
    const status = await this.gateway.getPixStatus(transactionId);

    if (status !== TransactionStatus.PAID) {
      throw new BadRequestException('Transaction not paid');
    }
  }

  private async processAudio({
    donation,
    user,
    message,
  }: {
    donation: Donation;
    user: User;
    message: string;
  }) {
    const fullMessage = `${donation.name} mandou R$${String(donation.amount)}: ${message}`;

    const tts = await this.speech.generateTTS({ message: fullMessage });
    const ttsBuffer = Buffer.from(tts, 'base64');
    const ttsKey = `tts/${user.username}-${donation.id}.mp3`;

    await this.storage.uploadAudio(ttsBuffer, ttsKey);
    return ttsKey;
  }

  private async validateAndGetDonation(id: string) {
    const donation = await this.donationsRepository.findById(id);

    if (!donation || donation.status === 'paid') {
      throw new BadRequestException('Donation not found or already processed');
    }

    return donation;
  }

  private async validateAndGetUser(id: string) {
    const user = await this.usersRepository.findById(id);

    if (!user) {
      throw new BadRequestException('User not found');
    }

    return user;
  }
}
