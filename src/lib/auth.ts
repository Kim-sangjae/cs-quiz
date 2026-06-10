import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';
import { PrismaAdapter } from '@auth/prisma-adapter';
import { prisma } from './prisma';

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers: [Google],
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
});

export async function getServerUser() {
  const session = await auth();
  return session?.user ?? null;
}
