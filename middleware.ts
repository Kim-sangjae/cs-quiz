import NextAuth from 'next-auth';
import { authConfig } from '@/lib/auth.config';

export default NextAuth(authConfig).auth;

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
