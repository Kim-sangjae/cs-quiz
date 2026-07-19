import { describe, it, expect } from 'vitest';
import { extractSearchTokens, rareTokenBoost, getSynonyms, buildSynonymLookup } from './similar-search';

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

  it('한글 토큰이 영어로만 쓰인 후보와도 동의어로 매칭돼 가중치를 받는다', () => {
    const boost = rareTokenBoost('A trigger is a stored procedure that runs automatically', ['트리거'], {
      트리거: 2,
    });
    expect(boost).toBeGreaterThan(0);
  });
});

describe('getSynonyms', () => {
  it('한글 CS 용어에 대응하는 영어 동의어를 함께 반환한다', () => {
    expect(getSynonyms('트리거')).toEqual(expect.arrayContaining(['트리거', 'trigger']));
  });

  it('영어 입력도 대소문자 구분 없이 같은 그룹을 반환한다', () => {
    expect(getSynonyms('Trigger')).toEqual(expect.arrayContaining(['트리거', 'trigger']));
  });

  it('사전에 없는 토큰은 자기 자신만 담긴 배열을 반환한다', () => {
    expect(getSynonyms('데이터베이스')).toEqual(['데이터베이스']);
  });
});

describe('buildSynonymLookup', () => {
  it('추가 그룹을 기본 사전과 합쳐서 조회할 수 있다', () => {
    const lookup = buildSynonymLookup([['데이터베이스', 'db', 'database']]);
    expect(getSynonyms('데이터베이스', lookup)).toEqual(
      expect.arrayContaining(['데이터베이스', 'db', 'database'])
    );
    expect(getSynonyms('database', lookup)).toEqual(
      expect.arrayContaining(['데이터베이스', 'db', 'database'])
    );
  });

  it('영어 용어는 대소문자 구분 없이 같은 그룹으로 조회된다', () => {
    const lookup = buildSynonymLookup([['데이터베이스', 'db']]);
    expect(getSynonyms('DB', lookup)).toEqual(expect.arrayContaining(['데이터베이스', 'db']));
  });

  it('추가 그룹 없이 호출하면 기본 사전과 동일하게 동작한다', () => {
    const lookup = buildSynonymLookup();
    expect(getSynonyms('트리거', lookup)).toEqual(expect.arrayContaining(['트리거', 'trigger']));
  });
});
