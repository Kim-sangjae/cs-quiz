import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  try {
    await prisma.$transaction(async (tx) => {
      const room = await tx.gameRoom.findUnique({ where: { id, status: 'WAITING' } });
      if (!room) return;
      if (room.hostId !== session.user!.id) return;

      if (room.guestId) {
        const guestNotifs = await tx.notification.findMany({
          where: { userId: room.guestId, type: 'BATTLE_INVITE' },
        });
        const toDelete = guestNotifs
          .filter((n) => (n.payload as { roomId?: string }).roomId === id)
          .map((n) => n.id);
        if (toDelete.length > 0) await tx.notification.deleteMany({ where: { id: { in: toDelete } } });
      }

      await tx.gameRoom.delete({ where: { id } });
    });
  } catch { /* 이미 취소됨 */ }

  return NextResponse.json({ ok: true });
}
