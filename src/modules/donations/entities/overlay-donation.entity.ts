import { Donation } from '@prisma/client';

export class OverlayDonationEntity {
  id: string;
  name: string;
  amount: number;
  message: string | null;
  audioUrl: string | null;
  messageType: string | null;

  constructor(partial: Partial<OverlayDonationEntity>) {
    Object.assign(this, partial);
  }

  static toResponse(
    donation: Donation,
    audioUrl: string | null,
  ): OverlayDonationEntity {
    return new OverlayDonationEntity({
      id: donation.id,
      name: donation.name,
      amount: Number(donation.amount),
      message: donation.message,
      audioUrl,
      messageType: donation.message_type,
    });
  }
}
