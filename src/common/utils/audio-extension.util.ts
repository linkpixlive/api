export type AudioExtension = 'mp3' | 'wav';

export function getAudioExtension(
  provider: string | null | undefined,
): AudioExtension {
  return (provider ?? '').toLowerCase() === 'google' ? 'mp3' : 'wav';
}

export function getAudioMimeType(provider: string | null | undefined): string {
  return getAudioExtension(provider) === 'mp3' ? 'audio/mpeg' : 'audio/wav';
}
