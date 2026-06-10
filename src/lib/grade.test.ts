import { describe, it, expect } from 'vitest';
import { grade } from './grade';
import type { Question, UserAnswer } from '@/types';

function makeQuestion(id: string, answer: 0 | 1 | 2 | 3 = 0): Question {
  return {
    id,
    category: 'os',
    question: `Question ${id}`,
    options: ['A', 'B', 'C', 'D'],
    answer,
    explanation: 'Explanation',
  };
}

const questions30 = Array.from({ length: 30 }, (_, i) =>
  makeQuestion(`os-${String(i + 1).padStart(3, '0')}`, (i % 4) as 0 | 1 | 2 | 3)
);

describe('grade', () => {
  it('30문제 전부 정답 → score === 30', () => {
    const answers: UserAnswer[] = questions30.map(q => ({
      questionId: q.id,
      selected: q.answer,
    }));
    const result = grade(questions30, answers);
    expect(result.score).toBe(30);
  });

  it('30문제 전부 오답 → score === 0', () => {
    const answers: UserAnswer[] = questions30.map(q => ({
      questionId: q.id,
      selected: ((q.answer + 1) % 4) as 0 | 1 | 2 | 3,
    }));
    const result = grade(questions30, answers);
    expect(result.score).toBe(0);
  });

  it('일부 정답 (15개) → score === 15', () => {
    const answers: UserAnswer[] = questions30.map((q, i) => ({
      questionId: q.id,
      selected: i < 15 ? q.answer : (((q.answer + 1) % 4) as 0 | 1 | 2 | 3),
    }));
    const result = grade(questions30, answers);
    expect(result.score).toBe(15);
  });

  it('answers에 일부 questionId 누락 → 누락된 문제 오답 처리', () => {
    // 앞 20문제만 답안 제공, 뒤 10개 누락
    const answers: UserAnswer[] = questions30.slice(0, 20).map(q => ({
      questionId: q.id,
      selected: q.answer,
    }));
    const result = grade(questions30, answers);
    expect(result.score).toBe(20);
  });

  it('반환 QuizResult에 questions, answers, score, submittedAt 필드 모두 존재', () => {
    const answers: UserAnswer[] = questions30.map(q => ({ questionId: q.id, selected: q.answer }));
    const result = grade(questions30, answers);
    expect(result).toHaveProperty('questions');
    expect(result).toHaveProperty('answers');
    expect(result).toHaveProperty('score');
    expect(result).toHaveProperty('submittedAt');
  });

  it('submittedAt이 ISO 8601 형식 (유효한 Date)', () => {
    const answers: UserAnswer[] = questions30.map(q => ({ questionId: q.id, selected: q.answer }));
    const result = grade(questions30, answers);
    const parsed = new Date(result.submittedAt);
    expect(parsed.toString()).not.toBe('Invalid Date');
    expect(result.submittedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });
});
