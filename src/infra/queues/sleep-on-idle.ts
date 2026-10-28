import { Logger } from '@nestjs/common';
import type { Worker } from 'bullmq';

const IDLE_MS = 10 * 60_000;
const timers = new WeakMap<Worker, NodeJS.Timeout>();

type PendingCounts = () => Promise<{ wait?: number; delayed?: number }>;

function arm(worker: Worker, counts: PendingCounts) {
  const rearm = () => arm(worker, counts);
  timers.set(
    worker,
    setTimeout(() => {
      counts()
        .then((pending) => {
          if ((pending.wait ?? 0) > 0 || (pending.delayed ?? 0) > 0) {
            return rearm();
          }
          void worker.pause();
          new Logger(worker.name).debug(
            `worker ocioso — pausado (${IDLE_MS / 1000}s)`,
          );
        })
        .catch(rearm);
    }, IDLE_MS),
  );
}

export function sleepOnIdle(worker: Worker, counts: PendingCounts) {
  void worker.pause();
  worker.on('active', () => clearTimeout(timers.get(worker)));
  worker.on('drained', () => arm(worker, counts));
}

export function wake(worker: Worker) {
  clearTimeout(timers.get(worker));
  void worker.resume();
}
