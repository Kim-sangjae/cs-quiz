// 유저 레벨(XP) 시스템 — 클라이언트/서버 공용 순수 함수
export const MAX_LEVEL = 200;

// XP 지급 기준 — 퀴즈·문제등록 중심, 대전은 낮게 (과도한 대전 유도 방지)
export const XP_REWARDS = {
  QUIZ_BASE: 10, // 퀴즈 1회 완료 (모든 모드: 일반/시간제한/오답복습)
  QUIZ_PER_CORRECT: 1, // 정답 1개당 추가
  DAILY: 20, // 오늘의 문제 풀이 (출석)
  QUESTION_APPROVED: 50, // 등록한 문제 승인
  BATTLE_WIN: 15, // 대전 승리
  BATTLE_TIE: 10, // 대전 무승부
  BATTLE_LOSS: 5, // 대전 패배
} as const;

// 레벨 n → n+1 에 필요한 경험치 (점진 증가)
export function xpForLevel(level: number): number {
  return 150 + (level - 1) * 10;
}

export interface LevelInfo {
  level: number;
  currentXp: number; // 현재 레벨에서 쌓은 경험치
  requiredXp: number; // 다음 레벨까지 필요한 경험치 (최대 레벨이면 0)
}

export function getLevelInfo(xp: number): LevelInfo {
  let level = 1;
  let remaining = Math.max(0, xp);
  while (level < MAX_LEVEL && remaining >= xpForLevel(level)) {
    remaining -= xpForLevel(level);
    level++;
  }
  if (level >= MAX_LEVEL) return { level: MAX_LEVEL, currentXp: 0, requiredXp: 0 };
  return { level, currentXp: remaining, requiredXp: xpForLevel(level) };
}

// 퀴즈 완료 경험치: 기본 + 정답 수 비례
export function quizXp(correctCount: number): number {
  return XP_REWARDS.QUIZ_BASE + correctCount * XP_REWARDS.QUIZ_PER_CORRECT;
}
