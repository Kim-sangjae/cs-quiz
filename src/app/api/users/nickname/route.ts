import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { writeLog } from '@/lib/audit';
import { isNicknameAllowed } from '@/lib/nickname-filter';

const NICKNAME_REGEX = /^[a-zA-Z0-9가-힣]{2,12}$/;

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const { nickname } = body as { nickname: unknown };

  if (typeof nickname !== 'string' || !NICKNAME_REGEX.test(nickname)) {
    return NextResponse.json({ error: 'Invalid nickname' }, { status: 400 });
  }

  const isAdmin = session.user.role === 'ADMIN';
  const filter = await isNicknameAllowed(nickname, isAdmin);
  if (!filter.ok) {
    return NextResponse.json({ error: 'Inappropriate nickname' }, { status: 400 });
  }

  const existing = await prisma.user.findUnique({ where: { nickname } });
  if (existing && existing.id !== session.user.id) {
    return NextResponse.json({ error: 'Nickname already taken' }, { status: 409 });
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: { nickname },
  });

  return NextResponse.json({ ok: true });
}

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const { nickname } = body as { nickname: unknown };

  if (typeof nickname !== 'string' || !NICKNAME_REGEX.test(nickname)) {
    return NextResponse.json({ error: 'Invalid nickname' }, { status: 400 });
  }

  const isAdmin = session.user.role === 'ADMIN';
  const filter = await isNicknameAllowed(nickname, isAdmin);
  if (!filter.ok) {
    return NextResponse.json({ error: 'Inappropriate nickname' }, { status: 400 });
  }

  const currentUser = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (currentUser?.nickname === nickname) {
    return NextResponse.json({ error: 'Same nickname' }, { status: 400 });
  }

  const existing = await prisma.user.findUnique({ where: { nickname } });
  if (existing && existing.id !== session.user.id) {
    return NextResponse.json({ error: 'Nickname already taken' }, { status: 409 });
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: { nickname },
  });

  writeLog({ actorId: session.user.id, actorRole: session.user.role ?? 'USER', action: 'NICKNAME_CHANGE', targetType: 'User', targetId: session.user.id, payload: { prev: currentUser?.nickname, next: nickname } });

  // 친구들에게 닉네임 변경 알림 전송 (수동 해제만 가능)
  const friendships = await prisma.friendship.findMany({
    where: {
      OR: [{ requesterId: session.user.id }, { addresseeId: session.user.id }],
      status: 'ACCEPTED',
    },
    select: { requesterId: true, addresseeId: true },
  });
  const friendIds = friendships.map((f) =>
    f.requesterId === session.user.id ? f.addresseeId : f.requesterId
  );
  if (friendIds.length > 0) {
    await prisma.notification.createMany({
      data: friendIds.map((friendId) => ({
        userId: friendId,
        type: 'NICKNAME_CHANGED' as const,
        payload: {
          prevNickname: currentUser?.nickname ?? '',
          newNickname: nickname,
          actorId: session.user.id,
        },
      })),
    });
  }

  return NextResponse.json({ nickname });
}
