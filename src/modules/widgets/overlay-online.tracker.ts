import { Injectable } from '@nestjs/common';

const HEARTBEAT_WINDOW_MS = 80_000;

@Injectable()
export class OverlayOnlineTracker {
  private readonly lastPulse = new Map<string, number>();

  mark(token: string) {
    this.lastPulse.set(token, Date.now());
  }

  isFresh(token: string): boolean {
    const lastPulse = this.lastPulse.get(token);
    if (lastPulse === undefined) return false;
    if (Date.now() - lastPulse > HEARTBEAT_WINDOW_MS) {
      this.lastPulse.delete(token);
      return false;
    }
    return true;
  }

  purge(token: string) {
    this.lastPulse.delete(token);
  }
}
