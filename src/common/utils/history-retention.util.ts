export const HISTORY_RETENTION_DAYS = 30;

export function getRetentionStart(from: Date = new Date()): Date {
  const start = new Date(from);
  start.setDate(start.getDate() - (HISTORY_RETENTION_DAYS - 1));
  start.setHours(0, 0, 0, 0);
  return start;
}

export function getTodayStart(from: Date = new Date()): Date {
  return new Date(from.getTime() - 24 * 60 * 60 * 1000);
}

export function isOlderThanRetention(
  date: Date | string | null | undefined,
  from: Date = new Date(),
): boolean {
  if (!date) return false;
  const d = date instanceof Date ? date : new Date(date);
  return d.getTime() < getRetentionStart(from).getTime();
}
