import { describe, it, expect } from 'vitest';
import { getLevelInfo, xpForLevel, quizXp, MAX_LEVEL, XP_REWARDS } from './user-level';

describe('xpForLevel', () => {
  it('레벨 1→2 필요 경험치는 100', () => {
    expect(xpForLevel(1)).toBe(100);
  });

  it('레벨이 오를수록 필요 경험치 5씩 증가', () => {
    expect(xpForLevel(2)).toBe(105);
    expect(xpForLevel(10)).toBe(145);
  });
});

describe('getLevelInfo', () => {
  it('0 XP는 레벨 1, 0/100', () => {
    expect(getLevelInfo(0)).toEqual({ level: 1, currentXp: 0, requiredXp: 100 });
  });

  it('99 XP는 아직 레벨 1', () => {
    expect(getLevelInfo(99)).toEqual({ level: 1, currentXp: 99, requiredXp: 100 });
  });

  it('100 XP에 레벨 2 도달, 잔여 0/105', () => {
    expect(getLevelInfo(100)).toEqual({ level: 2, currentXp: 0, requiredXp: 105 });
  });

  it('여러 레벨 누적 계산 (100+105=205 XP → 레벨 3)', () => {
    expect(getLevelInfo(205)).toEqual({ level: 3, currentXp: 0, requiredXp: 110 });
    expect(getLevelInfo(204)).toEqual({ level: 2, currentXp: 104, requiredXp: 105 });
  });

  it('최대 레벨 200에서 멈추고 requiredXp 0', () => {
    const info = getLevelInfo(10_000_000);
    expect(info.level).toBe(MAX_LEVEL);
    expect(info.requiredXp).toBe(0);
    expect(info.currentXp).toBe(0);
  });

  it('음수 XP는 레벨 1로 처리', () => {
    expect(getLevelInfo(-10)).toEqual({ level: 1, currentXp: 0, requiredXp: 100 });
  });
});

describe('quizXp', () => {
  it('기본 10 + 정답당 1', () => {
    expect(quizXp(0)).toBe(XP_REWARDS.QUIZ_BASE);
    expect(quizXp(20)).toBe(XP_REWARDS.QUIZ_BASE + 20);
  });
});
