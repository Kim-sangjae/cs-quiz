import type { NextAuthConfig } from 'next-auth';
import Google from 'next-auth/providers/google';

const PROTECTED = ['/quiz', '/mypage', '/settings', '/board/submit', '/admin'];

export const authConfig: NextAuthConfig = {
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  session: { strategy: 'jwt' },
  callbacks: {
    authorized({ auth: session, request: { nextUrl } }) {
      const user = session?.user;
      const pathname = nextUrl.pathname;

      const needsLogin = PROTECTED.some((p) => pathname === p || pathname.startsWith(p + '/'));
      if (!needsLogin) return true;

      if (!user) {
        const url = new URL('/api/auth/signin', nextUrl.origin);
        url.searchParams.set('callbackUrl', nextUrl.href);
        return Response.redirect(url);
      }

      if (!user.nickname) {
        const url = new URL('/auth/setup-nickname', nextUrl);
        url.searchParams.set('callbackUrl', nextUrl.href);
        return Response.redirect(url);
      }

      if (pathname === '/admin' || pathname.startsWith('/admin/')) {
        if (user.role !== 'ADMIN') return Response.redirect(new URL('/', nextUrl));
      }

      return true;
    },
    jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id;
        token.nickname = (user as { nickname?: string | null }).nickname ?? null;
        token.role = (user as { role?: string }).role ?? 'USER';
      }
      if (trigger === 'update' && (session as { nickname?: string })?.nickname !== undefined) {
        token.nickname = (session as { nickname: string }).nickname;
      }
      return token;
    },
    session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string;
        session.user.nickname = (token.nickname as string | null) ?? null;
        session.user.role = (token.role as 'USER' | 'ADMIN') ?? 'USER';
      }
      return session;
    },
  },
};
