import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const userId = session.user.id;

  const rooms = await prisma.gameRoom.findMany({
    where: {
      status: { in: ['WAITING', 'PLAYING'] },
      OR: [{ hostId: userId }, { guestId: userId }],
    },
    include: {
      host: { select: { id: true, nickname: true } },
      guest: { select: { id: true, nickname: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json({ rooms });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const userId = session.user.id;
  const { friendId, category } = await req.json() as { friendId: string; category: string };

  const friendship = await prisma.friendship.findFirst({
    where: {
      status: 'ACCEPTED',
      OR: [
        { requesterId: userId, addresseeId: friendId },
        { requesterId: friendId, addresseeId: userId },
      ],
    },
  });
  if (!friendship) return NextResponse.json({ error: '친구 관계가 아닙니다' }, { status: 400 });

  const questions = await prisma.question.findMany({
    where: { category, status: { in: ['OFFICIAL', 'APPROVED'] } },
    select: { id: true },
  });
  if (questions.length < 5) {
    return NextResponse.json({ error: '해당 카테고리에 문제가 부족합니다' }, { status: 400 });
  }

  const questionIds = shuffle(questions.map((q) => q.id)).slice(0, 5);

  const [room, me] = await Promise.all([
    prisma.gameRoom.create({
      data: { hostId: userId, guestId: friendId, category, questionIds },
    }),
    prisma.user.findUnique({ where: { id: userId }, select: { nickname: true } }),
  ]);

  await prisma.notification.create({
    data: {
      userId: friendId,
      type: 'BATTLE_INVITE',
      payload: { fromNickname: me?.nickname ?? '(닉네임 없음)', roomId: room.id },
      actionUrl: `/battle/${room.id}`,
    },
  });

  return NextResponse.json({ roomId: room.id }, { status: 201 });
}
