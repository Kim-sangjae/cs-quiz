'use client';

interface PaginationNavProps {
  /** 1-indexed 현재 페이지 */
  page: number;
  pageCount: number;
  /** 1-indexed 페이지를 받는 콜백 */
  onChange: (page: number) => void;
}

function Chevron({ direction, double }: { direction: 'left' | 'right'; double?: boolean }) {
  const d = direction === 'left' ? 'M8 2.5L3.5 7L8 11.5' : 'M6 2.5l4.5 4.5-4.5 4.5';
  const icon = (
    <svg width={14} height={14} viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  );
  if (!double) return icon;
  return (
    <span className={`flex ${direction === 'left' ? '-space-x-2' : '-space-x-2'}`}>
      {icon}
      {icon}
    </span>
  );
}

export default function PaginationNav({ page, pageCount, onChange }: PaginationNavProps) {
  if (pageCount <= 1) return null;

  const clamp = (p: number) => Math.min(pageCount, Math.max(1, p));
  const btn =
    'flex items-center justify-center w-8 h-8 rounded-md text-neutral-500 hover:text-white hover:bg-neutral-800 disabled:opacity-25 disabled:hover:bg-transparent disabled:hover:text-neutral-500 transition-colors';

  return (
    <div className="inline-flex items-center gap-0.5 rounded-lg border border-neutral-800 bg-neutral-900/50 p-1">
      <button className={btn} onClick={() => onChange(1)} disabled={page <= 1} aria-label="맨 앞으로">
        <Chevron direction="left" double />
      </button>
      <button className={btn} onClick={() => onChange(clamp(page - 1))} disabled={page <= 1} aria-label="이전 페이지">
        <Chevron direction="left" />
      </button>
      <span className="min-w-[56px] text-center text-xs font-medium text-neutral-300 tabular-nums px-1">
        {page}
        <span className="text-neutral-600"> / </span>
        {pageCount}
      </span>
      <button className={btn} onClick={() => onChange(clamp(page + 1))} disabled={page >= pageCount} aria-label="다음 페이지">
        <Chevron direction="right" />
      </button>
      <button className={btn} onClick={() => onChange(pageCount)} disabled={page >= pageCount} aria-label="맨 뒤로">
        <Chevron direction="right" double />
      </button>
    </div>
  );
}
