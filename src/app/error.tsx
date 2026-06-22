'use client';

import { useEffect } from 'react';
import Link from 'next/link';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    fetch('/api/errors', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        statusCode: 500,
        errorCode: error.name ?? 'RUNTIME_ERROR',
        message: error.message ?? '알 수 없는 오류가 발생했습니다.',
        path: typeof window !== 'undefined' ? window.location.pathname : null,
        digest: error.digest ?? null,
      }),
    }).catch(() => {});
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="text-center space-y-5">
        <div className="mx-auto w-14 h-14 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center">
          <svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="text-red-400">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
        </div>
        <div>
          <p className="text-lg font-semibold text-white mb-1">오류가 발생했습니다</p>
          <p className="text-sm text-neutral-500">잠시 후 다시 시도하거나 홈으로 이동해주세요.</p>
          {error.digest && (
            <p className="text-xs text-neutral-700 mt-2 font-mono">오류 코드: {error.digest}</p>
          )}
        </div>
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={reset}
            className="rounded-lg border border-neutral-700 text-neutral-300 text-sm px-4 py-2 hover:text-white hover:border-neutral-500 transition-colors"
          >
            다시 시도
          </button>
          <Link
            href="/"
            className="rounded-lg bg-white text-black text-sm font-semibold px-5 py-2 hover:bg-neutral-200 transition-colors"
          >
            홈으로
          </Link>
        </div>
      </div>
    </div>
  );
}
