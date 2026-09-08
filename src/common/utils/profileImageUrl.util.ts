export function getProfileImageUrl(profileImageUri: string | null) {
  return profileImageUri
    ? `${process.env.BUCKET_URL}/${profileImageUri}`
    : null;
}
