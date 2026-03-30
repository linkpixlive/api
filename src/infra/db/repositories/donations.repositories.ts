import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import {
  CreateDonationParams,
  UpdateDonationParams,
} from './dto/donations.dto';

@Injectable()
export class DonationsRepository {
  constructor(private prismaService: PrismaService) {}

  async create(data: CreateDonationParams) {
    return await this.prismaService.donation.create({
      data: {
        user_id: data.userId,
        name: data.name,
        amount: data.amount,
        transaction_id: data.transactionId,
        payment_method: data.paymentMethod,
        ip: data.ip,
        message_raw: data.messageRaw,
        voice_id: data.voiceId,
        pix: data.pix,
        status: data.status,
        expired_at: data.expiredAt,
        approved_at: data.approvedAt,
        message_type: data.messageType,
        message: data.message,
        voice_url: data.voiceUrl,
      },
    });
  }

  async findById(id: string) {
    return await this.prismaService.donation.findUnique({ where: { id } });
  }

  async findByTransactionId(transactionId: string) {
    return await this.prismaService.donation.findUnique({
      where: { transaction_id: transactionId },
    });
  }

  async update(id: string, data: UpdateDonationParams) {
    return await this.prismaService.donation.update({
      where: { id },
      data: {
        name: data.name,
        amount: data.amount,
        ip: data.ip,
        message_raw: data.messageRaw,
        voice_id: data.voiceId,
        pix: data.pix,
        status: data.status,
        expired_at: data.expiredAt,
        approved_at: data.approvedAt,
        payment_method: data.paymentMethod,
        transaction_id: data.transactionId,
        message_type: data.messageType,
        message: data.message,
        voice_url: data.voiceUrl,
      },
    });
  }
}
