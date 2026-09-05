import { PrismaPg } from '@prisma/adapter-pg';
import { DonationStatus, PrismaClient, WidgetType } from '@prisma/client';
import Redis from 'ioredis';
import { existsSync } from 'node:fs';

const TARGET_USERNAME = 'hxmoura';
const QUEUE_LIMIT = 30;
const OVERLAY_SETTINGS = {
  volume: 100,
  speakNameAmount: true,
  defaultNarrator: 'Ricardo',
  isPaused: false,
};

async function main() {
  if (existsSync('.env')) process.loadEnvFile('.env');
  if (!process.env.DATABASE_URL) {
    console.error('Erro: DATABASE_URL não definida (.env)');
    process.exit(1);
  }

  const prisma = new PrismaClient({
    adapter: new PrismaPg({
      connectionString: process.env.DATABASE_URL,
    }),
  });
  const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

  try {
    const user = await prisma.user.findUnique({
      where: { username: TARGET_USERNAME },
      include: { widgets: true },
    });

    if (!user) {
      console.error(
        `Erro: usuário "${TARGET_USERNAME}" não encontrado — ajuste TARGET_USERNAME no arquivo`,
      );
      process.exit(1);
    }

    let overlay = user.widgets.find((w) => w.type === WidgetType.overlay);
    if (!overlay) {
      overlay = await prisma.widget.create({
        data: {
          userId: user.id,
          type: WidgetType.overlay,
          settings: OVERLAY_SETTINGS,
        },
      });
    } else if (!overlay.active) {
      overlay = await prisma.widget.update({
        where: { id: overlay.id },
        data: { active: true },
      });
    }

    const donations = await prisma.donation.findMany({
      where: {
        userId: user.id,
        status: { in: [DonationStatus.paid, DonationStatus.displayed] },
      },
      orderBy: { createdAt: 'desc' },
      take: QUEUE_LIMIT,
    });

    if (donations.length === 0) {
      console.log(
        `Nenhuma doação paga/exibida encontrada para @${TARGET_USERNAME} — crie doações pelo endpoint antes de rodar este script`,
      );
      return;
    }

    donations.reverse();

    const queueKey = `overlay:queue:${overlay.token}`;
    const queuedIds = new Set(await redis.lrange(queueKey, 0, -1));
    const toQueue = donations.filter((d) => !queuedIds.has(d.id));
    const alreadyQueued = donations.length - toQueue.length;

    if (toQueue.length > 0) {
      await redis.rpush(queueKey, ...toQueue.map((d) => d.id));
    }

    console.log(`@${TARGET_USERNAME}: ${donations.length} doações elegíveis`);
    console.log(
      `Fila ${queueKey}: ${toQueue.length} adicionadas, ${alreadyQueued} já estavam`,
    );
    console.log(`Tamanho atual da fila: ${await redis.llen(queueKey)}`);
    console.log('');
    console.log('Como testar:');
    console.log('  1. Abra o overlay no navegador (fila aparece no dashboard)');
    console.log(
      '  2. Clique em Skip uma vez no dashboard para disparar o primeiro alerta',
    );
    console.log(
      '  3. Os demais entram automaticamente (alert_finished encadeia)',
    );
    console.log('');
    console.log('Para limpar a fila: pnpm test:overlay clean');
  } finally {
    await prisma.$disconnect();
    redis.disconnect();
  }
}

main().catch((error) => {
  console.error('Falhou:', error);
  process.exit(1);
});
