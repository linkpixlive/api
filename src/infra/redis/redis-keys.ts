export const RedisKeys = {
  overlayQueue: (token: string) => `overlay:queue:${token}`,
  overlayCurrent: (token: string) => `overlay:current:${token}`,
  otpVerification: (email: string) => `otp:verification:${email}`,
  otpVerificationAttempts: (email: string) =>
    `otp:verification_attempts:${email}`,
  registrationVerified: (email: string) =>
    `auth:registration_verified:${email}`,
  emailChangeVerification: (userId: string) => `email:change:${userId}`,
  emailChangeAttempts: (userId: string) => `email:change:attempts:${userId}`,
  totpSetup: (userId: string) => `totp:setup:${userId}`,
  totpSetupAttempts: (userId: string) => `totp:setup_attempts:${userId}`,
  authPending2fa: (nonce: string) => `auth:pending_2fa:${nonce}`,
  authPending2faAttempts: (nonce: string) =>
    `auth:pending_2fa_attempts:${nonce}`,
  session: (sid: string) => `auth:session:${sid}`,
  userSessions: (userId: string) => `auth:user_sessions:${userId}`,
};

export const REDIS_TTL = {
  overlayCurrent: 300,
  otpVerification: 600,
  emailChangeVerification: 600,
  registrationVerified: 900,
  totpSetup: 600,
  authPending2fa: 300,
} as const;
