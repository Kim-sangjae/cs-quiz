import { describe, it, expect, vi, afterEach } from 'vitest';
import { getKSTMidnight, getKSTNow } from './kst';

describe('getKSTNow', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('UTC 오전 시각을 KST(UTC+9) 벽시계로 시프트한다', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-13T18:00:00Z'));
    const now = getKSTNow();
    expect(now.getUTCFullYear()).toBe(2026);
    expect(now.getUTCMonth()).toBe(6); // 0-indexed = 7월
    expect(now.getUTCDate()).toBe(14); // KST로는 이미 7/14 새벽 3시
  });
});

describe('getKSTMidnight', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('KST 오후 시간대 - 오늘 KST 자정을 UTC 인스턴트로 반환', () => {
    // 2026-07-14 15:00 KST == 2026-07-14 06:00 UTC
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-14T06:00:00Z'));
    // 기대: 2026-07-14 00:00 KST == 2026-07-13 15:00 UTC
    expect(getKSTMidnight().toISOString()).toBe('2026-07-13T15:00:00.000Z');
  });

  it('KST 오전 0~9시 - UTC 날짜가 하루 전이어도 KST 기준 오늘 자정을 반환', () => {
    // 2026-07-14 03:00 KST == 2026-07-13 18:00 UTC (UTC로는 아직 7/13)
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-13T18:00:00Z'));
    // 기대: 2026-07-14 00:00 KST == 2026-07-13 15:00 UTC (UTC 날짜와 다름)
    expect(getKSTMidnight().toISOString()).toBe('2026-07-13T15:00:00.000Z');
  });

  it('daysOffset으로 N일 후 KST 자정 계산', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-14T06:00:00Z'));
    expect(getKSTMidnight(1).toISOString()).toBe('2026-07-14T15:00:00.000Z');
    expect(getKSTMidnight(3).toISOString()).toBe('2026-07-16T15:00:00.000Z');
  });

  it('daysOffset 음수로 N일 전 KST 자정 계산', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-14T06:00:00Z'));
    expect(getKSTMidnight(-1).toISOString()).toBe('2026-07-12T15:00:00.000Z');
  });
});
