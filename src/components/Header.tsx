'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useSession, signIn, signOut } from 'next-auth/react';
import { useQuery } from '@tanstack/react-query';
import NotificationBell from './NotificationBell';

function AdminBadge() {
  const { data } = useQuery<{ newTotal: number }>({
    queryKey: ['admin', 'badge'],
    queryFn: () => fetch('/api/admin/badge').then((r) => r.json()),
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  if (!data || data.newTotal === 0) return null;

  return (
    <span className="absolute -top-1 -right-1 min-w-[16px] h-4 rounded-full bg-red-500 text-[10px] font-bold text-white flex items-center justify-center px-1 leading-none">
      {data.newTotal > 9 ? '9+' : data.newTotal}
    </span>
  );
}

export default function Header() {
  const { data: session, status } = useSession();
  const user = session?.user;
  const [menuOpen, setMenuOpen] = useState(false);

  function closeMenu() { setMenuOpen(false); }

  return (
    <>
      <header className="border-b border-neutral-800 bg-[#0a0a0a] sticky top-0 z-40">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 flex items-center justify-between h-14">
          <Link href="/" className="text-white font-semibold text-sm tracking-tight flex-shrink-0">
            CS Quiz
          </Link>

          <nav className="hidden sm:flex items-center gap-6">
            <Link href="/quiz" className="text-sm text-neutral-400 hover:text-white transition-colors">
              퀴즈
            </Link>
            <Link href="/board" className="text-sm text-neutral-400 hover:text-white transition-colors">
              게시판
            </Link>
            <Link href="/friends" className="text-sm text-neutral-400 hover:text-white transition-colors">
              친구
            </Link>
            <Link href="/inquiry" className="text-sm text-neutral-400 hover:text-white transition-colors">
              문의
            </Link>
          </nav>

          <div className="flex items-center gap-2 flex-shrink-0">
            {status === 'loading' ? (
              <div className="w-20 h-7 rounded bg-neutral-800 animate-pulse" />
            ) : user ? (
              <>
                <NotificationBell />
                {user.role === 'ADMIN' && (
                  <Link
                    href="/admin"
                    className="hidden sm:block relative rounded-md border border-amber-500/40 text-xs text-amber-400 px-3 py-1.5 hover:border-amber-400 hover:text-amber-300 transition-colors"
                  >
                    관리자
                    <AdminBadge />
                  </Link>
                )}
                <Link
                  href="/mypage"
                  className="hidden sm:block text-sm text-neutral-300 hover:text-white transition-colors px-2 py-1"
                >
                  {user.nickname ?? user.name ?? '사용자'}
                </Link>
                <button
                  onClick={() => signOut({ callbackUrl: '/' })}
                  className="hidden sm:block rounded-md border border-neutral-700 text-xs text-neutral-400 px-3 py-1.5 hover:border-neutral-500 hover:text-white transition-colors"
                >
                  로그아웃
                </button>
                <button
                  onClick={() => setMenuOpen(true)}
                  className="sm:hidden p-2 -mr-1 text-neutral-400 hover:text-white transition-colors"
                  aria-label="메뉴 열기"
                >
                  <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 12h18M3 6h18M3 18h18" />
                  </svg>
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => signIn('google')}
                  className="flex items-center gap-2 rounded-md bg-white text-black text-sm font-medium px-4 py-1.5 hover:bg-neutral-200 transition-colors"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                  </svg>
                  Google로 로그인
                </button>
                <button
                  onClick={() => setMenuOpen(true)}
                  className="sm:hidden p-2 -mr-1 text-neutral-400 hover:text-white transition-colors"
                  aria-label="메뉴 열기"
                >
                  <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 12h18M3 6h18M3 18h18" />
                  </svg>
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* 모바일 전체화면 메뉴 */}
      {menuOpen && (
        <div className="fixed inset-0 bg-[#0a0a0a] z-50 flex flex-col sm:hidden">
          <div className="flex items-center justify-between px-4 h-14 border-b border-neutral-800 flex-shrink-0">
            <Link href="/" onClick={closeMenu} className="text-white font-semibold text-sm tracking-tight">
              CS Quiz
            </Link>
            <button
              onClick={closeMenu}
              className="p-2 -mr-1 text-neutral-400 hover:text-white transition-colors"
              aria-label="메뉴 닫기"
            >
              <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>

          <nav className="flex flex-col px-6 py-8 gap-6">
            <Link href="/quiz" onClick={closeMenu} className="text-lg text-neutral-300 hover:text-white transition-colors">
              퀴즈
            </Link>
            <Link href="/board" onClick={closeMenu} className="text-lg text-neutral-300 hover:text-white transition-colors">
              게시판
            </Link>
            <Link href="/friends" onClick={closeMenu} className="text-lg text-neutral-300 hover:text-white transition-colors">
              친구
            </Link>
            <Link href="/inquiry" onClick={closeMenu} className="text-lg text-neutral-300 hover:text-white transition-colors">
              문의
            </Link>
            {user?.role === 'ADMIN' && (
              <Link href="/admin" onClick={closeMenu} className="text-lg text-amber-400 hover:text-amber-300 transition-colors">
                관리자 패널
              </Link>
            )}
          </nav>

          {user && (
            <div className="mt-auto px-6 pb-10 pt-6 border-t border-neutral-800 flex flex-col gap-4">
              <Link
                href="/mypage"
                onClick={closeMenu}
                className="text-base text-neutral-300 hover:text-white transition-colors"
              >
                {user.nickname ?? user.name ?? '사용자'} (마이페이지)
              </Link>
              <button
                onClick={() => { closeMenu(); signOut({ callbackUrl: '/' }); }}
                className="text-left text-base text-neutral-500 hover:text-white transition-colors"
              >
                로그아웃
              </button>
            </div>
          )}
        </div>
      )}
    </>
  );
}
