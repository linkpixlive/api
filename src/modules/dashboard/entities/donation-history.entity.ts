import { ApiProperty } from '@nestjs/swagger';
import { DonationStatus, MessageType } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/client';

export class DonationHistoryEntity {
  @ApiProperty({ example: 'uuid-123', description: 'ID da transação' })
  id: string;

  @ApiProperty({ example: 'John Doe', description: 'Nome do doador' })
  name: string;

  @ApiProperty({ example: 10, description: 'Valor da doação' })
  amount: Decimal;

  @ApiProperty({
    example: 'Keep up the good work!',
    description: 'Mensagem da doação',
    nullable: true,
  })
  message: string | null;

  @ApiProperty({
    example: 'tts/audio.mp3',
    description: 'Chave do áudio',
    nullable: true,
  })
  audioUrl: string | null;

  @ApiProperty({
    example: 'text',
    description: 'Tipo de mensagem (texto, vídeo, etc.)',
    enum: MessageType,
    nullable: true,
  })
  messageType: MessageType | null;

  @ApiProperty({ enum: DonationStatus, example: 'paid' })
  status: DonationStatus;

  @ApiProperty({ example: '2026-04-16T12:00:00.000Z' })
  createdAt: Date;

  @ApiProperty({ example: '2026-04-16T12:05:00.000Z', nullable: true })
  approvedAt: Date | null;

  constructor(partial: Partial<DonationHistoryEntity>) {
    Object.assign(this, partial);
  }

  // static toResponse(donation: Donation): DonationHistoryEntity {
  //   return new DonationHistoryEntity({
  //     id: donation.id,
  //     name: donation.name,
  //     amount: Number(donation.amount),
  //     message: donation.message,
  //     audioUrl: donation.voice_url,
  //     messageType: donation.message_type,
  //     status: donation.status,
  //     createdAt: donation.created_at,
  //     approvedAt: donation.approved_at,
  //   });
  // }
}
