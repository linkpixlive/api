export interface UpsertDonationSettingsParams {
  maxLength?: number;
  minAudioAmount?: number;
  minTextAmount?: number;
  filterProfanity?: boolean;
  filterSpam?: boolean;
  blockedWords?: string[];
}
