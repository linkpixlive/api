import { Decimal } from '@prisma/client/runtime/client';

export interface UpdateDonationSettingsParams {
  maxLength?: number;
  minAudioAmount?: Decimal;
  minTextAmount?: Decimal;
  aiModeration?: boolean;
  filterProfanity?: boolean;
  filterSpam?: boolean;
  filterHateSpeech?: boolean;
  customRules?: string;
}
