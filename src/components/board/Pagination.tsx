'use client';

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useCallback } from 'react';

interface PaginationProps {
  currentPage: number;
  pageCount: number;
}

export default function Pagination({ currentPage, pageCount }: PaginationProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const goTo = useCallback(
    (page: number) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set('page', String(page));
      router.push(`${pathname}?${params.toString()}`);
    },
    [router, pathname, searchParams]
  );

  if (pageCount <= 1) return null;

  const half = 2;
  let start = Math.max(1, currentPage - half);
  const end = Math.min(pageCount, start + 4);
  start = Math.max(1, end - 4);

  const pages = [];
  for (let i = start; i <= end; i++) pages.push(i);

  const btnBase =
    'w-10 h-10 rounded text-xs font-medium transition-colors flex items-center justify-center';
  const btnDefault = 'bg-neutral-900 text-neutral-400 hover:bg-neutral-800 hover:text-white border border-neutral-800';
  const btnActive = 'bg-white text-black';
  const btnNav =
    'rounded-md border border-neutral-800 text-sm text-neutral-400 px-3 py-1.5 hover:border-neutral-600 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors';

  const jump = 5;

  return (
    <div className="flex items-center justify-center gap-1.5">
      <button className={btnNav} onClick={() => goTo(1)} disabled={currentPage <= 1} aria-label="맨 앞으로">
        «
      </button>
      <button
        className={btnNav}
        onClick={() => goTo(Math.max(1, currentPage - jump))}
        disabled={currentPage <= 1}
        aria-label={`${jump}페이지 이전`}
      >
        ‹{jump}
      </button>
      <button
        className={btnNav}
        onClick={() => goTo(currentPage - 1)}
        disabled={currentPage <= 1}
      >
        <svg width={14} height={14} viewBox="0 0 14 14" fill="none" strokeWidth={1.5} stroke="currentColor">
          <path d="M9 1L3 7l6 6" />
        </svg>
      </button>

      {pages.map((p) => (
        <button
          key={p}
          onClick={() => goTo(p)}
          className={`${btnBase} ${p === currentPage ? btnActive : btnDefault}`}
        >
          {p}
        </button>
      ))}

      <button
        className={btnNav}
        onClick={() => goTo(currentPage + 1)}
        disabled={currentPage >= pageCount}
      >
        <svg width={14} height={14} viewBox="0 0 14 14" fill="none" strokeWidth={1.5} stroke="currentColor">
          <path d="M5 1l6 6-6 6" />
        </svg>
      </button>
      <button
        className={btnNav}
        onClick={() => goTo(Math.min(pageCount, currentPage + jump))}
        disabled={currentPage >= pageCount}
        aria-label={`${jump}페이지 다음`}
      >
        {jump}›
      </button>
      <button className={btnNav} onClick={() => goTo(pageCount)} disabled={currentPage >= pageCount} aria-label="맨 뒤로">
        »
      </button>
    </div>
  );
}
