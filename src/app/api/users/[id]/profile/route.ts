import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

function computeLevel(correctCount: number): number {
  if (correctCount >= 1000) return 5;
  if (correctCount >= 400) return 4;
  if (correctCount >= 150) return 3;
  if (correctCount >= 50) return 2;
  return 1;
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id: targetId } = await params;
  const myId = session.user.id;

  const [user, attempts, rooms, presence] = await Promise.all([
    prisma.user.findUnique({
      where: { id: targetId },
      select: { nickname: true },
    }),
    prisma.$queryRaw<[{ total: number; correct: number }]>`
      SELECT COUNT(*)::int AS total,
             SUM(CASE WHEN "isCorrect" THEN 1 ELSE 0 END)::int AS correct
      FROM "QuestionAttempt"
      WHERE "userId" = ${targetId}
    `,
    prisma.gameRoom.findMany({
      where: {
        status: 'FINISHED',
        OR: [
          { hostId: myId, guestId: targetId },
          { hostId: targetId, guestId: myId },
        ],
      },
      select: { hostId: true, guestId: true, hostScore: true, guestScore: true },
    }),
    prisma.userPresence.findUnique({ where: { userId: targetId } }),
  ]);

  if (!user) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const total = Number(attempts[0]?.total ?? 0);
  const correct = Number(attempts[0]?.correct ?? 0);
  const accuracy = total > 0 ? correct / total : 0;
  const level = computeLevel(correct);

  const battleTotal = rooms.length;
  const battleWins = rooms.filter((r) => {
    if (r.hostId === myId) return r.hostScore > r.guestScore;
    if (r.guestId === myId) return r.guestScore > r.hostScore;
    return false;
  }).length;

  const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);
  const isOnline = presence ? presence.lastSeenAt > twoMinutesAgo : false;

  return NextResponse.json({
    nickname: user.nickname ?? '(닉네임 없음)',
    level,
    totalAttempts: total,
    accuracy,
    battleWins,
    battleTotal,
    isOnline,
  });
}
