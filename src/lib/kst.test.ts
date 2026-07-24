import { describe, it, expect, vi, afterEach } from 'vitest';
import { getKSTMidnight, getKSTNow, getKSTDateStr } from './kst';

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

describe('getKSTDateStr', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  // 관리자 통계/presence heartbeat가 예전에 new Date().toISOString().slice(0,10)를
  // 써서 "오늘"이 KST 자정이 아니라 UTC 자정(=KST 오전 9시)에 바뀌던 버그를 재발 방지
  it('KST 자정 정각 - 새 날짜로 바뀐다', () => {
    // 2026-07-24 00:00:00 KST == 2026-07-23 15:00:00 UTC
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-23T15:00:00Z'));
    expect(getKSTDateStr()).toBe('2026-07-24');
  });

  it('KST 자정 1초 전 - 아직 이전 날짜', () => {
    // 2026-07-23 23:59:59 KST == 2026-07-23 14:59:59 UTC
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-23T14:59:59Z'));
    expect(getKSTDateStr()).toBe('2026-07-23');
  });

  it('KST 오전 0~9시 구간 - UTC 날짜는 전날이지만 KST로는 새 날짜(예전 버그 재현 지점)', () => {
    // 2026-07-24 08:59 KST == 2026-07-23 23:59 UTC (UTC 기준으로는 아직 7/23)
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-23T23:59:00Z'));
    expect(getKSTDateStr()).toBe('2026-07-24');
  });

  it('UTC 자정 직후 - KST로는 오전 9시라 이미 같은 날짜(우연히 버그가 안 보이던 구간)', () => {
    // 2026-07-24 09:01 KST == 2026-07-24 00:01 UTC
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-24T00:01:00Z'));
    expect(getKSTDateStr()).toBe('2026-07-24');
  });
});
