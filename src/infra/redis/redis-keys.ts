export const RedisKeys = {
  overlayOnline: (token: string) => `overlay:${token}`,
  overlayQueue: (token: string) => `overlay:queue:${token}`,
  overlayCurrent: (token: string) => `overlay:current:${token}`,
  otpVerification: (email: string) => `otp:verification:${email}`,
  emailChangeVerification: (userId: string) => `email:change:${userId}`,
  emailChangeAttempts: (userId: string) => `email:change:attempts:${userId}`,
  totpSetup: (userId: string) => `totp:setup:${userId}`,
  authPending2fa: (nonce: string) => `auth:pending_2fa:${nonce}`,
  session: (sid: string) => `auth:session:${sid}`,
  userSessions: (userId: string) => `auth:user_sessions:${userId}`,
};

export const REDIS_TTL = {
  overlayOnline: 80,
  overlayCurrent: 300,
  otpVerification: 600,
  emailChangeVerification: 600,
  totpSetup: 600,
  authPending2fa: 300,
} as const;
