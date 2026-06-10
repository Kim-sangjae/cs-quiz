'use client';

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';

export default function SearchBar() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [value, setValue] = useState(searchParams.get('q') ?? '');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setValue(searchParams.get('q') ?? '');
  }, [searchParams]);

  const updateUrl = useCallback(
    (q: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (q) {
        params.set('q', q);
      } else {
        params.delete('q');
      }
      params.set('page', '1');
      router.push(`${pathname}?${params.toString()}`);
    },
    [router, pathname, searchParams]
  );

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const next = e.target.value;
    setValue(next);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => updateUrl(next), 300);
  }

  function handleClear() {
    setValue('');
    if (timerRef.current) clearTimeout(timerRef.current);
    updateUrl('');
  }

  return (
    <div className="relative">
      <input
        type="text"
        value={value}
        onChange={handleChange}
        placeholder="문제 키워드 검색..."
        className="w-full rounded-md border border-neutral-800 bg-[#111111] px-4 py-2.5 text-sm text-white placeholder-neutral-500 focus:border-neutral-600 focus:outline-none transition-colors pr-9"
      />
      {value && (
        <button
          onClick={handleClear}
          aria-label="검색어 지우기"
          className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-300 transition-colors"
        >
          <svg width={14} height={14} viewBox="0 0 14 14" fill="none" strokeWidth={1.5} stroke="currentColor">
            <path d="M1 1l12 12M13 1L1 13" />
          </svg>
        </button>
      )}
    </div>
  );
}
