import { ApiProperty } from '@nestjs/swagger';
import { Donation, DonationStatus, MessageType } from '@prisma/client';
import { getAudioUrl } from 'src/common/utils/audioUrl.util';

export class DonationHistoryEntity {
  @ApiProperty({ example: 'uuid-123', description: 'ID da transação' })
  id: string;

  @ApiProperty({ example: 'John Doe', description: 'Nome do doador' })
  name: string;

  @ApiProperty({ example: 10, description: 'Valor da doação' })
  amount: number;

  @ApiProperty({
    example: 'Keep up the good work!',
    description: 'Mensagem da doação',
    nullable: true,
  })
  message: string | null;

  @ApiProperty({
    example: 'text',
    description: 'Tipo de mensagem (texto, vídeo, etc.)',
    enum: MessageType,
    nullable: true,
  })
  messageType: MessageType | null;

  @ApiProperty({ enum: DonationStatus, example: 'paid' })
  status: DonationStatus;

  @ApiProperty({
    example: 'Keep up the good work!',
    description: 'Mensagem original antes da moderação',
    nullable: true,
  })
  messageRaw: string | null;

  @ApiProperty({
    example: 'https://cdn.tipply.live/tts/johndoe-uuid-123.wav',
    description: 'URL pública do áudio',
    nullable: true,
  })
  voiceUrl: string | null;

  @ApiProperty({ example: '2026-04-16T12:05:00.000Z', nullable: true })
  approvedAt: Date | null;

  constructor(partial: Partial<DonationHistoryEntity>) {
    Object.assign(this, partial);
  }

  static fromDonation(donation: Donation): DonationHistoryEntity {
    return new DonationHistoryEntity({
      id: donation.id,
      name: donation.name,
      amount: Number(donation.amount),
      message: donation.message,
      messageType: donation.messageType,
      status: donation.status,
      messageRaw: donation.messageRaw,
      voiceUrl: getAudioUrl(donation.voiceUrl),
      approvedAt: donation.approvedAt,
    });
  }
}
