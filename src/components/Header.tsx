'use client';

import Link from 'next/link';
import { useSession, signIn, signOut } from 'next-auth/react';
import NotificationBell from './NotificationBell';

export default function Header() {
  const { data: session } = useSession();
  const user = session?.user;

  return (
    <header className="border-b border-neutral-800 bg-[#0a0a0a]">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 flex items-center justify-between h-14">
        <Link href="/" className="text-white font-semibold text-sm tracking-tight">
          CS Quiz
        </Link>

        <nav className="flex items-center gap-6">
          <Link
            href="/quiz"
            className="text-sm text-neutral-400 hover:text-white transition-colors"
          >
            퀴즈
          </Link>
          <Link
            href="/board"
            className="text-sm text-neutral-400 hover:text-white transition-colors"
          >
            게시판
          </Link>
        </nav>

        <div className="flex items-center gap-3">
          {user ? (
            <>
              <NotificationBell />
              <Link
                href="/mypage"
                className="text-sm text-neutral-300 hover:text-white transition-colors"
              >
                {user.nickname ?? user.name ?? '사용자'}
              </Link>
              <button
                onClick={() => signOut({ callbackUrl: '/' })}
                className="rounded-md border border-neutral-700 text-sm text-neutral-300 px-3 py-1.5 hover:border-neutral-500 hover:text-white transition-colors"
              >
                로그아웃
              </button>
            </>
          ) : (
            <button
              onClick={() => signIn('google')}
              className="rounded-md bg-white text-black text-sm font-medium px-4 py-1.5 hover:bg-neutral-200 transition-colors"
            >
              로그인
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
