'use client';

interface PaginationNavProps {
  /** 1-indexed 현재 페이지 */
  page: number;
  pageCount: number;
  /** 1-indexed 페이지를 받는 콜백 */
  onChange: (page: number) => void;
  jump?: number;
}

export default function PaginationNav({ page, pageCount, onChange, jump = 5 }: PaginationNavProps) {
  if (pageCount <= 1) return null;

  const clamp = (p: number) => Math.min(pageCount, Math.max(1, p));
  const btnNav =
    'rounded-md border border-neutral-800 text-xs text-neutral-400 px-2 py-1.5 hover:border-neutral-600 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors';

  return (
    <div className="flex items-center justify-center gap-1">
      <button className={btnNav} onClick={() => onChange(1)} disabled={page <= 1} aria-label="맨 앞으로">
        «
      </button>
      <button
        className={btnNav}
        onClick={() => onChange(clamp(page - jump))}
        disabled={page <= 1}
        aria-label={`${jump}페이지 이전`}
      >
        ‹{jump}
      </button>
      <button className={btnNav} onClick={() => onChange(clamp(page - 1))} disabled={page <= 1} aria-label="이전 페이지">
        ‹
      </button>
      <span className="text-xs text-neutral-500 px-2 whitespace-nowrap">
        {page} / {pageCount}
      </span>
      <button
        className={btnNav}
        onClick={() => onChange(clamp(page + 1))}
        disabled={page >= pageCount}
        aria-label="다음 페이지"
      >
        ›
      </button>
      <button
        className={btnNav}
        onClick={() => onChange(clamp(page + jump))}
        disabled={page >= pageCount}
        aria-label={`${jump}페이지 다음`}
      >
        {jump}›
      </button>
      <button className={btnNav} onClick={() => onChange(pageCount)} disabled={page >= pageCount} aria-label="맨 뒤로">
        »
      </button>
    </div>
  );
}
