// 페이징 번호 목록 계산 (첫/끝 페이지 + 현재 페이지 주변 + 말줄임표)

export type PageItem = number | '…';

export function buildPageList(current: number, pageCount: number, siblingCount = 1): PageItem[] {
  const totalNumbers = siblingCount * 2 + 5;

  if (pageCount <= totalNumbers) {
    return Array.from({ length: pageCount }, (_, i) => i + 1);
  }

  const leftSibling = Math.max(current - siblingCount, 1);
  const rightSibling = Math.min(current + siblingCount, pageCount);
  const showLeftEllipsis = leftSibling > 2;
  const showRightEllipsis = rightSibling < pageCount - 1;

  if (!showLeftEllipsis && showRightEllipsis) {
    const leftCount = 3 + siblingCount * 2;
    const leftRange = Array.from({ length: leftCount }, (_, i) => i + 1);
    return [...leftRange, '…', pageCount];
  }

  if (showLeftEllipsis && !showRightEllipsis) {
    const rightCount = 3 + siblingCount * 2;
    const rightRange = Array.from({ length: rightCount }, (_, i) => pageCount - rightCount + 1 + i);
    return [1, '…', ...rightRange];
  }

  const middleRange = Array.from({ length: rightSibling - leftSibling + 1 }, (_, i) => leftSibling + i);
  return [1, '…', ...middleRange, '…', pageCount];
}
