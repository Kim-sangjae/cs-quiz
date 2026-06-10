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

const STATUSES = [
  { value: 'all', label: '전체' },
  { value: 'pending', label: '등록요청' },
  { value: 'approved', label: '승인' },
] as const;

const SORTS = [
  { value: 'newest', label: '최신순' },
  { value: 'accuracy_asc', label: '정답률 낮은순' },
  { value: 'accuracy_desc', label: '정답률 높은순' },
  { value: 'likes', label: '좋아요순' },
] as const;

export default function FilterBar() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const cat = searchParams.get('cat') ?? 'all';
  const status = searchParams.get('status') ?? 'all';
  const sort = searchParams.get('sort') ?? 'newest';

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

      <div className="flex flex-wrap gap-3">
        <div className="flex gap-1.5">
          {STATUSES.map((s) => (
            <button
              key={s.value}
              onClick={() => update('status', s.value)}
              className={`rounded px-3 py-1 text-xs transition-colors ${
                status === s.value
                  ? 'border border-neutral-500 text-white'
                  : 'border border-neutral-800 text-neutral-500 hover:border-neutral-600 hover:text-neutral-300'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>

        <div className="ml-auto flex gap-1.5">
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
