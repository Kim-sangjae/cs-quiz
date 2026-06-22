import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const userId = session.user.id;
  const { id } = await params;
  const { action } = await req.json() as { action: 'request' | 'accept' | 'reject' };

  const room = await prisma.gameRoom.findUnique({ where: { id } });
  if (!room) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (room.status !== 'PLAYING') return NextResponse.json({ error: '진행 중인 대전이 아닙니다' }, { status: 400 });

  const isHost = room.hostId === userId;
  const isGuest = room.guestId === userId;
  if (!isHost && !isGuest) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const myRole = isHost ? 'host' : 'guest';

  if (action === 'request') {
    // 이미 내가 요청한 경우 취소
    if (room.quitRequestBy === myRole) {
      await prisma.gameRoom.update({ where: { id }, data: { quitRequestBy: null } });
      return NextResponse.json({ ok: true, cancelled: true });
    }
    await prisma.gameRoom.update({ where: { id }, data: { quitRequestBy: myRole } });
    return NextResponse.json({ ok: true });
  }

  if (action === 'reject') {
    await prisma.gameRoom.update({ where: { id }, data: { quitRequestBy: null } });
    return NextResponse.json({ ok: true });
  }

  if (action === 'accept') {
    // 요청자가 상대방이어야 함
    const requesterRole = room.quitRequestBy;
    if (!requesterRole || requesterRole === myRole) {
      return NextResponse.json({ error: '잘못된 요청입니다' }, { status: 400 });
    }
    await prisma.gameRoom.update({
      where: { id },
      data: { status: 'FINISHED', quitRequestBy: null },
    });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
}
