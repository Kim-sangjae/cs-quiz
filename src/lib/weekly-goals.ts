export type GoalDef = {
  key: string;
  label: string;
  description: string;
  target: number;
  points: number;
};

export const WEEKLY_GOALS: GoalDef[] = [
  { key: 'QUIZ_3',      label: '퀴즈 3회 완료',        description: '이번 주 일반 퀴즈를 3회 이상 완료하세요',   target: 3,  points: 30 },
  { key: 'ACCURACY_70', label: '고득점 달성',           description: '정답률 70% 이상으로 퀴즈를 1회 완료하세요', target: 1,  points: 20 },
  { key: 'CATEGORY_3',  label: '다양한 카테고리 도전', description: '이번 주 3가지 이상의 카테고리를 완료하세요',  target: 3,  points: 25 },
  { key: 'REVIEW_1',    label: '오답 복습 완료',        description: '오답 복습 모드로 퀴즈를 1회 완료하세요',     target: 1,  points: 15 },
];

export function getISOWeek(): string {
  const now = new Date();
  const d = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

export function getWeekStart(): Date {
  const now = new Date();
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); // Monday
  return d;
}
