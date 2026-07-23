export interface CreateUsernameBlacklistParams {
  username: string;
  originalOwnerId: string;
  expiresAt: Date | null;
}
