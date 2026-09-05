import { PrismaPg } from '@prisma/adapter-pg';
import {
  DonationStatus,
  MessageType,
  PaymentMethod,
  PixKeyType,
  Prisma,
  PrismaClient,
  TransactionType,
  UserRole,
  WidgetType,
  WithdrawalStatus,
} from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/client';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { SecurityService } from '../src/common/security/security.service';
import { maskPixKey } from '../src/common/utils/mask.util';

const SEED = {
  admin: {
    name: 'Admin',
    email: 'admin@linkpix.com',
    username: 'admin',
    roles: [UserRole.admin, UserRole.streamer],
    verified: true,
  },
  streamer: {
    name: 'Streamer Teste',
    email: 'streamer@linkpix.com',
    username: 'streamer',
    roles: [UserRole.streamer],
    verified: false,
  },
  password: '123456',
  initialBalance: 10_000,
  // Mesmo valor de WITHDRAWAL_FEE_PERCENTAGE no .env.example
  withdrawalFeePercentage: 4,
} as const;

const VOICES = [
  {
    name: 'Ricardo',
    provider: 'google',
    voiceId: 'pt-BR-Wavenet-B',
    isActive: true,
  },
  {
    name: 'Francisca',
    provider: 'google',
    voiceId: 'pt-BR-Wavenet-A',
    isActive: true,
  },
  {
    name: 'Gradium',
    provider: 'gradium',
    voiceId: 'YHOBjtajNBEHUI_K',
    isActive: true,
  },
  {
    name: 'Lúcia',
    provider: 'google',
    voiceId: 'pt-BR-Standard-C',
    isActive: false,
  },
];

const DEFAULT_VOICE_NAME = 'Ricardo';

// Espelha WidgetsService.getDefaultSettings — defaultNarrator deve existir no catálogo acima.
const WIDGET_DEFAULTS: Record<WidgetType, Prisma.InputJsonObject> = {
  [WidgetType.overlay]: {
    volume: 100,
    speakNameAmount: true,
    defaultNarrator: DEFAULT_VOICE_NAME,
    isPaused: false,
  },
  [WidgetType.qrcode]: {
    color: '#000000',
    size: 256,
  },
};

const daysAgo = (days: number) =>
  new Date(Date.now() - days * 24 * 60 * 60 * 1000);
const minutesAgo = (minutes: number) =>
  new Date(Date.now() - minutes * 60 * 1000);
const minutesFrom = (date: Date, minutes: number) =>
  new Date(date.getTime() + minutes * 60 * 1000);

interface DonationScenario {
  name: string;
  amount: number;
  status: DonationStatus;
  messageType: MessageType;
  voiceName?: string;
  message: string;
  createdAt: Date;
}

const DONATION_SCENARIOS: DonationScenario[] = [
  {
    name: 'Maria Silva',
    amount: 20,
    status: DonationStatus.displayed,
    messageType: MessageType.text,
    message: 'Top stream da semana!',
    createdAt: daysAgo(7),
  },
  {
    name: 'João Pedro',
    amount: 50,
    status: DonationStatus.displayed,
    messageType: MessageType.audio,
    voiceName: 'Ricardo',
    message: 'Melhor live de todas, continua assim!',
    createdAt: daysAgo(6),
  },
  {
    name: 'Ana Souza',
    amount: 10,
    status: DonationStatus.paid,
    messageType: MessageType.text,
    message: 'Primeira doação aqui, parabéns!',
    createdAt: daysAgo(4),
  },
  {
    name: 'Carlos Lima',
    amount: 100,
    status: DonationStatus.paid,
    messageType: MessageType.audio,
    voiceName: 'Gradium',
    message: 'Uma mensagem de cem reais, vale cada centavo',
    createdAt: daysAgo(3),
  },
  {
    name: 'Beatriz Costa',
    amount: 5,
    status: DonationStatus.expired,
    messageType: MessageType.text,
    message: 'Deixei o pix expirar, depois faço outro',
    createdAt: daysAgo(2),
  },
  {
    name: 'Lucas Alves',
    amount: 30,
    status: DonationStatus.failed,
    messageType: MessageType.audio,
    voiceName: 'Francisca',
    message: 'O pagamento não completou, testando',
    createdAt: daysAgo(1),
  },
  {
    name: 'Pedro Henrique',
    amount: 15,
    status: DonationStatus.pending,
    messageType: MessageType.text,
    message: 'Acabei de pagar, aguardando o webhook',
    createdAt: minutesAgo(2),
  },
  {
    name: 'Anônimo',
    amount: 25,
    status: DonationStatus.pending,
    messageType: MessageType.audio,
    voiceName: 'Ricardo',
    message: 'Toca essa mensagem no overlay depois',
    createdAt: minutesAgo(1),
  },
];

