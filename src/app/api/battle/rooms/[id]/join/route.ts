import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const userId = session.user.id;
  const { id } = await params;

  const room = await prisma.gameRoom.findUnique({ where: { id } });
  if (!room) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (room.guestId !== userId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  if (room.status !== 'WAITING') return NextResponse.json({ error: '이미 시작된 대전입니다' }, { status: 400 });

  await prisma.gameRoom.update({
    where: { id },
    data: { status: 'PLAYING' },
  });

  return NextResponse.json({ ok: true });
}
