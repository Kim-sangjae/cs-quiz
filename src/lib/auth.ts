import NextAuth from 'next-auth';
import type { AdapterUser } from 'next-auth/adapters';
import { PrismaAdapter } from '@auth/prisma-adapter';
import { prisma } from './prisma';
import { authConfig } from './auth.config';
import { writeLog } from './audit';

const prismaAdapter = PrismaAdapter(prisma);

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: {
    ...prismaAdapter,
    createUser: async (data: Omit<AdapterUser, 'id'>) => {
      return prisma.user.create({
        data: {
          email: data.email,
          emailVerified: data.emailVerified,
          name: data.name ?? null,
          avatarUrl: data.image ?? null,
        },
      }) as unknown as AdapterUser;
    },
  },
  callbacks: {
    async signIn({ user }) {
      if (!user?.id) return true;
      const dbUser = await prisma.user.findUnique({
        where: { id: user.id },
        select: { deletedAt: true, role: true },
      });
      if (dbUser?.deletedAt) {
        writeLog({ actorId: user.id, actorRole: dbUser.role, action: 'LOGIN_FAIL', payload: { reason: '비활성화된 계정' } });
        const params = new URLSearchParams({ error: 'AccessDenied', email: user.email ?? '' });
        return `/auth/error?${params}`;
      }
      writeLog({ actorId: user.id, actorRole: dbUser?.role ?? 'USER', action: 'LOGIN' });
      return true;
    },
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id;
        token.nickname = (user as { nickname?: string | null }).nickname ?? null;
        token.role = (user as { role?: string }).role ?? 'USER';
        token.tokenVersion = (user as { tokenVersion?: number }).tokenVersion ?? 0;
      }
      if (trigger === 'update' && (session as { nickname?: string })?.nickname !== undefined) {
        token.nickname = (session as { nickname: string }).nickname;
      }
      if (!user && token.id) {
        const dbUser = await prisma.user.findUnique({
          where: { id: token.id as string },
          select: { tokenVersion: true, role: true, nickname: true, deletedAt: true },
        });
        if (
          !dbUser ||
          dbUser.tokenVersion !== (token.tokenVersion as number) ||
          dbUser.deletedAt !== null
        ) {
          return null;
        }
        token.role = dbUser.role;
        token.nickname = dbUser.nickname;
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
