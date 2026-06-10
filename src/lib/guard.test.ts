import { describe, it, expect } from 'vitest';
import { isQuizResult } from './guard';

const validResult = {
  questions: [{ id: 'os-001', category: 'os', question: 'Q?', options: ['A', 'B', 'C', 'D'], answer: 0, explanation: 'E' }],
  answers: [{ questionId: 'os-001', selected: 0 }],
  score: 1,
  submittedAt: '2026-06-08T00:00:00.000Z',
};

describe('isQuizResult', () => {
  it('유효한 QuizResult 객체 → true', () => {
    expect(isQuizResult(validResult)).toBe(true);
  });

  it('questions가 빈 배열 → false', () => {
    expect(isQuizResult({ ...validResult, questions: [] })).toBe(false);
  });

  it('questions 필드 없음 → false', () => {
    const { questions: _, ...rest } = validResult;
    expect(isQuizResult(rest)).toBe(false);
  });

  it('answers 필드 없음 → false', () => {
    const { answers: _, ...rest } = validResult;
    expect(isQuizResult(rest)).toBe(false);
  });

  it('score가 string → false', () => {
    expect(isQuizResult({ ...validResult, score: '1' })).toBe(false);
  });

  it('score가 음수(-1) → false', () => {
    expect(isQuizResult({ ...validResult, score: -1 })).toBe(false);
  });

  it('submittedAt이 빈 문자열 → false', () => {
    expect(isQuizResult({ ...validResult, submittedAt: '' })).toBe(false);
  });

  it('null 입력 → false', () => {
    expect(isQuizResult(null)).toBe(false);
  });

  it('문자열("string") 입력 → false', () => {
    expect(isQuizResult('string')).toBe(false);
  });

  it('빈 배열([]) 입력 → false', () => {
    expect(isQuizResult([])).toBe(false);
  });
});
