import NextAuth from 'next-auth';
import { authConfig } from '@/lib/auth.config';
import { NextResponse } from 'next/server';

const { auth } = NextAuth(authConfig);

const PROTECTED = ['/quiz', '/mypage', '/settings', '/board/submit', '/admin', '/inquiry', '/battle', '/friends'];

export default auth((req) => {
  const { pathname } = req.nextUrl;

  // /quiz/play는 비로그인 접근 허용 (OG 스크래핑 + sharedFrom 공유 지원)
  if (pathname === '/quiz/play') return NextResponse.next();

  const needsLogin = PROTECTED.some(
    (p) => pathname === p || pathname.startsWith(p + '/')
  );

  if (!needsLogin) return NextResponse.next();

  const token = req.auth;

  if (!token?.user) {
    const url = new URL('/auth/login', req.url);
    url.searchParams.set('callbackUrl', req.nextUrl.href);
    return NextResponse.redirect(url);
  }

  if (!token.user.nickname) {
    const url = new URL('/auth/setup-nickname', req.url);
    url.searchParams.set('callbackUrl', req.nextUrl.href);
    return NextResponse.redirect(url);
  }

  if (
    (pathname === '/admin' || pathname.startsWith('/admin/')) &&
    token.user.role !== 'ADMIN'
  ) {
    return NextResponse.redirect(new URL('/', req.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    '/quiz',
    '/quiz/:path*',
    '/mypage',
    '/mypage/:path*',
    '/settings',
    '/admin',
    '/admin/:path*',
    '/board/submit',
    '/board/submit/:path*',
    '/inquiry',
    '/inquiry/:path*',
    '/battle',
    '/battle/:path*',
    '/friends',
    '/friends/:path*',
  ],
};
