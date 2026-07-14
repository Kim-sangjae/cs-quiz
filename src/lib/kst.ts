// KST = UTC+9

// 현재 시각을 KST로 시프트한 Date. getUTC*() 게터로 읽으면 KST 벽시계 기준
// 연/월/일/요일을 얻을 수 있음 (서버가 UTC로 도는 Vercel 환경에서 "오늘이 KST로
// 며칠인지" 계산할 때 사용 — new Date().getFullYear() 등 로컬 게터는 쓰면 안 됨).
export function getKSTNow(): Date {
  return new Date(Date.now() + 9 * 3600_000);
}

// KST 기준 자정을 UTC 인스턴트(Date)로 반환. daysOffset으로 N일 전/후 자정도 계산.
// 서버(Vercel, UTC)에서 "오늘/이번 달" 등 날짜 경계를 계산할 때는 항상 이 함수를 써야
// setHours(0,0,0,0) 같은 서버 로컬(UTC) 자정 계산과 최대 9시간 어긋나지 않음.
export function getKSTMidnight(daysOffset = 0): Date {
  const nowKST = getKSTNow();
  return new Date(
    Date.UTC(nowKST.getUTCFullYear(), nowKST.getUTCMonth(), nowKST.getUTCDate() + daysOffset) -
      9 * 3600_000
  );
}

export function getKSTDateStr(): string {
  return new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10);
}

export function getKSTWeekStart(): Date {
  const nowKST = new Date(Date.now() + 9 * 3600_000);
  const dayOfWeek = nowKST.getUTCDay(); // 0=Sun, 1=Mon, ..., 6=Sat
  const daysToMonday = (dayOfWeek + 6) % 7;
  return new Date(getKSTMidnight().getTime() - daysToMonday * 86400_000);
}

export function getKSTISOWeek(): string {
  const nowKST = new Date(Date.now() + 9 * 3600_000);
  const d = new Date(Date.UTC(nowKST.getUTCFullYear(), nowKST.getUTCMonth(), nowKST.getUTCDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400_000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}
