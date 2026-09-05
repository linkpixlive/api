import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, WidgetType } from '@prisma/client';
import Redis from 'ioredis';
import { existsSync } from 'node:fs';

const TARGET_USERNAME = 'hxmoura';

function loadEnv() {
  if (existsSync('.env')) process.loadEnvFile('.env');
  if (!process.env.DATABASE_URL) {
    console.error('Erro: DATABASE_URL não definida (.env)');
    process.exit(1);
  }
}

async function clean() {
  loadEnv();

  const prisma = new PrismaClient({
    adapter: new PrismaPg({
      connectionString: process.env.DATABASE_URL as string,
    }),
  });
  const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

  try {
    const user = await prisma.user.findUnique({
      where: { username: TARGET_USERNAME },
      include: { widgets: true },
    });

    if (!user) {
      console.error(`Erro: usuário "${TARGET_USERNAME}" não encontrado`);
      process.exit(1);
    }

    const overlay = user.widgets.find((w) => w.type === WidgetType.overlay);

    if (!overlay) {
      console.error(
        `Erro: usuário "${TARGET_USERNAME}" não possui overlay widget`,
      );
      process.exit(1);
    }

    const queueKey = `overlay:queue:${overlay.token}`;
    const removed = await redis.llen(queueKey);
    await redis.del(queueKey);

    console.log(`Fila ${queueKey} limpa (${removed} itens)`);
    console.log('Nenhuma doação foi removida do banco de dados.');
  } finally {
    await prisma.$disconnect();
    redis.disconnect();
  }
}

async function main() {
  const mode = process.argv[2] ?? '';

  switch (mode) {
    case 'clean':
      await clean();
      break;
    default:
      console.log('Uso: pnpm test:overlay clean');
      console.log('');
      console.log(
        'Para enfileirar doações existentes: pnpm seed:donations (configure em scripts/seed-donations.ts)',
      );
      process.exit(mode ? 1 : 0);
  }
}

main().catch((error) => {
  console.error('Falhou:', error);
  process.exit(1);
});