const WITHDRAWAL_SCENARIOS = [
  { amount: 100, status: WithdrawalStatus.success, createdAt: daysAgo(2) },
  { amount: 50, status: WithdrawalStatus.pending, createdAt: daysAgo(1) },
] as const;

const fakePixPayload = () =>
  `00020126580014BR.GOV.BCB.PIX0136${randomUUID().replace(/-/g, '')}5204000053039865802BR5913LINKPIX SEED6009SAO PAULO62070503***6304SEED`;

type Tx = Prisma.TransactionClient;

/**
 * Espelho de WalletsRepository.applyOp para o seed: deriva o novo saldo do
 * último registro do ledger (nunca do cache), grava a entrada e atualiza o
 * cache + lastTransactionId juntos (exigência do trigger wallets_balance_guard).
 * createdAt é explícito porque o reconcile ordena por createdAt e, dentro de
 * uma transação Postgres, now() seria idêntico para todas as entradas.
 * Sem SELECT ... FOR UPDATE: o seed roda sozinho num banco de dev.
 */
async function applyLedgerOp(
  tx: Tx,
  params: {
    userId: string;
    delta: Decimal;
    type: TransactionType;
    transactionId: string;
    pendingDelta?: Decimal;
    donationId?: string;
    withdrawalId?: string;
    ip?: string;
    createdAt: Date;
  },
) {
  const wallet = await tx.wallet.findUnique({
    where: { userId: params.userId },
  });

  if (!wallet) {
    throw new Error(`Wallet not found for user ${params.userId}`);
  }

  const prevTx = wallet.lastTransactionId
    ? await tx.transaction.findUnique({
        where: { id: wallet.lastTransactionId },
      })
    : null;

  const prevBalance = prevTx ? prevTx.balanceAfter : new Decimal(0);
  const newBalance = prevBalance.plus(params.delta);

  if (newBalance.isNegative()) {
    throw new Error('Seed geraria saldo negativo — revise os cenários.');
  }

  // Mantém createdAt alinhado à ordem do ponteiro: se o banco já tiver
  // entradas mais novas que a data planejada (seed sobre estado
  // preexistente), empurra a entrada para depois delas — o reconcile
  // valida a cadeia na ordem de createdAt.
  const createdAt =
    prevTx && prevTx.createdAt.getTime() >= params.createdAt.getTime()
      ? new Date(prevTx.createdAt.getTime() + 1)
      : params.createdAt;

  const entry = await tx.transaction.create({
    data: {
      userId: params.userId,
      transactionId: params.transactionId,
      type: params.type,
      amount: params.delta,
      balanceAfter: newBalance,
      donationId: params.donationId ?? null,
      withdrawalId: params.withdrawalId ?? null,
      ip: params.ip ?? null,
      createdAt,
    },
  });

  await tx.wallet.update({
    where: { userId: params.userId },
    data: {
      currentBalance: newBalance,
      pendingBalance: wallet.pendingBalance.plus(params.pendingDelta ?? 0),
      lastTransactionId: entry.id,
    },
  });

  return entry;
}

async function ensureUser(
  tx: Tx,
  data: {
    name: string;
    email: string;
    username: string;
    roles: readonly UserRole[];
    verified: boolean;
  },
  passwordHash: string,
) {
  const existing = await tx.user.findFirst({
    where: { OR: [{ email: data.email }, { username: data.username }] },
  });

  if (existing) {
    return { user: existing, created: false };
  }

  const user = await tx.user.create({
    data: {
      ...data,
      roles: [...data.roles],
      password: passwordHash,
      active: true,
      verifiedEmail: true,
    },
  });

  await tx.wallet.create({ data: { userId: user.id } });

  return { user, created: true };
}

async function ensureDonationSettings(
  tx: Tx,
  userId: string,
  overrides: Omit<Prisma.DonationSettingsUncheckedCreateInput, 'userId'>,
) {
  await tx.donationSettings.upsert({
    where: { userId },
    create: { userId, ...overrides },
    // Reexecuções não devem sobrescrever ajustes manuais de dev.
    update: {},
  });
}

