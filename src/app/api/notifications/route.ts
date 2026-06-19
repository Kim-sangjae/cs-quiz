import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // 7일 지난 읽은 알림 자동 삭제
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  await prisma.notification.deleteMany({
    where: { userId: session.user.id, isRead: true, createdAt: { lt: sevenDaysAgo } },
  });

  const notifications = await prisma.notification.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: 'desc' },
    take: 30,
  });

  const unread = notifications.filter((n) => !n.isRead);
  const read = notifications.filter((n) => n.isRead).slice(0, 5);
  const result = [...unread, ...read].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  return NextResponse.json({ notifications: result, unreadCount: unread.length });
}

export async function PATCH(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { id, type } = body as { id?: string; type?: string };

  if (id) {
    await prisma.notification.updateMany({
      where: { id, userId: session.user.id },
      data: { isRead: true },
    });
  } else if (type) {
    await prisma.notification.updateMany({
      where: { userId: session.user.id, type: type as never, isRead: false },
      data: { isRead: true },
    });
  } else {
    // 모두 읽음: 미처리 FRIEND_REQUEST(isRead=false)는 제외하고 삭제
    await prisma.notification.deleteMany({
      where: {
        userId: session.user.id,
        NOT: { type: 'FRIEND_REQUEST', isRead: false },
      },
    });
  }

  return NextResponse.json({ ok: true });
}
