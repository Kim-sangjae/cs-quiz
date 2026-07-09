'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { signIn } from 'next-auth/react';
import { toast } from 'sonner';
import Link from 'next/link';

function LoginContent() {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get('callbackUrl') ?? '/';
  const [devNickname, setDevNickname] = useState('');
  const [isKakaoWebView, setIsKakaoWebView] = useState(false);

  useEffect(() => {
    if (callbackUrl !== '/') {
      toast('로그인이 필요한 서비스입니다.', { id: 'auth-required' });
    }
  }, [callbackUrl]);

  useEffect(() => {
    const ua = navigator.userAgent;
    setIsKakaoWebView(/KAKAOTALK/i.test(ua) || /kakaotalk/i.test(ua));
  }, []);

  return (
    <div className="w-full max-w-sm">
      <Link href="/" className="text-xs text-neutral-600 hover:text-neutral-400 transition-colors mb-8 inline-block">← 홈으로</Link>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white mb-1.5">CSORA</h1>
        <p className="text-sm text-neutral-500">
          로그인하면 풀이 기록, 오답 복습, 친구 대결을 이용할 수 있습니다.
        </p>
      </div>
      {isKakaoWebView && (
        <div className="mb-4 rounded-lg border border-amber-800/50 bg-amber-950/30 px-4 py-3">
          <p className="text-xs text-amber-400 leading-relaxed">
            카카오톡 앱 내 브라우저에서는 구글 로그인이 제한됩니다.
            우측 상단 메뉴(⋮) → <strong>기본 브라우저로 열기</strong>를 선택 후 로그인해주세요.
            카카오 로그인은 바로 이용 가능합니다.
          </p>
        </div>
      )}
      <div className="flex flex-col gap-3">
        <button
          onClick={() => signIn('google', { callbackUrl })}
          disabled={isKakaoWebView}
          className="w-full flex items-center justify-center gap-3 rounded-lg bg-white text-black text-sm font-medium px-6 py-3 hover:bg-neutral-200 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          Google로 계속하기
        </button>
        <button
          onClick={() => signIn('kakao', { callbackUrl })}
          className="w-full flex items-center justify-center gap-3 rounded-lg text-black text-sm font-medium px-6 py-3 hover:opacity-90 transition-opacity"
          style={{ backgroundColor: '#FEE500' }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path fillRule="evenodd" clipRule="evenodd" d="M12 3C7.029 3 3 6.355 3 10.5c0 2.627 1.63 4.938 4.08 6.27l-1.04 3.867c-.09.337.29.607.582.411L11.1 18.44A10.57 10.57 0 0 0 12 18.5c4.971 0 9-3.355 9-7.5S16.971 3 12 3z" fill="#3A1D1D"/>
          </svg>
          카카오로 계속하기
        </button>
      </div>
      {process.env.NODE_ENV === 'development' && (
        <div className="mt-6 pt-5 border-t border-neutral-800">
          <p className="text-xs text-neutral-600 mb-2">DEV — 닉네임으로 바로 로그인</p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (devNickname.trim()) signIn('dev-credentials', { nickname: devNickname.trim(), callbackUrl });
            }}
            className="flex gap-2"
          >
            <input
              type="text"
              value={devNickname}
              onChange={(e) => setDevNickname(e.target.value)}
              placeholder="닉네임 (예: user12)"
              className="flex-1 bg-neutral-900 text-white text-sm px-3 py-2 rounded border border-neutral-700 focus:outline-none focus:border-neutral-500"
            />
            <button type="submit" className="text-sm px-3 py-2 rounded bg-neutral-700 text-white hover:bg-neutral-600">
              입장
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center px-4">
      <Suspense>
        <LoginContent />
      </Suspense>
    </div>
  );
}
