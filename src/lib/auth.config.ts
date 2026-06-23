import type { NextAuthConfig } from 'next-auth';
import Google from 'next-auth/providers/google';
import Kakao from 'next-auth/providers/kakao';

export const authConfig: NextAuthConfig = {
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    Kakao({
      clientId: process.env.KAKAO_CLIENT_ID!,
      clientSecret: process.env.KAKAO_CLIENT_SECRET!,
      profile(profile) {
        return {
          id: String(profile.id),
          name: profile.kakao_account?.profile?.nickname ?? null,
          // 이메일 미동의 시 합성 이메일 사용 (DB 저장용, UI에 미노출)
          email: profile.kakao_account?.email ?? `kakao_${profile.id}@kakao.user`,
          image: profile.kakao_account?.profile?.profile_image_url ?? null,
        };
      },
    }),
  ],
  pages: {
    signIn: '/auth/login',
    error: '/auth/error',
  },
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
