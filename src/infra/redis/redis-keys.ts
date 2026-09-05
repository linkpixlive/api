// Fonte única das chaves Redis da aplicação.
// Cada padrão é documentado na tabela de chaves de docs/data.md (seção Redis):
// ao criar um padrão novo, documente lá e adicione o builder aqui.

export const RedisKeys = {
  // Flag de heartbeat do overlay ("true" enquanto o client responde)
  overlayOnline: (token: string) => `overlay:${token}`,
  // Fila de alertas pendentes: IDs de doações ou "test-<uuid>" (sem TTL — exceção deliberada)
  overlayQueue: (token: string) => `overlay:queue:${token}`,
  // Payload da doação em exibição, reservado atomicamente via SET NX
  overlayCurrent: (token: string) => `overlay:current:${token}`,
  otpVerification: (email: string) => `otp:verification:${email}`,
  totpSetup: (userId: string) => `totp:setup:${userId}`,
  authPending2fa: (nonce: string) => `auth:pending_2fa:${nonce}`,
};

// TTLs em segundos das chaves com expiração fixa (nomes espelham RedisKeys)
export const REDIS_TTL = {
  overlayOnline: 80,
  overlayCurrent: 300,
  otpVerification: 600,
  totpSetup: 600,
  authPending2fa: 300,
} as const;
