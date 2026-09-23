import {
  BadRequestException,
  GoneException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import {
  DonationSettings,
  DonationStatus,
  PaymentMethod,
} from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/client';
import type { Readable } from 'node:stream';
import { PaginatedResponseDto } from 'src/common/dto/paginated-response.dto';
import { TransactionStatus } from 'src/common/interfaces/transaction-status.type';
import { findBlockedCustomWord } from 'src/common/utils/custom-rules.util';
import { isOlderThanRetention } from 'src/common/utils/history-retention.util';
import { sanitizeSpamText } from 'src/common/utils/spam-sanitizer.util';
import { getStorageUrl } from 'src/common/utils/storageUrl.util';
import { AiContract } from 'src/infra/ai/contract/ai.contract';
import { DonationsRepository } from 'src/infra/db/repositories/donations.repositories';
import { GetDonationHistoryParams } from 'src/infra/db/repositories/dto/donations.dto';
import { UsersRepository } from 'src/infra/db/repositories/users.repositories';
import { VoicesRepository } from 'src/infra/db/repositories/voices.repositories';
import { GatewayContract } from 'src/infra/gateway/contract/gateway.contract';
import { DonationsQueueService } from 'src/infra/queues/donations/donations-queue.service';
import { RedisKeys } from 'src/infra/redis/redis-keys';
import { RedisService } from 'src/infra/redis/redis.service';
import { StorageContract } from 'src/infra/storage/contract/storage.contract';
import type { StoredObject } from 'src/infra/storage/contract/storage.contract';
import { DonationDto } from './dto/donation.dto';
import { GetHistoryQueryDto } from './dto/get-history-query.dto';
import { DonationHistoryEntity } from './entities/donation-history.entity';
import { DonationStatusEntity } from './entities/donation-status.entity';
import { DonationEntity } from './entities/donation.entity';
import { PublicUserEntity } from './entities/public-user.entity';
import * as xss from 'xss';

const EXPIRY_MARGIN_MS = 5 * 60 * 1000;
const HARD_EXPIRY_MS = 48 * 60 * 60 * 1000;
const OVERDUE_BATCH_LIMIT = 50;
const BLOCKED_MESSAGE =
  'Mensagem não permitida pelas regras do streamer. Edite e tente novamente.';
const LOG_EXCERPT_LENGTH = 80;

export interface DonationAudioDownload {
  stream: Readable;
  contentType: string;
  contentLength?: number;
  filename: string;
}

@Injectable()
export class DonationsService {
  private readonly logger = new Logger(DonationsService.name);

  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly donationsRepository: DonationsRepository,
    private readonly gateway: GatewayContract,
    private readonly donationsQueue: DonationsQueueService,
    private readonly redisService: RedisService,
    private readonly voicesRepository: VoicesRepository,
    private readonly ai: AiContract,
    private readonly storage: StorageContract,
  ) {}

  async getUser(username: string) {
    const user = await this.usersRepository.findByUsernameWithConfig(username);
    const overlay = user?.widgets[0];
    const settings = user?.donationSettings;

    if (!user || !settings) {
      throw new NotFoundException('Usuário ou configurações não encontrados');
    }

    const overlayStatus = overlay
      ? await this.redisService.get(RedisKeys.overlayOnline(overlay.token))
      : null;

    const data = {
      name: user.name,
      username: user.username,
      verified: user.verified,
      profileImageUrl: getStorageUrl(user.profileImageUrl),
      overlayActive: !!overlayStatus,
      minAudioAmount: Number(settings.minAudioAmount),
      minTextAmount: Number(settings.minTextAmount),
      maxLength: Math.min(settings.maxLength, 250),
    };

    return new PublicUserEntity(data);
  }

  async donation(
    donationDto: DonationDto,
    ip: string,
  ): Promise<DonationEntity> {
    const {
      name: providedName,
      message,
      amount,
      voiceId,
      username,
    } = donationDto;
    const name = providedName?.trim() ?? '';

    if (voiceId) {
      const voice = await this.voicesRepository.findById(voiceId);

      if (!voice || !voice.isActive) {
        throw new BadRequestException('Voz não encontrada ou indisponível');
      }
    }

    const user = await this.usersRepository.findByUsernameWithConfig(username);

    if (!user) {
      throw new NotFoundException('Usuário não encontrado');
    }

    const settings = user.donationSettings;

    if (!settings) {
      throw new BadRequestException('Configurações de doação não encontradas');
    }

    const maxMessageLength = Math.min(settings.maxLength, 250);

    if (message && message.length > maxMessageLength) {
      throw new BadRequestException(
        `Mensagem excede o tamanho máximo de ${maxMessageLength} caracteres`,
      );
    }

    const amountNum = new Decimal(amount);

    if (amountNum.lt(settings.minTextAmount)) {
      throw new BadRequestException(
        `Valor mínimo de doação é R$${Number(settings.minTextAmount)}`,
      );
    }

    const moderated = await this.applyModeration(
      user.username,
      settings,
      name,
      message,
    );

    const transaction = await this.gateway.generatePix({
      amount,
    });

    if (!transaction) {
      throw new BadRequestException(
        'Não foi possível criar a doação, tente novamente.',
      );
    }

    const donation = await this.donationsRepository.create({
      name: moderated.name,
      message: moderated.message,
      amount,
      voiceId,
      userId: user.id,
      pix: transaction.pix,
      status: DonationStatus.pending,
      transactionId: transaction.transactionId,
      paymentMethod: PaymentMethod.pix,
      expiredAt: transaction.expiredAt,
      messageType: 'text',
      ip,
    });

    return new DonationEntity(donation);
  }

  async getDonation(id: string): Promise<DonationStatusEntity> {
    const donation = await this.donationsRepository.findByIdWithUser(id);

    if (!donation) {
      throw new NotFoundException('Doação não encontrada');
    }

    const message = donation.message;

    return new DonationStatusEntity({
      id: donation.id,
      status: donation.status,
      expiredAt: donation.expiredAt,
      streamerUsername: donation.user.username,
      streamerName: donation.user.name,
      message: message ? xss.filterXSS(message) : null,
      amount: Number(donation.amount),
      donorName: donation.name || 'Anônimo',
      voiceName: donation.voice?.name ?? null,
      createdAt: donation.createdAt,
    });
  }

  async getHistory(
    userId: string,
    query: GetHistoryQueryDto,
  ): Promise<PaginatedResponseDto<DonationHistoryEntity>> {
    const params: GetDonationHistoryParams = {
      userId,
      page: query.page ?? 1,
      limit: query.limit ?? 20,
      status: query.status,
      days:
        query.days === 'today'
          ? 'today'
          : query.days
            ? (Number(query.days) as 7 | 15 | 30)
            : undefined,
      search: query.search,
      searchBy: query.searchBy,
    };

    const { donations, total } =
      await this.donationsRepository.getDonationHistory(params);

    const history = donations.map((d) => DonationHistoryEntity.fromDonation(d));

    return new PaginatedResponseDto(history, {
      total,
      page: params.page,
      limit: params.limit,
    });
  }

  async getDonationAudio(
    userId: string,
    donationId: string,
  ): Promise<DonationAudioDownload> {
    const donation = await this.donationsRepository.findDonationAudioMeta(
      donationId,
      userId,
    );

    if (!donation) {
      throw new NotFoundException('Áudio não disponível para esta doação.');
    }

    // Retenção de exibição: o áudio expira em 30 dias junto ao lifecycle do R2.
    if (isOlderThanRetention(donation.createdAt)) {
      throw new GoneException(
        'Áudio expirado. Doações ficam disponíveis por 30 dias.',
      );
    }

    if (!donation?.voiceUrl) {
      throw new NotFoundException('Áudio não disponível para esta doação.');
    }

    let stored: StoredObject;
    try {
      stored = await this.storage.getObject(donation.voiceUrl);
    } catch {
      throw new NotFoundException('Áudio não disponível para esta doação.');
    }

    const ext = donation.voiceUrl.toLowerCase().endsWith('.mp3')
      ? 'mp3'
      : 'wav';
    const slug =
      donation.name
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '') || 'doacao';
    const stamp = donation.approvedAt
      ? new Date(donation.approvedAt).getTime()
      : donationId;

    return {
      stream: stored.body,
      contentType:
        stored.contentType ?? (ext === 'mp3' ? 'audio/mpeg' : 'audio/wav'),
      contentLength: stored.contentLength,
      filename: `doacao-${slug}-${stamp}.${ext}`,
    };
  }

  async webhookPix(transactionId: string): Promise<void> {
    const donation =
      await this.donationsRepository.findByTransactionId(transactionId);

    if (!donation) {
      throw new NotFoundException(
        `Doação não encontrada para o txid: ${transactionId}`,
      );
    }

    if (donation.status === DonationStatus.pending) {
      await this.donationsQueue.sendDonation({ donation_id: donation.id });
    }
  }

  @Cron(CronExpression.EVERY_5_MINUTES)
  async expireOverdueDonations(): Promise<void> {
    const now = Date.now();

    const hardExpired = await this.donationsRepository.expireOverdue(
      new Date(now - HARD_EXPIRY_MS),
    );

    const overdue = await this.donationsRepository.findOverdue(
      new Date(now - EXPIRY_MARGIN_MS),
      OVERDUE_BATCH_LIMIT,
    );

    let expired = 0;
    let requeued = 0;

    for (const donation of overdue) {
      try {
        const result = await this.gateway.getPixStatus(donation.transactionId);

        if (result.status === TransactionStatus.PAID) {
          await this.donationsQueue.sendDonation({ donation_id: donation.id });
          requeued++;
          continue;
        }

        await this.donationsRepository.expireById(donation.id);
        expired++;
      } catch (error) {
        this.logger.warn(
          `Expiração da doação ${donation.id} adiada: falha ao consultar status na Efí`,
          error instanceof Error ? error.message : String(error),
        );
      }
    }

    if (hardExpired || expired || requeued) {
      this.logger.log(
        `Expiração de doações: ${hardExpired} expiradas direto (+48h), ${expired} expiradas, ${requeued} pagas reenfileiradas`,
      );
    }
  }

  private async applyModeration(
    username: string,
    settings: DonationSettings,
    name: string,
    message: string,
  ): Promise<{ name: string; message: string }> {
    if (!settings.aiModeration) {
      return { name, message };
    }

    let finalName = name;
    let finalMessage = message;

    if (settings.filterSpam) {
      finalName = sanitizeSpamText(finalName);
      finalMessage = sanitizeSpamText(finalMessage);
    }

    const customWord = findBlockedCustomWord(
      finalName,
      finalMessage,
      settings.customRules,
    );

    if (customWord) {
      this.logger.warn(
        `Doação bloqueada por regra custom do streamer ${username}: palavra "${customWord}"`,
      );
      throw new BadRequestException(BLOCKED_MESSAGE);
    }

    const hasAiFilter =
      settings.filterProfanity ||
      settings.filterHateSpeech ||
      settings.customRules.trim().length > 0;

    if (hasAiFilter && (finalName.trim() || finalMessage.trim())) {
      const verdict = await this.ai.moderate({
        name: finalName,
        message: finalMessage,
        rules: {
          filterProfanity: settings.filterProfanity,
          filterHateSpeech: settings.filterHateSpeech,
          customRules: settings.customRules,
        },
      });

      if (verdict.blocked) {
        this.logger.warn(
          `Doação bloqueada pela moderação IA do streamer ${username}: categorias [${verdict.categories.join(', ')}], texto "${this.excerpt(finalName, finalMessage)}"`,
        );
        throw new BadRequestException(BLOCKED_MESSAGE);
      }

      this.logger.debug(
        `Doação permitida pela moderação IA do streamer ${username}: texto "${this.excerpt(finalName, finalMessage)}"`,
      );
    }

    return { name: finalName, message: finalMessage };
  }

  private excerpt(name: string, message: string | null): string {
    const text = [name, message].filter(Boolean).join(' | ');

    return text.length > LOG_EXCERPT_LENGTH
      ? `${text.slice(0, LOG_EXCERPT_LENGTH)}...`
      : text;
  }
}
