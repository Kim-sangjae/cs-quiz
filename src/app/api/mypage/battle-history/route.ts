import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const myId = session.user.id;
  const opponentId = req.nextUrl.searchParams.get('opponentId') ?? undefined;

  const rooms = await prisma.gameRoom.findMany({
    where: {
      status: 'FINISHED',
      OR: [{ hostId: myId }, { guestId: myId }],
      ...(opponentId && {
        AND: [{ OR: [{ hostId: opponentId }, { guestId: opponentId }] }],
      }),
    },
    include: {
      host: { select: { id: true, nickname: true } },
      guest: { select: { id: true, nickname: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });

  const records = rooms.map((r) => {
    const isHost = r.hostId === myId;
    const myScore = isHost ? r.hostScore : r.guestScore;
    const oppScore = isHost ? r.guestScore : r.hostScore;
    const opponent = isHost
      ? { id: r.guest?.id ?? '', nickname: r.guest?.nickname ?? '?' }
      : { id: r.host.id, nickname: r.host.nickname ?? '?' };
    const result: 'win' | 'loss' | 'draw' =
      myScore > oppScore ? 'win' : myScore < oppScore ? 'loss' : 'draw';
    return {
      id: r.id,
      opponent,
      category: r.category,
      myScore,
      oppScore,
      result,
      playedAt: r.createdAt,
    };
  });

  return NextResponse.json({ records });
}
