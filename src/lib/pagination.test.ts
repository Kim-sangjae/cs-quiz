import { describe, it, expect } from 'vitest';
import { buildPageList } from './pagination';

describe('buildPageList', () => {
  it('전체 페이지 수가 적으면 전부 나열한다', () => {
    expect(buildPageList(1, 5)).toEqual([1, 2, 3, 4, 5]);
    expect(buildPageList(3, 7)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it('현재 페이지가 앞쪽이면 왼쪽 말줄임표 없이 뒤쪽만 생략한다', () => {
    expect(buildPageList(1, 20)).toEqual([1, 2, 3, 4, 5, '…', 20]);
    expect(buildPageList(2, 20)).toEqual([1, 2, 3, 4, 5, '…', 20]);
  });

  it('현재 페이지가 뒤쪽이면 오른쪽 말줄임표 없이 앞쪽만 생략한다', () => {
    expect(buildPageList(20, 20)).toEqual([1, '…', 16, 17, 18, 19, 20]);
    expect(buildPageList(19, 20)).toEqual([1, '…', 16, 17, 18, 19, 20]);
  });

  it('현재 페이지가 중간이면 양쪽 다 말줄임표로 생략한다', () => {
    expect(buildPageList(10, 20)).toEqual([1, '…', 9, 10, 11, '…', 20]);
  });

  it('siblingCount를 늘리면 현재 페이지 주변 범위가 넓어진다', () => {
    expect(buildPageList(10, 20, 2)).toEqual([1, '…', 8, 9, 10, 11, 12, '…', 20]);
  });
});
