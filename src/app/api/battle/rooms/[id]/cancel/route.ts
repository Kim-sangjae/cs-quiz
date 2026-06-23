import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const userId = session.user.id;
  const { id } = await params;

  const room = await prisma.gameRoom.findUnique({
    where: { id },
    select: { hostId: true, guestId: true, status: true },
  });
  if (!room) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (room.hostId !== userId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  if (room.status !== 'WAITING') return NextResponse.json({ error: '대기 중인 대전이 아닙니다' }, { status: 400 });

  // guest의 BATTLE_INVITE 알림 중 이 방 관련된 것 삭제
  const guestInvites = await prisma.notification.findMany({
    where: { userId: room.guestId!, type: 'BATTLE_INVITE' },
    select: { id: true, payload: true },
  });
  const toDelete = guestInvites
    .filter((n) => (n.payload as { roomId?: string }).roomId === id)
    .map((n) => n.id);
  if (toDelete.length > 0) {
    await prisma.notification.deleteMany({ where: { id: { in: toDelete } } });
  }

  await prisma.gameRoom.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
