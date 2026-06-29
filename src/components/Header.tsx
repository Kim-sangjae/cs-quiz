'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
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

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export default function Header() {
  const { data: session, status } = useSession();
  const user = session?.user;
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  async function handleInstall() {
    if (!installPrompt) return;
    await installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === 'accepted') setInstallPrompt(null);
  }

  useEffect(() => {
    if (status !== 'authenticated') return;
    const ping = () => fetch('/api/presence/heartbeat', { method: 'POST' }).catch(() => {});
    ping();
    const id = setInterval(ping, 15_000);
    return () => clearInterval(id);
  }, [status]);

  function closeMenu() { setMenuOpen(false); }

  return (
    <>
      <header className="border-b border-neutral-800 bg-[#0a0a0a] sticky top-0 z-40">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 flex items-center justify-between h-14">
          <Link href="/" className="text-white font-semibold text-sm tracking-tight flex-shrink-0">
            CSORA
          </Link>

          <nav className="hidden sm:flex items-center gap-6">
            <Link href="/about" className="text-sm text-neutral-400 hover:text-white transition-colors">
              소개
            </Link>
            <Link href="/quiz" className="text-sm text-neutral-400 hover:text-white transition-colors">
              퀴즈
            </Link>
            <Link href="/board" className="text-sm text-neutral-400 hover:text-white transition-colors">
              게시판
            </Link>
            <Link href="/inquiry" className="text-sm text-neutral-400 hover:text-white transition-colors">
              문의
            </Link>
          </nav>

          <div className="flex items-center gap-2 flex-shrink-0">
            {installPrompt && (
              <button
                onClick={handleInstall}
                className="hidden sm:flex items-center gap-1.5 rounded-md border border-neutral-700 text-xs text-neutral-400 px-3 py-1.5 hover:border-neutral-500 hover:text-white transition-colors"
                title="앱 설치"
              >
                <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                </svg>
                앱 설치
              </button>
            )}
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
                  onClick={() => router.push('/auth/login')}
                  className="rounded-md bg-white text-black text-sm font-medium px-4 py-1.5 hover:bg-neutral-200 transition-colors"
                >
                  로그인
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
              CSORA
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
            {user && (
              <Link href="/friends" onClick={closeMenu} className="text-lg text-neutral-300 hover:text-white transition-colors">
                친구
              </Link>
            )}
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
