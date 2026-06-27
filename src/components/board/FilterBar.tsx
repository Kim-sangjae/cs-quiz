'use client';

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useCallback } from 'react';

const CATEGORIES = [
  { value: 'all', label: '전체' },
  { value: 'ds', label: '자료구조' },
  { value: 'algo', label: '알고리즘' },
  { value: 'os', label: 'OS' },
  { value: 'network', label: '네트워크' },
  { value: 'db', label: 'DB' },
  { value: 'arch', label: '컴퓨터구조' },
] as const;

const SORTS = [
  { value: 'newest', label: '최신순' },
  { value: 'accuracy_asc', label: '정답률 낮은순' },
  { value: 'accuracy_desc', label: '정답률 높은순' },
  { value: 'likes', label: '좋아요순' },
] as const;

export default function FilterBar({ isLoggedIn = false }: { isLoggedIn?: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const cat = searchParams.get('cat') ?? 'all';
  const sort = searchParams.get('sort') ?? 'newest';
  const untried = searchParams.get('untried') === '1';

  const update = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set(key, value);
      params.set('page', '1');
      router.push(`${pathname}?${params.toString()}`);
    },
    [router, pathname, searchParams]
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-1.5">
        {CATEGORIES.map((c) => (
          <button
            key={c.value}
            onClick={() => update('cat', c.value)}
            className={`rounded px-3 py-1 text-xs font-medium transition-colors ${
              cat === c.value
                ? 'bg-white text-black'
                : 'bg-neutral-900 text-neutral-400 hover:bg-neutral-800 hover:text-white border border-neutral-800'
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-x-3 gap-y-2">
        <div className="flex gap-1.5">
          {isLoggedIn && (
            <button
              onClick={() => update('untried', untried ? '0' : '1')}
              className={`rounded px-3 py-1 text-xs transition-colors ${
                untried
                  ? 'border border-neutral-500 text-white'
                  : 'border border-neutral-800 text-neutral-500 hover:border-neutral-600 hover:text-neutral-300'
              }`}
            >
              미도전
            </button>
          )}
        </div>

        <div className="flex gap-1.5 sm:ml-auto">
          {SORTS.map((s) => (
            <button
              key={s.value}
              onClick={() => update('sort', s.value)}
              className={`rounded px-3 py-1 text-xs transition-colors ${
                sort === s.value
                  ? 'border border-neutral-500 text-white'
                  : 'border border-neutral-800 text-neutral-500 hover:border-neutral-600 hover:text-neutral-300'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
