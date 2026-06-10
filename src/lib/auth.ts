import NextAuth from 'next-auth';
import type { AdapterUser } from 'next-auth/adapters';
import { PrismaAdapter } from '@auth/prisma-adapter';
import { prisma } from './prisma';
import { authConfig } from './auth.config';

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
});

export async function getServerUser() {
  const session = await auth();
  return session?.user ?? null;
}
