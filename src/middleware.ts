import NextAuth from 'next-auth';
import { authConfig } from '@/lib/auth.config';
import { NextResponse } from 'next/server';

const { auth } = NextAuth(authConfig);

const PROTECTED = ['/quiz', '/mypage', '/settings', '/board/submit', '/admin', '/inquiry', '/battle', '/friends'];

// 링크 공유 시 OG 미리보기 카드를 생성하는 스크래핑 봇만 예외적으로 통과시킴(로그인 없이 메타태그만 읽음, 실제 퀴즈 풀이는 못 함)
// 주의: 카카오톡 "앱 내 브라우저"(사람이 링크를 눌러 여는 웹뷰)도 UA에 KAKAOTALK이 포함되므로
// bare 'kakaotalk'을 매칭하면 로그인 우회가 재현됨 — 반드시 미리보기 스크래퍼 전용 토큰인 'kakaotalk-scrap'만 매칭
const OG_SCRAPER_UA = /kakaotalk-scrap|discordbot|facebookexternalhit|twitterbot|slackbot|telegrambot|linkedinbot/i;

export default auth((req) => {
  const { pathname } = req.nextUrl;

  if (pathname === '/quiz/play' && OG_SCRAPER_UA.test(req.headers.get('user-agent') ?? '')) {
    return NextResponse.next();
  }

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
