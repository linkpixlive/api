const ABSOLUTE_URL_REGEX = /^https?:\/\//i;

export function getStorageUrl(storageUri: string | null) {
  if (!storageUri) {
    return null;
  }

  return ABSOLUTE_URL_REGEX.test(storageUri)
    ? storageUri
    : `${process.env.BUCKET_URL}/${storageUri}`;
}
