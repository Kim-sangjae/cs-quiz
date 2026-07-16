'use client';

import { buildPageList } from '@/lib/pagination';

interface PaginationNavProps {
  /** 1-indexed 현재 페이지 */
  page: number;
  pageCount: number;
  /** 1-indexed 페이지를 받는 콜백 */
  onChange: (page: number) => void;
}

export default function PaginationNav({ page, pageCount, onChange }: PaginationNavProps) {
  if (pageCount <= 1) return null;

  const pages = buildPageList(page, pageCount, 2);
  const arrowBtn =
    'flex items-center justify-center w-8 h-8 rounded-full border border-neutral-700 text-neutral-400 hover:border-neutral-500 hover:text-white disabled:opacity-25 disabled:hover:border-neutral-700 disabled:hover:text-neutral-400 transition-colors flex-shrink-0';

  return (
    <div className="flex items-center justify-center gap-4">
      <button className={arrowBtn} onClick={() => onChange(page - 1)} disabled={page <= 1} aria-label="이전 페이지">
        <svg width={14} height={14} viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
          <path d="M8 2.5L3.5 7L8 11.5" />
        </svg>
      </button>

      <div className="flex items-center gap-3">
        {pages.map((p, i) =>
          p === '…' ? (
            <span key={`e${i}`} className="text-sm text-neutral-600 select-none">
              …
            </span>
          ) : (
            <button
              key={p}
              onClick={() => onChange(p)}
              className={
                p === page
                  ? 'text-sm font-semibold text-emerald-400 tabular-nums'
                  : 'text-sm text-neutral-500 hover:text-white tabular-nums transition-colors'
              }
            >
              {p}
            </button>
          )
        )}
      </div>

      <button className={arrowBtn} onClick={() => onChange(page + 1)} disabled={page >= pageCount} aria-label="다음 페이지">
        <svg width={14} height={14} viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 2.5l4.5 4.5-4.5 4.5" />
        </svg>
      </button>
    </div>
  );
}
