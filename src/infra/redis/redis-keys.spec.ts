import { REDIS_TTL, RedisKeys } from './redis-keys';

describe('RedisKeys', () => {
  it('namespaces de overlay incluem o token do streamer', () => {
    expect(RedisKeys.overlayQueue('tok')).toBe('overlay:queue:tok');
    expect(RedisKeys.overlayCurrent('tok')).toBe('overlay:current:tok');
  });

  it('chaves de OTP são por email', () => {
    expect(RedisKeys.otpVerification('a@b.com')).toBe(
      'otp:verification:a@b.com',
    );
    expect(RedisKeys.otpVerificationAttempts('a@b.com')).toBe(
      'otp:verification_attempts:a@b.com',
    );
  });

  it('chave de e-mail confirmado (cadastro pendente) é por email', () => {
    expect(RedisKeys.registrationVerified('a@b.com')).toBe(
      'auth:registration_verified:a@b.com',
    );
  });

  it('chaves de 2FA pendentes são por nonce', () => {
    expect(RedisKeys.authPending2fa('n1')).toBe('auth:pending_2fa:n1');
    expect(RedisKeys.authPending2faAttempts('n1')).toBe(
      'auth:pending_2fa_attempts:n1',
    );
  });

  it('chaves de sessão são por sid e índice por userId', () => {
    expect(RedisKeys.session('sid1')).toBe('auth:session:sid1');
    expect(RedisKeys.userSessions('user1')).toBe('auth:user_sessions:user1');
  });

  it('chaves de troca de email e setup TOTP são por userId', () => {
    expect(RedisKeys.emailChangeVerification('user1')).toBe(
      'email:change:user1',
    );
    expect(RedisKeys.emailChangeAttempts('user1')).toBe(
      'email:change:attempts:user1',
    );
    expect(RedisKeys.totpSetup('user1')).toBe('totp:setup:user1');
    expect(RedisKeys.totpSetupAttempts('user1')).toBe(
      'totp:setup_attempts:user1',
    );
  });
});

describe('REDIS_TTL', () => {
  it('overlayCurrent cobre a duração máxima de um alerta em exibição', () => {
    expect(REDIS_TTL.overlayCurrent).toBe(300);
  });

  it('códigos de verificação expiram em 10 minutos', () => {
    expect(REDIS_TTL.otpVerification).toBe(600);
    expect(REDIS_TTL.emailChangeVerification).toBe(600);
    expect(REDIS_TTL.totpSetup).toBe(600);
  });

  it('ticket de e-mail confirmado expira em 15 minutos', () => {
    expect(REDIS_TTL.registrationVerified).toBe(900);
  });

  it('pending 2FA (nonce) expira em 5 minutos', () => {
    expect(REDIS_TTL.authPending2fa).toBe(300);
  });
});
