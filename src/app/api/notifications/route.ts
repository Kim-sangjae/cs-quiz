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

  // 헤더 벨에 쌓이지 않아야 할 타입 삭제
  await prisma.notification.deleteMany({
    where: { userId: session.user.id, type: 'BATTLE_QUIT_REQUEST' },
  });

  // 안읽은 것은 전부, 읽은 것은 최근 5개만
  const [unread, read] = await Promise.all([
    prisma.notification.findMany({
      where: { userId: session.user.id, isRead: false },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.notification.findMany({
      where: { userId: session.user.id, isRead: true },
      orderBy: { createdAt: 'desc' },
      take: 5,
    }),
  ]);

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
    // NICKNAME_CHANGED는 확인 시 삭제 (재표시 방지)
    const notif = await prisma.notification.findFirst({
      where: { id, userId: session.user.id },
      select: { type: true },
    });
    if (notif?.type === 'NICKNAME_CHANGED') {
      await prisma.notification.deleteMany({ where: { id, userId: session.user.id } });
    } else {
      await prisma.notification.updateMany({
        where: { id, userId: session.user.id },
        data: { isRead: true },
      });
    }
  } else if (type) {
    await prisma.notification.updateMany({
      where: { userId: session.user.id, type: type as never, isRead: false },
      data: { isRead: true },
    });
  } else {
    // 모두 읽음: 수동으로만 해제 가능한 타입은 제외
    await prisma.notification.deleteMany({
      where: {
        userId: session.user.id,
        NOT: {
          OR: [
            { type: 'FRIEND_REQUEST', isRead: false },
            { type: 'NICKNAME_CHANGED', isRead: false },
          ],
        },
      },
    });
  }

  return NextResponse.json({ ok: true });
}
