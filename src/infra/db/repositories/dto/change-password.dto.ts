export interface CreateChangePasswordParams {
  userId: string;
  token: string;
  expiresAt: Date;
}
