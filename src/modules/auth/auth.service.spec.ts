import {
  BadRequestException,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import { VerificationService } from './verification.service';
import { AuthService } from './auth.service';
import { RedisKeys } from 'src/infra/redis/redis-keys';

const ENCRYPTION_KEY = 'a'.repeat(64);

const AUTH_USER = {
  id: 'user-1',
  active: true,
  name: 'Streamer',
  username: 'streamer',
  email: 'user@email.com',
} as never;

describe('AuthService — cadastro email-first', () => {
  let usersRepository: Record<string, jest.Mock>;
  let jwtService: Record<string, jest.Mock>;
  let configService: Record<string, jest.Mock>;
  let profileService: Record<string, jest.Mock>;
  let redisStore: Map<string, unknown>;
  let redisService: Record<string, jest.Mock>;
  let sentEmails: Array<{
    to: string;
    subject: string;
    context: Record<string, unknown>;
  }>;
  let service: AuthService;

  const EMAIL = 'novo@email.com';

  const verificationService = () =>
    new VerificationService(redisService as never, emailService() as never);

  const emailService = () => ({
    sendEmail: jest.fn(
      (payload: {
        to: string;
        subject: string;
        context: Record<string, unknown>;
      }) => {
        sentEmails.push(payload);
        return Promise.resolve();
      },
    ),
  });

  const buildService = () =>
    new AuthService(
      usersRepository as never,
      {} as never, // changePassRepository não é usado neste fluxo
      jwtService as never,
      emailService() as never,
      redisService as never,
      configService as never,
      profileService as never,
      verificationService(),
    );

  beforeEach(() => {
    process.env.ENCRYPTION_KEY = ENCRYPTION_KEY;

    redisStore = new Map();
    redisService = {
      get: jest.fn((key: string) => Promise.resolve(redisStore.get(key))),
      setWithExpire: jest.fn((key: string, _ttl: number, value: unknown) => {
        redisStore.set(key, value);
        return Promise.resolve();
      }),
      remove: jest.fn((key: string) => {
        redisStore.delete(key);
        return Promise.resolve();
      }),
      incrementWithExpire: jest.fn((key: string) => {
        const current = Number(redisStore.get(key) ?? 0) + 1;
        redisStore.set(key, current);
        return Promise.resolve(current);
      }),
      addToList: jest.fn((key: string, value: string) => {
        const list = (redisStore.get(key) as string[]) ?? [];
        list.push(value);
        redisStore.set(key, list);
        return Promise.resolve();
      }),
      setExpire: jest.fn(() => Promise.resolve()),
      getList: jest.fn(() => Promise.resolve([])),
      removeFromList: jest.fn(() => Promise.resolve()),
    };
    sentEmails = [];

    usersRepository = {
      findByEmail: jest.fn().mockResolvedValue(null),
      findByUsername: jest.fn().mockResolvedValue(null),
      findByCpfHash: jest.fn().mockResolvedValue(null),
      create: jest.fn((data: Record<string, unknown>) =>
        Promise.resolve({
          id: 'user-new',
          ...data,
        }),
      ),
      update: jest.fn((_id: string, data: Record<string, unknown>) =>
        Promise.resolve({ id: 'user-legacy', totpEnabled: false, ...data }),
      ),
    };
    jwtService = { signAsync: jest.fn().mockResolvedValue('jwt-token') };
    configService = { get: jest.fn(() => 20) };
    profileService = {
      validateUsernameAvailability: jest.fn().mockResolvedValue(undefined),
    };

    service = buildService();
  });

  const sendOtp = async () => {
    await service.registerInit(EMAIL);
    expect(sentEmails).toHaveLength(1);
    return String(sentEmails[0].context.otp);
  };

  describe('registerInit', () => {
    it('e-mail novo envia código e não cria usuário', async () => {
      const message = await service.registerInit(EMAIL);

      expect(message).toBe('Verifique seu email e finalize o cadastro.');
      expect(sentEmails).toHaveLength(1);
      expect(sentEmails[0].to).toBe(EMAIL);
      expect(sentEmails[0].context.otp).toMatch(/^\d{6}$/);
      expect(usersRepository.create).not.toHaveBeenCalled();
    });

    it('e-mail de conta verificada retorna 409 sem enviar código', async () => {
      usersRepository.findByEmail.mockResolvedValue({
        email: EMAIL,
        verifiedEmail: true,
      });

      await expect(service.registerInit(EMAIL)).rejects.toThrow(
        ConflictException,
      );
      expect(sentEmails).toHaveLength(0);
    });

    it('e-mail de conta legado não verificada reenvia o código', async () => {
      usersRepository.findByEmail.mockResolvedValue({
        email: EMAIL,
        verifiedEmail: false,
      });

      await expect(service.registerInit(EMAIL)).resolves.toBeDefined();
      expect(sentEmails).toHaveLength(1);
    });
  });

  describe('verifyOtp', () => {
    it('e-mail confirmado sem conta emite ticket e pede conclusão do cadastro', async () => {
      const otp = await sendOtp();

      const result = await service.verifyOtp({ otp, email: EMAIL });

      expect(result).toEqual({ requiresRegistrationCompletion: true });
      expect(redisStore.has(RedisKeys.registrationVerified(EMAIL))).toBe(true);
      expect(redisStore.has(RedisKeys.otpVerification(EMAIL))).toBe(false);
      expect(usersRepository.update).not.toHaveBeenCalled();
    });

    it('conta legado não verificada é marcada como verificada e recebe JWT', async () => {
      const otp = await sendOtp();
      usersRepository.findByEmail.mockResolvedValue({
        id: 'user-legacy',
        email: EMAIL,
        verifiedEmail: false,
        totpEnabled: false,
      });

      const result = await service.verifyOtp({ otp, email: EMAIL });

      expect(result).toBe('jwt-token');
      expect(usersRepository.update).toHaveBeenCalledWith('user-legacy', {
        verifiedEmail: true,
      });
      expect(redisStore.has(RedisKeys.registrationVerified(EMAIL))).toBe(false);
    });

    it('ticket não é emitido com OTP errado', async () => {
      await sendOtp();

      await expect(
        service.verifyOtp({ otp: '000000', email: EMAIL }),
      ).rejects.toThrow(BadRequestException);
      expect(redisStore.has(RedisKeys.registrationVerified(EMAIL))).toBe(false);
    });
  });

  describe('register', () => {
    const dto = {
      name: 'Novo Usuário',
      username: 'novousuario',
      email: EMAIL,
      password: 'SenhaForte1',
      cpf: '11144477735',
    };

    const completeEmailStep = async () => {
      const otp = await sendOtp();
      await service.verifyOtp({ otp, email: EMAIL });
    };

    it('sem ticket de e-mail confirmado rejeita sem criar usuário', async () => {
      await expect(service.register(dto)).rejects.toThrow(
        new BadRequestException('Confirme seu e-mail antes de continuar.'),
      );
      expect(usersRepository.create).not.toHaveBeenCalled();
    });

    it('fluxo completo: cria usuário verificado, consome ticket e retorna JWT', async () => {
      await completeEmailStep();

      const token = await service.register(dto);

      expect(token).toBe('jwt-token');
      expect(usersRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          name: dto.name,
          username: dto.username,
          email: EMAIL,
          verifiedEmail: true,
        }),
      );
      expect(redisStore.has(RedisKeys.registrationVerified(EMAIL))).toBe(false);
      expect(jwtService.signAsync).toHaveBeenCalledWith(
        expect.objectContaining({ sub: 'user-new' }),
      );
    });

    it('username em uso rejeita e preserva o ticket', async () => {
      await completeEmailStep();
      usersRepository.findByUsername.mockResolvedValue({
        email: 'outro@email.com',
      });

      await expect(service.register(dto)).rejects.toThrow(ConflictException);
      expect(usersRepository.create).not.toHaveBeenCalled();
      expect(redisStore.has(RedisKeys.registrationVerified(EMAIL))).toBe(true);
    });

    it('cpf em uso rejeita', async () => {
      await completeEmailStep();
      usersRepository.findByCpfHash.mockResolvedValue({
        email: 'outro@email.com',
      });

      await expect(service.register(dto)).rejects.toThrow(ConflictException);
      expect(usersRepository.create).not.toHaveBeenCalled();
    });

    it('corrida: conta criada após a confirmação do e-mail rejeita', async () => {
      await completeEmailStep();
      usersRepository.findByEmail.mockResolvedValue({
        email: EMAIL,
        verifiedEmail: true,
      });

      await expect(service.register(dto)).rejects.toThrow(ConflictException);
      expect(usersRepository.create).not.toHaveBeenCalled();
    });

    it('username pertencente ao próprio e-mail não conflita', async () => {
      await completeEmailStep();
      usersRepository.findByUsername.mockResolvedValue({
        email: EMAIL,
        username: dto.username,
      });

      await expect(service.register(dto)).resolves.toBe('jwt-token');
    });
  });
});

