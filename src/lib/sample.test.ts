import { describe, it, expect, vi } from 'vitest';
import { sample } from './sample';
import type { Question } from '@/types';

function makeQuestion(id: string): Question {
  return {
    id,
    category: 'os',
    question: `Question ${id}`,
    options: ['A', 'B', 'C', 'D'],
    answer: 0,
    explanation: 'Explanation',
  };
}

const pool50 = Array.from({ length: 50 }, (_, i) => makeQuestion(`os-${String(i + 1).padStart(3, '0')}`));

describe('sample', () => {
  it('반환 길이 == n (pool.length > n)', () => {
    const result = sample(pool50, 30);
    expect(result).toHaveLength(30);
  });

  it('반환 배열에 중복 없음 (id 기준)', () => {
    const result = sample(pool50, 30);
    const ids = result.map(q => q.id);
    expect(new Set(ids).size).toBe(30);
  });

  it('pool.length < n → 전체 pool 반환 (길이 == pool.length)', () => {
    const smallPool = pool50.slice(0, 10);
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const result = sample(smallPool, 30);
    expect(result).toHaveLength(10);
    consoleSpy.mockRestore();
  });

  it('pool.length === 0 → 빈 배열 반환', () => {
    const result = sample([], 30);
    expect(result).toHaveLength(0);
  });

  it('pool.length === n → pool 전체 반환 (셔플됨)', () => {
    const exactPool = pool50.slice(0, 30);
    const result = sample(exactPool, 30);
    expect(result).toHaveLength(30);
    const resultIds = new Set(result.map(q => q.id));
    exactPool.forEach(q => expect(resultIds.has(q.id)).toBe(true));
  });

  it('원본 pool 배열이 변경되지 않음', () => {
    const originalIds = pool50.map(q => q.id);
    sample(pool50, 30);
    const afterIds = pool50.map(q => q.id);
    expect(afterIds).toEqual(originalIds);
  });

  it('pool.length < n → console.error 호출', () => {
    const smallPool = pool50.slice(0, 5);
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    sample(smallPool, 30);
    expect(consoleSpy).toHaveBeenCalledWith('[sample] pool size(5) < requested(30). Returning full pool.');
    consoleSpy.mockRestore();
  });
});
