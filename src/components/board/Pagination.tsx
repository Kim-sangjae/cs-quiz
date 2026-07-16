'use client';

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useCallback } from 'react';

interface PaginationProps {
  currentPage: number;
  pageCount: number;
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
    <span className="flex -space-x-2">
      {icon}
      {icon}
    </span>
  );
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

  const btn =
    'flex items-center justify-center w-8 h-8 rounded-md text-neutral-500 hover:text-white hover:bg-neutral-800 disabled:opacity-25 disabled:hover:bg-transparent disabled:hover:text-neutral-500 transition-colors';
  const pageBtnDefault = 'w-8 h-8 rounded-md text-xs font-medium text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors flex items-center justify-center';
  const pageBtnActive = 'w-8 h-8 rounded-md text-xs font-semibold bg-white text-black flex items-center justify-center';

  return (
    <div className="inline-flex items-center gap-0.5 rounded-lg border border-neutral-800 bg-neutral-900/50 p-1">
      <button className={btn} onClick={() => goTo(1)} disabled={currentPage <= 1} aria-label="맨 앞으로">
        <Chevron direction="left" double />
      </button>
      <button className={btn} onClick={() => goTo(currentPage - 1)} disabled={currentPage <= 1} aria-label="이전 페이지">
        <Chevron direction="left" />
      </button>

      {pages.map((p) => (
        <button
          key={p}
          onClick={() => goTo(p)}
          className={p === currentPage ? pageBtnActive : pageBtnDefault}
        >
          {p}
        </button>
      ))}

      <button className={btn} onClick={() => goTo(currentPage + 1)} disabled={currentPage >= pageCount} aria-label="다음 페이지">
        <Chevron direction="right" />
      </button>
      <button className={btn} onClick={() => goTo(pageCount)} disabled={currentPage >= pageCount} aria-label="맨 뒤로">
        <Chevron direction="right" double />
      </button>
    </div>
  );
}
