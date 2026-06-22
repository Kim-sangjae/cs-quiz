'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';

export default function NotFound() {
  const pathname = usePathname();

  useEffect(() => {
    fetch('/api/errors', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        statusCode: 404,
        errorCode: 'NOT_FOUND',
        message: '페이지를 찾을 수 없습니다.',
        path: pathname,
      }),
    }).catch(() => {});
  }, [pathname]);

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="text-center space-y-5">
        <div className="mx-auto w-14 h-14 rounded-full bg-neutral-800 border border-neutral-700 flex items-center justify-center">
          <svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="text-neutral-400">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
            <line x1="11" y1="8" x2="11" y2="12" />
            <line x1="11" y1="16" x2="11.01" y2="16" />
          </svg>
        </div>
        <div>
          <p className="text-4xl font-bold text-white mb-2">404</p>
          <p className="text-base text-neutral-400">페이지를 찾을 수 없습니다.</p>
          <p className="text-sm text-neutral-600 mt-1">요청하신 주소가 존재하지 않거나 이동되었습니다.</p>
        </div>
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 rounded-lg bg-white text-black text-sm font-semibold px-5 py-2.5 hover:bg-neutral-200 transition-colors"
        >
          홈으로
        </Link>
      </div>
    </div>
  );
}
