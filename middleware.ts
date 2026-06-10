import NextAuth from 'next-auth';
import { authConfig } from '@/lib/auth.config';
import { NextResponse } from 'next/server';

const { auth } = NextAuth(authConfig);

const PROTECTED = ['/quiz', '/mypage', '/settings', '/board/submit', '/admin'];

export default auth((req) => {
  const session = req.auth;
  const { pathname } = req.nextUrl;

  const needsLogin = PROTECTED.some(
    (p) => pathname === p || pathname.startsWith(p + '/')
  );

  if (!needsLogin) return NextResponse.next();

  if (!session?.user) {
    const url = new URL('/api/auth/signin', req.url);
    url.searchParams.set('callbackUrl', req.nextUrl.href);
    return NextResponse.redirect(url);
  }

  if (!session.user.nickname) {
    const url = new URL('/auth/setup-nickname', req.url);
    url.searchParams.set('callbackUrl', req.nextUrl.href);
    return NextResponse.redirect(url);
  }

  if (
    (pathname === '/admin' || pathname.startsWith('/admin/')) &&
    session.user.role !== 'ADMIN'
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
  ],
};
