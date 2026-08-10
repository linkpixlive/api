import { PrismaPg } from '@prisma/adapter-pg';
import {
  PixKeyType,
  PrismaClient,
  TransactionType,
  UserRole,
} from '@prisma/client';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { SecurityService } from '../src/common/security/security.service';
import { maskPixKey } from '../src/common/utils/mask.util';

const SEED = {
  name: 'Admin',
  email: 'admin@linkpix.com',
  username: 'admin',
  password: '123456',
  pixKeyAlias: 'Principal',
  initialBalance: 10000,
} as const;

if (existsSync('.env')) {
  process.loadEnvFile('.env');
}

async function main() {
  const prisma = new PrismaClient({
    adapter: new PrismaPg({
      connectionString: process.env.DATABASE_URL as string,
    }),
  });
  const securityService = new SecurityService();

  try {
    const existing = await prisma.user.findFirst({
      where: { OR: [{ email: SEED.email }, { username: SEED.username }] },
    });

    if (existing) {
      console.log(
        `Seed skipped: user "${SEED.email}" already exists (id=${existing.id}).`,
      );
      return;
    }

    const passwordHash = await bcrypt.hash(SEED.password, 12);
    const pixKey = SEED.email;
    const transactionId = `seed-${randomUUID()}`;

    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          name: SEED.name,
          email: SEED.email,
          username: SEED.username,
          password: passwordHash,
          roles: [UserRole.admin, UserRole.streamer],
          active: true,
          verifiedEmail: true,
          verified: true,
        },
      });

      const wallet = await tx.wallet.create({
        data: {
          userId: user.id,
          currentBalance: SEED.initialBalance,
          pendingBalance: 0,
          blockedBalance: 0,
        },
      });

      const pixKeyData = await tx.pixKey.create({
        data: {
          userId: user.id,
          key: securityService.encryptData(pixKey),
          keyHashed: securityService.hashData(pixKey),
          keyMasked: maskPixKey('email', pixKey),
          keyType: PixKeyType.email,
          alias: SEED.pixKeyAlias,
          default: true,
        },
      });

      const transaction = await tx.transaction.create({
        data: {
          userId: user.id,
          transactionId,
          type: TransactionType.donation,
          amount: SEED.initialBalance,
          balanceAfter: SEED.initialBalance,
        },
      });

      await tx.wallet.update({
        where: { id: wallet.id },
        data: { lastTransactionId: transaction.id },
      });

      return { user, wallet, pixKeyData, transaction };
    });

    console.log('Seed completed:');
    console.log(`  User:      ${result.user.email} (roles: admin, streamer)`);
    console.log(
      `  Wallet:    R$ ${result.wallet.currentBalance.toString()} current balance`,
    );
    console.log(
      `  Pix key:   ${result.pixKeyData.keyMasked} (${result.pixKeyData.keyType}, default)`,
    );
    console.log(
      `  Audit tx:  ${result.transaction.id} (${result.transaction.type}, R$ ${result.transaction.amount.toString()})`,
    );
    console.log(`Credentials: ${SEED.email} / ${SEED.password}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error('Seed failed:', error);
  process.exit(1);
});
