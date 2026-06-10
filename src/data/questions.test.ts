import { describe, it, expect } from 'vitest';
import { questions } from '@/data/questions';

const CATEGORIES = ['ds', 'algo', 'os', 'network', 'db', 'arch'] as const;
const ID_PATTERN = /^(ds|algo|os|network|db|arch)-\d{3}$/;

describe('questions 데이터 무결성', () => {
  it('총 문제 수 >= 120', () => {
    expect(questions.length).toBeGreaterThanOrEqual(120);
  });

  it.each(CATEGORIES)('카테고리 %s 문제 수 >= 20', (cat) => {
    const count = questions.filter((q) => q.category === cat).length;
    expect(count).toBeGreaterThanOrEqual(20);
  });

  it('id 중복 없음', () => {
    const ids = questions.map((q) => q.id);
    expect(new Set(ids).size).toBe(questions.length);
  });

  it('모든 answer가 0|1|2|3', () => {
    questions.forEach((q) => {
      expect([0, 1, 2, 3]).toContain(q.answer);
    });
  });

  it('모든 options 길이 == 4', () => {
    questions.forEach((q) => {
      expect(q.options).toHaveLength(4);
    });
  });

  it('모든 explanation 비어있지 않음', () => {
    questions.forEach((q) => {
      expect(q.explanation.length).toBeGreaterThan(0);
    });
  });

  it('모든 question 텍스트 비어있지 않음', () => {
    questions.forEach((q) => {
      expect(q.question.length).toBeGreaterThan(0);
    });
  });

  it('id 형식이 {category}-{3자리숫자} 패턴', () => {
    questions.forEach((q) => {
      expect(q.id).toMatch(ID_PATTERN);
    });
  });
});
