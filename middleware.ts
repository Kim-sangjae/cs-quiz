import { auth } from '@/lib/auth';
import { NextResponse } from 'next/server';

export default auth((req) => {
  const session = req.auth;
  const { pathname } = req.nextUrl;

  const isLoggedIn = !!session;
  const isAdmin = session?.user?.role === 'ADMIN';
  const hasNickname = !!session?.user?.nickname;

  if (pathname === '/admin') {
    if (!isLoggedIn || !isAdmin) {
      return NextResponse.redirect(new URL('/', req.url));
    }
    return NextResponse.next();
  }

  if (!isLoggedIn) {
    return NextResponse.redirect(
      new URL(
        `/api/auth/signin?callbackUrl=${encodeURIComponent(pathname)}`,
        req.url,
      ),
    );
  }

  if (!hasNickname && pathname !== '/auth/setup-nickname') {
    return NextResponse.redirect(
      new URL(
        `/auth/setup-nickname?callbackUrl=${encodeURIComponent(pathname)}`,
        req.url,
      ),
    );
  }

  return NextResponse.next();
});

export const config = {
  matcher: ['/quiz/:path*', '/board/submit', '/mypage/:path*', '/settings', '/admin'],
};
