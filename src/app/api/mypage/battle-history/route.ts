import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

const PAGE_SIZE = 10;

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const myId = session.user.id;
  const { searchParams } = req.nextUrl;
  const opponentId = searchParams.get('opponentId') ?? undefined;
  const result = searchParams.get('result') ?? 'all';
  const sort = searchParams.get('sort') ?? 'newest';
  const page = Math.max(0, parseInt(searchParams.get('page') ?? '0'));

  const where = {
    status: 'FINISHED' as const,
    consecutiveAllSkip: { lt: 3 },
    OR: [{ hostId: myId }, { guestId: myId }] as { hostId?: string; guestId?: string }[],
    ...(opponentId ? { AND: [{ OR: [{ hostId: opponentId }, { guestId: opponentId }] }] } : {}),
  };

  const allRooms = await prisma.gameRoom.findMany({
    where,
    include: {
      host: { select: { id: true, nickname: true } },
      guest: { select: { id: true, nickname: true } },
    },
    orderBy: { createdAt: sort === 'oldest' ? 'asc' : 'desc' },
  });

  const allRecords = allRooms.map((r) => {
    const isHost = r.hostId === myId;
    const myScore = isHost ? r.hostScore : r.guestScore;
    const oppScore = isHost ? r.guestScore : r.hostScore;
    const opponent = isHost
      ? { id: r.guest?.id ?? '', nickname: r.guest?.nickname ?? '?' }
      : { id: r.host.id, nickname: r.host.nickname ?? '?' };
    const battleResult: 'win' | 'loss' | 'draw' =
      myScore > oppScore ? 'win' : myScore < oppScore ? 'loss' : 'draw';
    return { id: r.id, opponent, category: r.category, myScore, oppScore, result: battleResult, playedAt: r.createdAt };
  });

  const totalWins = allRecords.filter((r) => r.result === 'win').length;
  const totalLosses = allRecords.filter((r) => r.result === 'loss').length;
  const totalDraws = allRecords.filter((r) => r.result === 'draw').length;

  const filtered = result === 'all' ? allRecords : allRecords.filter((r) => r.result === result);
  const total = filtered.length;
  const records = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  return NextResponse.json({ records, total, pageCount: Math.ceil(total / PAGE_SIZE), totalWins, totalLosses, totalDraws });
}
