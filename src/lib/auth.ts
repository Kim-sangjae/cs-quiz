import NextAuth from 'next-auth';
import type { AdapterUser } from 'next-auth/adapters';
import { PrismaAdapter } from '@auth/prisma-adapter';
import Credentials from 'next-auth/providers/credentials';
import { prisma } from './prisma';
import { authConfig } from './auth.config';
import { writeLog } from './audit';

const prismaAdapter = PrismaAdapter(prisma);

const devProviders = process.env.NODE_ENV === 'development'
  ? [Credentials({
      id: 'dev-credentials',
      credentials: { nickname: {} },
      async authorize(credentials) {
        const nickname = credentials?.nickname as string | undefined;
        if (!nickname) return null;
        const user = await prisma.user.findUnique({
          where: { nickname },
          select: { id: true, email: true, nickname: true, role: true, tokenVersion: true },
        });
        if (!user) return null;
        return { id: user.id, email: user.email, nickname: user.nickname, role: user.role, tokenVersion: user.tokenVersion };
      },
    })]
  : [];

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [...authConfig.providers, ...devProviders],
  adapter: {
    ...prismaAdapter,
    createUser: async (data: Omit<AdapterUser, 'id'>) => {
      const newUser = await prisma.user.create({
        data: {
          email: data.email,
          emailVerified: data.emailVerified,
          name: data.name ?? null,
          avatarUrl: data.image ?? null,
        },
      });
      writeLog({ actorId: newUser.id, actorRole: 'USER', action: 'REGISTER', payload: { email: data.email } });
      return newUser as unknown as AdapterUser;
    },
  },
  events: {
    // 로그인 시 이전 세션의 채팅 기록 숨김 처리
    // (강제 로그아웃·서버 다운 등으로 클라이언트 DELETE 호출이 누락된 경우 보완)
    async signIn({ user }) {
      if (!user?.id) return;
      try {
        await prisma.$transaction([
          prisma.chatMessage.updateMany({
            where: { senderId: user.id, hiddenBySender: false },
            data: { hiddenBySender: true },
          }),
          prisma.chatMessage.updateMany({
            where: { receiverId: user.id, hiddenByReceiver: false },
            data: { hiddenByReceiver: true },
          }),
          prisma.chatMessage.deleteMany({
            where: { hiddenBySender: true, hiddenByReceiver: true },
          }),
        ]);
      } catch { /* 채팅 정리 실패가 로그인을 막지 않도록 무시 */ }
    },
  },
  callbacks: {
    async signIn({ user, account }) {
      if (!user?.id) return true;
      const dbUser = await prisma.user.findUnique({
        where: { id: user.id },
        select: { deletedAt: true, role: true },
      });
      if (dbUser?.deletedAt) {
        writeLog({ actorId: user.id, actorRole: dbUser.role, action: 'LOGIN_FAIL', payload: { reason: '비활성화된 계정', provider: account?.provider } });
        const params = new URLSearchParams({ error: 'AccessDenied', email: user.email ?? '' });
        return `/auth/error?${params}`;
      }
      writeLog({ actorId: user.id, actorRole: dbUser?.role ?? 'USER', action: 'LOGIN', payload: { provider: account?.provider ?? 'unknown' } });
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