async function ensureWidgets(tx: Tx, userId: string) {
  for (const type of [WidgetType.overlay, WidgetType.qrcode]) {
    await tx.widget.upsert({
      where: { userId_type: { userId, type } },
      create: { userId, type, settings: WIDGET_DEFAULTS[type] },
      update: {},
    });
  }
}

async function main() {
  if (existsSync('.env')) {
    process.loadEnvFile('.env');
  }

  if (!process.env.DATABASE_URL) {
    console.error('Seed failed: DATABASE_URL não definida (.env).');
    process.exit(1);
  }

  const prisma = new PrismaClient({
    adapter: new PrismaPg({
      connectionString: process.env.DATABASE_URL,
    }),
  });
  const securityService = new SecurityService();

  try {
    const passwordHash = await bcrypt.hash(SEED.password, 12);
    const feeRate = new Decimal(SEED.withdrawalFeePercentage).div(100);

    const summary = await prisma.$transaction(
      async (tx) => {
        // Catálogo global de vozes (sem unique constraint — só popula se vazio).
        let voicesCreated = false;
        if ((await tx.voice.count()) === 0) {
          await tx.voice.createMany({ data: VOICES });
          voicesCreated = true;
        }
        const voices = await tx.voice.findMany();
        const voiceByName = new Map(voices.map((v) => [v.name, v]));
        const defaultVoice = voiceByName.get(DEFAULT_VOICE_NAME);

        const admin = await ensureUser(tx, SEED.admin, passwordHash);
        const streamer = await ensureUser(tx, SEED.streamer, passwordHash);

        await ensureDonationSettings(tx, admin.user.id, {
          filterProfanity: true,
          filterSpam: true,
          blockedWords: ['casino', 'spam', 'http://'],
          defaultVoiceId: defaultVoice?.id,
        });
        await ensureDonationSettings(tx, streamer.user.id, {
          defaultVoiceId: defaultVoice?.id,
        });

        await ensureWidgets(tx, admin.user.id);
        await ensureWidgets(tx, streamer.user.id);

        // Chave Pix do admin (o streamer fica sem, para testar o cadastro).
        let pixKey = await tx.pixKey.findFirst({
          where: { userId: admin.user.id, default: true },
        });
        if (!pixKey) {
          pixKey = await tx.pixKey.create({
            data: {
              userId: admin.user.id,
              key: securityService.encryptData(admin.user.email),
              keyHashed: securityService.hashData(admin.user.email),
              keyMasked: maskPixKey('email', admin.user.email),
              keyType: PixKeyType.email,
              alias: 'Principal',
              default: true,
            },
          });
        }

        let donationsCreated = false;
        if (
          (await tx.donation.count({ where: { userId: admin.user.id } })) === 0
        ) {
          donationsCreated = true;

          // Crédito inicial: entrada de abertura do ledger (só se ele estiver vazio,
          // p.ex. em bancos criados pelo seed antigo, que já tinha essa entrada).
          if (
            (await tx.transaction.count({
              where: { userId: admin.user.id },
            })) === 0
          ) {
            await applyLedgerOp(tx, {
              userId: admin.user.id,
              delta: new Decimal(SEED.initialBalance),
              type: TransactionType.donation,
              transactionId: `seed-initial-${randomUUID()}`,
              createdAt: daysAgo(8),
            });
          }

          // Cenários ordenados do mais antigo ao mais recente: os créditos
          // seguem essa ordem para o reconcile (order by createdAt) validar a cadeia.
          for (const scenario of DONATION_SCENARIOS) {
            const confirmed =
              scenario.status === DonationStatus.paid ||
              scenario.status === DonationStatus.displayed;
            const donationId = randomUUID();
            const transactionId = `seed-don-${randomUUID()}`;

            await tx.donation.create({
              data: {
                id: donationId,
                userId: admin.user.id,
                name: scenario.name,
                amount: new Decimal(scenario.amount),
                messageRaw: scenario.message,
                message: confirmed ? scenario.message : null,
                messageType: scenario.messageType,
                voiceId: scenario.voiceName
                  ? voiceByName.get(scenario.voiceName)?.id
                  : null,
                voiceUrl:
                  confirmed && scenario.messageType === MessageType.audio
                    ? `tts/${admin.user.username}-${donationId}.wav`
                    : null,
                status: scenario.status,
                paymentMethod: PaymentMethod.pix,
                pix: fakePixPayload(),
                transactionId,
                ip: '127.0.0.1',
                createdAt: scenario.createdAt,
                expiredAt: minutesFrom(scenario.createdAt, 15),
                approvedAt: confirmed
                  ? minutesFrom(scenario.createdAt, 2)
                  : null,
              },
            });

            if (confirmed) {
              await applyLedgerOp(tx, {
                userId: admin.user.id,
                delta: new Decimal(scenario.amount),
                type: TransactionType.donation,
                transactionId,
                donationId,
                ip: '127.0.0.1',
                createdAt: minutesFrom(scenario.createdAt, 2),
              });
            }
          }
        }

        let withdrawalsCreated = false;
        if (
          (await tx.withdrawal.count({ where: { userId: admin.user.id } })) ===
          0
        ) {
          withdrawalsCreated = true;

          // success passa por reserve → confirm; pending fica só no reserve.
          for (const scenario of WITHDRAWAL_SCENARIOS) {
            const gross = new Decimal(scenario.amount);
            const fee = gross.mul(feeRate);
            const net = gross.minus(fee);
            const withdrawalId = randomUUID();
            const gatewayTransactionId =
              scenario.status === WithdrawalStatus.success
                ? `seed-wd-${randomUUID()}`
                : null;

            await tx.withdrawal.create({
              data: {
                id: withdrawalId,
                userId: admin.user.id,
                pixId: pixKey.id,
                pixValue: pixKey.key,
                keyMasked: pixKey.keyMasked,
                clientKey: `seed-withdrawal-${scenario.status}`,
                status: scenario.status,
                grossAmount: gross,
                netAmount: net,
                feeAmount: fee,
                transactionId: gatewayTransactionId,
                createdAt: scenario.createdAt,
              },
            });

            await applyLedgerOp(tx, {
              userId: admin.user.id,
              delta: gross.negated(),
              type: TransactionType.withdraw_reserve,
              transactionId: withdrawalId,
              withdrawalId,
              pendingDelta: gross,
              createdAt: scenario.createdAt,
            });

            if (scenario.status === WithdrawalStatus.success) {
              await applyLedgerOp(tx, {
                userId: admin.user.id,
                delta: new Decimal(0),
                type: TransactionType.withdraw_confirm,
                transactionId: gatewayTransactionId!,
                withdrawalId,
                pendingDelta: gross.negated(),
                createdAt: minutesFrom(scenario.createdAt, 60),
              });
            }
          }
        }

        const wallet = await tx.wallet.findUniqueOrThrow({
          where: { userId: admin.user.id },
        });

        return {
          admin,
          streamer,
          voicesCreated,
          voicesTotal: voices.length,
          donationsCreated,
          donationsTotal: DONATION_SCENARIOS.length,
          withdrawalsCreated,
          withdrawalsTotal: WITHDRAWAL_SCENARIOS.length,
          pixKeyMasked: pixKey.keyMasked,
          wallet,
        };
      },
      { timeout: 20_000, maxWait: 10_000 },
    );

    const { admin, streamer, wallet } = summary;

    console.log('Seed completed:');
    console.log(
      `  User:      ${admin.user.email} (roles: ${admin.user.roles.join(', ')})${admin.created ? '' : ' [já existia]'}`,
    );
    console.log(
      `  User:      ${streamer.user.email} (roles: ${streamer.user.roles.join(', ')})${streamer.created ? '' : ' [já existia]'}`,
    );
    console.log(
      `  Voices:    ${summary.voicesTotal} no catálogo${summary.voicesCreated ? '' : ' [já existiam]'}`,
    );
    console.log(
      `  Settings:  donation settings + widgets (overlay, qrcode) para os dois usuários`,
    );
    console.log(`  Pix key:   ${summary.pixKeyMasked} (email, default)`);
    console.log(
      `  Wallet:    R$ ${wallet.currentBalance.toFixed(2)} (pendente: R$ ${wallet.pendingBalance.toFixed(2)})`,
    );
    console.log(
      `  Donations: ${summary.donationsTotal} (${summary.donationsCreated ? 'criadas' : 'já existiam'})`,
    );
    console.log(
      `  Withdrawals: ${summary.withdrawalsTotal} (${summary.withdrawalsCreated ? 'criados' : 'já existiam'})`,
    );
    console.log(
      `Credentials: ${SEED.admin.email} / ${SEED.password} · ${SEED.streamer.email} / ${SEED.password}`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error('Seed failed:', error);
  process.exit(1);
});
