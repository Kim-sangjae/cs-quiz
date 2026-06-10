import type { NextAuthConfig } from 'next-auth';
import Google from 'next-auth/providers/google';

export const authConfig: NextAuthConfig = {
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  session: { strategy: 'jwt' },
  callbacks: {
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
