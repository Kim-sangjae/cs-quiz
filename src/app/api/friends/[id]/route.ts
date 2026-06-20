import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const userId = session.user.id;
  const { id } = await params;
  const { action } = await req.json() as { action: 'accept' | 'reject' };

  const friendship = await prisma.friendship.findUnique({
    where: { id },
    include: { requester: { select: { id: true, nickname: true } } },
  });
  if (!friendship) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (friendship.addresseeId !== userId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  if (friendship.status !== 'PENDING') return NextResponse.json({ error: '이미 처리된 요청입니다' }, { status: 400 });

  const newStatus = action === 'accept' ? 'ACCEPTED' : 'REJECTED';

  await prisma.friendship.update({ where: { id }, data: { status: newStatus } });

  // 수락/거절 완료된 FRIEND_REQUEST 알림 삭제
  await prisma.notification.deleteMany({
    where: {
      userId,
      type: 'FRIEND_REQUEST',
      payload: { path: ['friendshipId'], equals: id },
    },
  });

  if (action === 'accept') {
    const me = await prisma.user.findUnique({ where: { id: userId }, select: { nickname: true } });
    await prisma.notification.create({
      data: {
        userId: friendship.requesterId,
        type: 'FRIEND_ACCEPTED',
        payload: { fromNickname: me?.nickname ?? '(닉네임 없음)' },
        actionUrl: '/friends',
      },
    });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const userId = session.user.id;
  const { id } = await params;

  const friendship = await prisma.friendship.findUnique({ where: { id } });
  if (!friendship) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (friendship.requesterId !== userId && friendship.addresseeId !== userId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  await prisma.friendship.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
