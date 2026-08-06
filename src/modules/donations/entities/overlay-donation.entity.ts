import { Donation } from '@prisma/client';
import * as xss from 'xss';

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
      message: donation.message ? xss.filterXSS(donation.message) : null,
      audioUrl,
      messageType: donation.messageType as string,
    });
  }
}