describe('AuthService — cache local de sessão', () => {
  const SID = 'sid-1';
  const USER_ID = 'user-1';

  let usersRepo: Record<string, jest.Mock>;
  let redisService: Record<string, jest.Mock>;
  let service: AuthService;
  let now: number;

  const buildService = () =>
    new AuthService(
      usersRepo as never,
      {} as never,
      {
        signAsync: jest.fn(),
        verifyAsync: jest.fn().mockResolvedValue({ sub: USER_ID, sid: SID }),
      } as never,
      {} as never,
      redisService as never,
      {} as never,
      {} as never,
      {} as never,
    );

  beforeEach(() => {
    now = 1_000_000;
    jest.spyOn(Date, 'now').mockImplementation(() => now);

    usersRepo = { findByIdForAuth: jest.fn().mockResolvedValue(AUTH_USER) };

    redisService = {
      // sessão válida no Redis: auth:session:<sid> = userId
      get: jest.fn((key: string) =>
        Promise.resolve(key === RedisKeys.session(SID) ? USER_ID : null),
      ),
      remove: jest.fn().mockResolvedValue(undefined),
      removeFromList: jest.fn().mockResolvedValue(undefined),
      getList: jest.fn().mockResolvedValue([SID, 'sid-2', 'sid-3']),
    };

    service = buildService();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const validate = () => service.validateSessionToken(`valid-token:${SID}`);

  it('primeiro request consulta Redis+DB, segundo sai do cache', async () => {
    const first = await validate();
    const second = await validate();

    expect(first.user).toBe(AUTH_USER);
    expect(second.user).toBe(AUTH_USER);
    expect(redisService.get).toHaveBeenCalledTimes(1);
    expect(usersRepo.findByIdForAuth).toHaveBeenCalledTimes(1);
  });

  it('jwt exige sub e sid', async () => {
    const broken = new AuthService(
      usersRepo as never,
      {} as never,
      {
        signAsync: jest.fn(),
        verifyAsync: jest.fn().mockResolvedValue({}),
      } as never,
      {} as never,
      redisService as never,
      {} as never,
      {} as never,
      {} as never,
    );

    await expect(
      broken.validateSessionToken('token-sem-payload'),
    ).rejects.toThrow(UnauthorizedException);
    expect(redisService.get).not.toHaveBeenCalled();
  });

  it('sessão revogada no Redis nunca repopula o cache', async () => {
    redisService.get = jest.fn(() => Promise.resolve(null));
    await expect(validate()).rejects.toThrow(UnauthorizedException);

    redisService.get = jest.fn((key: string) =>
      Promise.resolve(key === RedisKeys.session(SID) ? USER_ID : null),
    );
    await validate();
    expect(redisService.get).toHaveBeenCalledTimes(1);
    expect(usersRepo.findByIdForAuth).toHaveBeenCalledTimes(1);
  });

  it('entrada do cache expira após 30s', async () => {
    await validate();

    now += 29_999;
    await validate();
    expect(redisService.get).toHaveBeenCalledTimes(1);
    expect(usersRepo.findByIdForAuth).toHaveBeenCalledTimes(1);

    now += 1;
    await validate();
    expect(redisService.get).toHaveBeenCalledTimes(2);
    expect(usersRepo.findByIdForAuth).toHaveBeenCalledTimes(2);
  });

  it('logout invalida o cache na hora', async () => {
    await validate();
    await service.logout(SID, USER_ID);
    redisService.get = jest.fn((key: string) =>
      Promise.resolve(key === RedisKeys.session(SID) ? USER_ID : null),
    );
    await validate();
    expect(redisService.get).toHaveBeenCalledTimes(1);
  });

  it('killAllSessions (logout-all / troca de senha) invalida o cache da sessão morta', async () => {
    await validate();

    await service.killAllSessions(USER_ID);

    redisService.get = jest.fn((key: string) =>
      Promise.resolve(key === RedisKeys.session(SID) ? USER_ID : null),
    );
    await validate();
    expect(redisService.get).toHaveBeenCalledTimes(1);
  });
});
