import {
  HISTORY_RETENTION_DAYS,
  getRetentionStart,
  getTodayStart,
  isOlderThanRetention,
} from './history-retention.util';

describe('history-retention.util', () => {
  it('HISTORY_RETENTION_DAYS é 30', () => {
    expect(HISTORY_RETENTION_DAYS).toBe(30);
  });

  describe('getRetentionStart', () => {
    it('retorna a meia-noite de 29 dias atrás (janela de 30 dias)', () => {
      const from = new Date(2026, 10, 5, 15, 30); // 2026-11-05 15:30 local

      expect(getRetentionStart(from)).toEqual(new Date(2026, 9, 7, 0, 0, 0, 0));
    });
  });

  describe('getTodayStart', () => {
    it('retorna o mesmo horário 24h antes (janela do dia)', () => {
      const from = new Date('2026-11-05T15:30:00.000Z');

      expect(getTodayStart(from)).toEqual(new Date('2026-11-04T15:30:00.000Z'));
    });
  });

  describe('isOlderThanRetention', () => {
    const from = new Date(2026, 10, 5, 12, 0);

    it('retorna true para data anterior ao início da retenção', () => {
      const old = new Date(2026, 8, 1); // bem antes de 2026-10-07

      expect(isOlderThanRetention(old, from)).toBe(true);
    });

    it('retorna false para data dentro da janela', () => {
      const recent = new Date(2026, 10, 1);

      expect(isOlderThanRetention(recent, from)).toBe(false);
    });

    it('aceita string ISO', () => {
      expect(isOlderThanRetention('2026-01-01T00:00:00.000Z', from)).toBe(true);
    });

    it('retorna false para date nula ou ausente', () => {
      expect(isOlderThanRetention(null, from)).toBe(false);
      expect(isOlderThanRetention(undefined, from)).toBe(false);
    });
  });
});
