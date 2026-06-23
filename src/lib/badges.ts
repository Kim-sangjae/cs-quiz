export type BadgeType =
  | 'FIRST_QUIZ' | 'QUIZ_10' | 'QUIZ_50' | 'PERFECT_SCORE'
  | 'STREAK_3' | 'STREAK_7'
  | 'CAT_DS' | 'CAT_ALGO' | 'CAT_OS' | 'CAT_NETWORK' | 'CAT_DB' | 'CAT_ARCH';

export interface BadgeMeta {
  label: string;
  description: string;
  icon: string;
}

export const BADGE_META: Record<BadgeType, BadgeMeta> = {
  FIRST_QUIZ:    { label: '첫 걸음',         description: '첫 번째 퀴즈 완료',           icon: '🎯' },
  QUIZ_10:       { label: '끈기',            description: '퀴즈 10회 완료',              icon: '📚' },
  QUIZ_50:       { label: '열정',            description: '퀴즈 50회 완료',              icon: '🔥' },
  PERFECT_SCORE: { label: '완벽',            description: '퀴즈 만점 달성',              icon: '⭐' },
  STREAK_3:      { label: '3일 연속',        description: '3일 연속 학습',               icon: '📅' },
  STREAK_7:      { label: '7일 연속',        description: '7일 연속 학습',               icon: '🗓️' },
  CAT_DS:        { label: '자료구조 마스터',  description: '자료구조 15회 · 정답률 80%+',  icon: '🏗️' },
  CAT_ALGO:      { label: '알고리즘 마스터',  description: '알고리즘 15회 · 정답률 80%+',  icon: '⚡' },
  CAT_OS:        { label: 'OS 마스터',       description: '운영체제 15회 · 정답률 80%+',  icon: '💻' },
  CAT_NETWORK:   { label: '네트워크 마스터',  description: '네트워크 15회 · 정답률 80%+',  icon: '🌐' },
  CAT_DB:        { label: 'DB 마스터',       description: 'DB 15회 · 정답률 80%+',       icon: '🗃️' },
  CAT_ARCH:      { label: '컴퓨터구조 마스터', description: '컴퓨터구조 15회 · 정답률 80%+', icon: '🔧' },
};

export const ALL_BADGES: BadgeType[] = Object.keys(BADGE_META) as BadgeType[];
