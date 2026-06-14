'use client';

import { useSession, signOut } from 'next-auth/react';
import { useEffect, useRef, useState } from 'react';

export default function SessionGuard() {
  const { status } = useSession();
  const prevStatus = useRef<string>('loading');
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (prevStatus.current === 'authenticated' && status === 'unauthenticated') {
      // 서버가 살아있을 때만 표시 (서버 다운이면 네트워크 에러로 catch)
      fetch('/api/auth/session')
        .then(() => setShow(true))
        .catch(() => { /* 서버 다운 — 모달 표시 안 함 */ });
    }
    prevStatus.current = status;
  }, [status]);

  if (!show) return null;

  return (
    <div className="fixed inset-0 bg-black/80 z-[200] flex items-center justify-center p-4">
      <div className="bg-[#111111] border border-neutral-700 rounded-lg p-6 w-full max-w-sm text-center shadow-xl">
        <div className="mb-4">
          <svg className="mx-auto mb-3 text-amber-400" width={32} height={32} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          </svg>
          <p className="text-white font-semibold text-base mb-1">권한이 변경되었습니다</p>
          <p className="text-sm text-neutral-400">계속 사용하려면 다시 로그인이 필요합니다.</p>
        </div>
        <button
          onClick={() => signOut({ callbackUrl: '/' })}
          className="w-full rounded-md bg-white text-black text-sm font-medium px-6 py-2.5 hover:bg-neutral-200 transition-colors"
        >
          확인 (재로그인)
        </button>
      </div>
    </div>
  );
}
