export function getAudioUrl(audioUri: string | null) {
  return audioUri ? `${process.env.BUCKET_URL}/${audioUri}` : null;
}
