export type BadgeType =
  | 'FIRST_QUIZ' | 'QUIZ_10' | 'QUIZ_50' | 'PERFECT_SCORE'
  | 'STREAK_3' | 'STREAK_7'
  | 'CAT_DS' | 'CAT_ALGO' | 'CAT_OS' | 'CAT_NETWORK' | 'CAT_DB' | 'CAT_ARCH'
  | 'FIRST_SUBMIT' | 'APPROVED_1' | 'APPROVED_5' | 'APPROVED_10'
  | 'COMEBACK' | 'COMPLETIONIST' | 'LIKED_QUESTION';

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
  FIRST_SUBMIT:  { label: '첫 기여',          description: '첫 문제 등록',                 icon: '✏️' },
  APPROVED_1:    { label: '문제 기여자',       description: '문제 1개 채택',                icon: '✅' },
  APPROVED_5:    { label: '활동 기여자',       description: '문제 5개 채택',                icon: '🌟' },
  APPROVED_10:   { label: '핵심 기여자',       description: '문제 10개 채택',               icon: '🏆' },
  COMEBACK:      { label: '오답 극복',         description: '틀렸던 문제 다음에 정답',       icon: '💪' },
  COMPLETIONIST: { label: '완주',             description: '6개 카테고리 모두 1회 이상 완료', icon: '🎖️' },
  LIKED_QUESTION:{ label: '인기 출제자',       description: '내 문제가 북마크 10개 달성',    icon: '🔖' },
};

export const ALL_BADGES: BadgeType[] = Object.keys(BADGE_META) as BadgeType[];
