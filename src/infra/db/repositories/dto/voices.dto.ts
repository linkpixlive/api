export interface CreateVoiceParams {
  name: string;
  provider: string;
  voiceId: string;
  isActive?: boolean;
  photoUri?: string;
  sampleUrl?: string;
}

export interface UpdateVoiceParams {
  name?: string;
  provider?: string;
  voiceId?: string;
  isActive?: boolean;
  photoUri?: string;
  sampleUrl?: string;
}
