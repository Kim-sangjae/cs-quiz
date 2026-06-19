import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

const TWO_MINUTES = 2 * 60 * 1000;

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const userId = session.user.id;
  const twoMinutesAgo = new Date(Date.now() - TWO_MINUTES);

  const friendships = await prisma.friendship.findMany({
    where: {
      status: 'ACCEPTED',
      OR: [{ requesterId: userId }, { addresseeId: userId }],
    },
    include: {
      requester: { select: { id: true, nickname: true, presence: true } },
      addressee: { select: { id: true, nickname: true, presence: true } },
    },
    orderBy: { updatedAt: 'desc' },
  });

  const friends = friendships.map((f) => {
    const other = f.requesterId === userId ? f.addressee : f.requester;
    return {
      friendshipId: f.id,
      userId: other.id,
      nickname: other.nickname ?? '(닉네임 없음)',
      isOnline: other.presence ? other.presence.lastSeenAt > twoMinutesAgo : false,
      lastSeenAt: other.presence?.lastSeenAt?.toISOString() ?? null,
    };
  });

  return NextResponse.json({ friends });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const userId = session.user.id;
  const { nickname } = await req.json() as { nickname: string };

  if (!nickname?.trim()) return NextResponse.json({ error: '닉네임을 입력해주세요' }, { status: 400 });

  const target = await prisma.user.findUnique({
    where: { nickname: nickname.trim() },
    select: { id: true, nickname: true },
  });
  if (!target) return NextResponse.json({ error: '해당 닉네임의 유저가 없습니다' }, { status: 404 });
  if (target.id === userId) return NextResponse.json({ error: '자기 자신에게 친구 요청을 보낼 수 없습니다' }, { status: 400 });

  const existing = await prisma.friendship.findFirst({
    where: {
      OR: [
        { requesterId: userId, addresseeId: target.id },
        { requesterId: target.id, addresseeId: userId },
      ],
    },
  });
  if (existing) {
    const msg = existing.status === 'ACCEPTED' ? '이미 친구입니다' : '이미 친구 요청이 존재합니다';
    return NextResponse.json({ error: msg }, { status: 409 });
  }

  const me = await prisma.user.findUnique({ where: { id: userId }, select: { nickname: true } });

  await prisma.$transaction([
    prisma.friendship.create({
      data: { requesterId: userId, addresseeId: target.id },
    }),
    prisma.notification.create({
      data: {
        userId: target.id,
        type: 'FRIEND_REQUEST',
        payload: { fromNickname: me?.nickname ?? '(닉네임 없음)' },
        actionUrl: '/friends',
      },
    }),
  ]);

  return NextResponse.json({ ok: true }, { status: 201 });
}
