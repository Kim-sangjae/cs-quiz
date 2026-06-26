import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const userId = session.user.id;
  const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);

  const [presences, friendships] = await Promise.all([
    prisma.userPresence.findMany({
      where: { lastSeenAt: { gte: twoMinutesAgo } },
      select: { userId: true, user: { select: { nickname: true } } },
      orderBy: { lastSeenAt: 'desc' },
    }),
    prisma.friendship.findMany({
      where: {
        status: 'ACCEPTED',
        OR: [{ requesterId: userId }, { addresseeId: userId }],
      },
      select: { requesterId: true, addresseeId: true },
    }),
  ]);

  const friendIds = new Set(
    friendships.map((f) => (f.requesterId === userId ? f.addresseeId : f.requesterId))
  );

  const users = presences
    .filter((p) => p.userId !== userId)
    .map((p) => ({
      id: p.userId,
      nickname: p.user.nickname ?? '(닉네임 없음)',
      isFriend: friendIds.has(p.userId),
    }));

  return NextResponse.json({ users, totalCount: presences.length });
}
