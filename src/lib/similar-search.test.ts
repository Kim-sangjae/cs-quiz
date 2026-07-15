import { describe, it, expect } from 'vitest';
import { extractSearchTokens, rareTokenBoost } from './similar-search';

describe('extractSearchTokens', () => {
  it('조사를 제거해 어근만 남긴다', () => {
    expect(extractSearchTokens('데이터베이스에서 트리거')).toEqual(['데이터베이스', '트리거']);
  });

  it('물음표 등 구두점을 제거하고 조사도 마저 벗겨낸다', () => {
    expect(extractSearchTokens('트리거란 무엇인가?')).toEqual(['트리거', '무엇인']);
  });

  it('2글자 미만 토큰은 제외하고, 2글자는 유지한다', () => {
    expect(extractSearchTokens('DB 트리거')).toEqual(['DB', '트리거']);
    expect(extractSearchTokens('A B 트리거')).toEqual(['트리거']);
  });

  it('중복 토큰은 한 번만 반환한다', () => {
    expect(extractSearchTokens('트리거 트리거')).toEqual(['트리거']);
  });

  it('빈 문자열은 빈 배열을 반환한다', () => {
    expect(extractSearchTokens('')).toEqual([]);
  });
});

describe('rareTokenBoost', () => {
  it('드문 토큰이 매칭되면 흔한 토큰보다 더 큰 가중치를 준다', () => {
    const counts = { 데이터베이스: 81, 트리거: 1 };
    const rareBoost = rareTokenBoost('RDBMS에서 트리거는 언제 실행되는가', ['데이터베이스', '트리거'], counts);
    const commonOnlyBoost = rareTokenBoost('데이터베이스 인덱스의 목적은', ['데이터베이스', '트리거'], counts);
    expect(rareBoost).toBeGreaterThan(commonOnlyBoost);
  });

  it('매칭되는 토큰이 없으면 0을 반환한다', () => {
    expect(rareTokenBoost('전혀 관련 없는 문제', ['트리거'], { 트리거: 1 })).toBe(0);
  });

  it('코퍼스 빈도가 0이면(정보 없음) 가중치를 주지 않는다', () => {
    expect(rareTokenBoost('트리거 문제', ['트리거'], {})).toBe(0);
  });
});
