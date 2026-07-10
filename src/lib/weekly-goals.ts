export type GoalDef = {
  key: string;
  label: string;
  description: string;
  target: number;
  points: number;
};

export const WEEKLY_GOALS: GoalDef[] = [
  { key: 'QUIZ_3',      label: '퀴즈 7회 완료',        description: '이번 주 일반 퀴즈를 7회 이상 완료하세요',          target: 7,  points: 50 },
  { key: 'ACCURACY_70', label: '고득점 3회 달성',       description: '정답률 70% 이상으로 퀴즈를 3회 이상 완료하세요',   target: 3,  points: 40 },
  { key: 'CATEGORY_3',  label: '5개 카테고리 도전',    description: '이번 주 5가지 이상의 카테고리를 완료하세요',        target: 5,  points: 45 },
  { key: 'REVIEW_1',    label: '오답 복습 3회',         description: '오답 복습 모드로 퀴즈를 3회 이상 완료하세요',       target: 3,  points: 30 },
];

export function getISOWeek(): string {
  const nowKST = new Date(Date.now() + 9 * 3600_000);
  const d = new Date(Date.UTC(nowKST.getUTCFullYear(), nowKST.getUTCMonth(), nowKST.getUTCDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

export function getWeekStart(): Date {
  const nowKST = new Date(Date.now() + 9 * 3600_000);
  const dayOfWeek = nowKST.getUTCDay(); // 0=Sun, 1=Mon, ..., 6=Sat
  const daysToMonday = (dayOfWeek + 6) % 7;
  const kstMidnightToday =
    Date.UTC(nowKST.getUTCFullYear(), nowKST.getUTCMonth(), nowKST.getUTCDate()) -
    9 * 3600_000;
  return new Date(kstMidnightToday - daysToMonday * 86400_000);
}
