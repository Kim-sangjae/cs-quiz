import { describe, it, expect } from 'vitest';
import { getLevelInfo, xpForLevel, totalXpForLevel, quizXp, MAX_LEVEL, XP_REWARDS } from './user-level';

describe('xpForLevel', () => {
  it('레벨 1→2 필요 경험치는 150', () => {
    expect(xpForLevel(1)).toBe(150);
  });

  it('레벨이 오를수록 필요 경험치 10씩 증가', () => {
    expect(xpForLevel(2)).toBe(160);
    expect(xpForLevel(10)).toBe(240);
  });
});

describe('getLevelInfo', () => {
  it('0 XP는 레벨 1, 0/150', () => {
    expect(getLevelInfo(0)).toEqual({ level: 1, currentXp: 0, requiredXp: 150 });
  });

  it('149 XP는 아직 레벨 1', () => {
    expect(getLevelInfo(149)).toEqual({ level: 1, currentXp: 149, requiredXp: 150 });
  });

  it('150 XP에 레벨 2 도달, 잔여 0/160', () => {
    expect(getLevelInfo(150)).toEqual({ level: 2, currentXp: 0, requiredXp: 160 });
  });

  it('여러 레벨 누적 계산 (150+160=310 XP → 레벨 3)', () => {
    expect(getLevelInfo(310)).toEqual({ level: 3, currentXp: 0, requiredXp: 170 });
    expect(getLevelInfo(309)).toEqual({ level: 2, currentXp: 159, requiredXp: 160 });
  });

  it('최대 레벨 200에서 멈추고 requiredXp 0', () => {
    const info = getLevelInfo(10_000_000);
    expect(info.level).toBe(MAX_LEVEL);
    expect(info.requiredXp).toBe(0);
    expect(info.currentXp).toBe(0);
  });

  it('음수 XP는 레벨 1로 처리', () => {
    expect(getLevelInfo(-10)).toEqual({ level: 1, currentXp: 0, requiredXp: 150 });
  });
});

describe('XP_REWARDS', () => {
  it('대전 보상은 승15/무10/패5', () => {
    expect(XP_REWARDS.BATTLE_WIN).toBe(15);
    expect(XP_REWARDS.BATTLE_TIE).toBe(10);
    expect(XP_REWARDS.BATTLE_LOSS).toBe(5);
  });
});

describe('totalXpForLevel', () => {
  it('레벨 1 시작점은 0 XP', () => {
    expect(totalXpForLevel(1)).toBe(0);
  });

  it('레벨 2 시작점은 150, 레벨 3은 310', () => {
    expect(totalXpForLevel(2)).toBe(150);
    expect(totalXpForLevel(3)).toBe(310);
  });

  it('getLevelInfo와 왕복 일치 (레벨 시작점 XP → 해당 레벨)', () => {
    for (const lv of [1, 2, 50, 199, 200]) {
      expect(getLevelInfo(totalXpForLevel(lv)).level).toBe(lv);
    }
  });

  it('MAX_LEVEL 초과 입력은 MAX_LEVEL 시작점으로 클램프', () => {
    expect(totalXpForLevel(999)).toBe(totalXpForLevel(MAX_LEVEL));
  });
});

describe('quizXp', () => {
  it('기본 10 + 정답당 1', () => {
    expect(quizXp(0)).toBe(XP_REWARDS.QUIZ_BASE);
    expect(quizXp(20)).toBe(XP_REWARDS.QUIZ_BASE + 20);
  });
});
