import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';

const TWO_MINUTES = 2 * 60 * 1000;

type RawRow = {
  userId: string;
  nickname: string | null;
  totalAttempts: number | bigint;
  totalCorrect: number | bigint;
};

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const userId = session.user.id;

  const friendships = await prisma.friendship.findMany({
    where: { status: 'ACCEPTED', OR: [{ requesterId: userId }, { addresseeId: userId }] },
  });

  const friendIds = friendships.map((f) => (f.requesterId === userId ? f.addresseeId : f.requesterId));

  if (friendIds.length === 0) return NextResponse.json({ rankings: [] });

  const allIds = [userId, ...friendIds];
  const twoMinutesAgo = new Date(Date.now() - TWO_MINUTES);

  const [rows, presences] = await Promise.all([
    prisma.$queryRaw<RawRow[]>`
      SELECT
        qa."userId",
        u.nickname,
        COUNT(*)::int AS "totalAttempts",
        SUM(CASE WHEN qa."isCorrect" THEN 1 ELSE 0 END)::int AS "totalCorrect"
      FROM "QuestionAttempt" qa
      JOIN "User" u ON qa."userId" = u.id
      WHERE qa."userId" IN (${Prisma.join(allIds)})
      GROUP BY qa."userId", u.nickname
      ORDER BY "totalCorrect" DESC, "totalAttempts" DESC
    `,
    prisma.userPresence.findMany({ where: { userId: { in: allIds } } }),
  ]);

  const presenceMap = new Map(presences.map((p) => [p.userId, p.lastSeenAt]));

  const rankings = rows.map((row, i) => ({
    rank: i + 1,
    userId: row.userId,
    nickname: row.nickname ?? '(닉네임 없음)',
    isMe: row.userId === userId,
    totalAttempts: Number(row.totalAttempts),
    accuracy: Number(row.totalAttempts) > 0 ? Number(row.totalCorrect) / Number(row.totalAttempts) : 0,
    isOnline: (presenceMap.get(row.userId) ?? new Date(0)) > twoMinutesAgo,
  }));

  return NextResponse.json({ rankings });
}
