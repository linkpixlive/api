import { DonationSettings } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/client';

export class DonationSettingsEntity implements DonationSettings {
  id: string;
  userId: string;
  maxLength: number;
  minAudioAmount: Decimal;
  minTextAmount: Decimal;
  filterProfanity: boolean;
  filterSpam: boolean;
  blockedWords: string[];
  updatedAt: Date;

  constructor(partial: Partial<DonationSettingsEntity>) {
    Object.assign(this, partial);
  }
}
