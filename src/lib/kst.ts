// KST = UTC+9

export function getKSTDateStr(): string {
  return new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10);
}

export function getKSTWeekStart(): Date {
  const nowKST = new Date(Date.now() + 9 * 3600_000);
  const dayOfWeek = nowKST.getUTCDay(); // 0=Sun, 1=Mon, ..., 6=Sat
  const daysToMonday = (dayOfWeek + 6) % 7;
  const kstMidnightToday =
    Date.UTC(nowKST.getUTCFullYear(), nowKST.getUTCMonth(), nowKST.getUTCDate()) -
    9 * 3600_000;
  return new Date(kstMidnightToday - daysToMonday * 86400_000);
}

export function getKSTISOWeek(): string {
  const nowKST = new Date(Date.now() + 9 * 3600_000);
  const d = new Date(Date.UTC(nowKST.getUTCFullYear(), nowKST.getUTCMonth(), nowKST.getUTCDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400_000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}
