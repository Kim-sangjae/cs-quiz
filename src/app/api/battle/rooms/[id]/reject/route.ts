import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const userId = session.user.id;
  const { id: roomId } = await params;

  const room = await prisma.gameRoom.findUnique({
    where: { id: roomId },
    include: { guest: { select: { nickname: true } } },
  });

  if (!room) return NextResponse.json({ error: '방을 찾을 수 없습니다' }, { status: 404 });
  if (room.guestId !== userId) return NextResponse.json({ error: '권한이 없습니다' }, { status: 403 });
  if (room.status !== 'WAITING') return NextResponse.json({ error: '이미 시작된 대전입니다' }, { status: 400 });

  const guestNickname = room.guest?.nickname ?? '(닉네임 없음)';

  await prisma.$transaction([
    prisma.gameRoom.delete({ where: { id: roomId } }),
    prisma.notification.create({
      data: {
        userId: room.hostId,
        type: 'BATTLE_REJECTED',
        payload: { fromNickname: guestNickname },
        actionUrl: '/battle',
      },
    }),
  ]);

  return NextResponse.json({ ok: true });
}
