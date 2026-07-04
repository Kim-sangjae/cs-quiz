'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

export default function AuthorSearchBar() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [value, setValue] = useState('');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = value.trim();
    if (!trimmed) return;
    const params = new URLSearchParams(searchParams.toString());
    params.set('author', trimmed);
    params.delete('page');
    router.push(`/board?${params.toString()}`);
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-1.5">
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="출제자 닉네임 또는 이메일 검색"
        className="flex-1 rounded-md border border-neutral-800 bg-[#1a1a1a] px-3 py-2 text-sm text-neutral-200 placeholder-neutral-600 focus:outline-none focus:border-neutral-600"
      />
      <button
        type="submit"
        disabled={!value.trim()}
        className="rounded-md border border-neutral-700 px-3 py-2 text-xs text-neutral-400 hover:text-white hover:border-neutral-500 disabled:opacity-30 disabled:cursor-not-allowed transition-colors flex-shrink-0"
      >
        검색
      </button>
    </form>
  );
}
