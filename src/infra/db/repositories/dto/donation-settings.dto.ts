export interface UpdateDonationSettingsParams {
  maxLength?: number;
  minAudioAmount?: number;
  minTextAmount?: number;
  aiModeration?: boolean;
  filterProfanity?: boolean;
  filterSpam?: boolean;
  filterHateSpeech?: boolean;
  customRules?: string;
}
