import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { broadcastToUser } from '@/lib/broadcast';

const TWO_MINUTES = 45 * 1000;

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

  const friendEntries = friendships.map((f) => {
    const other = f.requesterId === userId ? f.addressee : f.requester;
    return {
      friendshipId: f.id,
      userId: other.id,
      nickname: other.nickname ?? '(닉네임 없음)',
      isOnline: other.presence ? other.presence.lastSeenAt > twoMinutesAgo : false,
      lastSeenAt: other.presence?.lastSeenAt?.toISOString() ?? null,
    };
  });

  const friendIds = friendEntries.map((f) => f.userId);
  const activeRooms = friendIds.length > 0
    ? await prisma.gameRoom.findMany({
        where: {
          status: { in: ['WAITING', 'PLAYING'] },
          OR: [{ hostId: { in: friendIds } }, { guestId: { in: friendIds } }],
        },
        select: { hostId: true, guestId: true, status: true },
      })
    : [];

  const battleStatusMap = new Map<string, 'WAITING' | 'PLAYING'>();
  for (const room of activeRooms) {
    if (!battleStatusMap.has(room.hostId)) battleStatusMap.set(room.hostId, room.status as 'WAITING' | 'PLAYING');
    if (room.guestId && !battleStatusMap.has(room.guestId)) battleStatusMap.set(room.guestId, room.status as 'WAITING' | 'PLAYING');
  }

  const friends = friendEntries.map((f) => ({
    ...f,
    battleStatus: battleStatusMap.get(f.userId) ?? null,
  }));

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
    if (existing.status === 'ACCEPTED') {
      return NextResponse.json({ error: '이미 친구입니다' }, { status: 409 });
    }

    const me = await prisma.user.findUnique({ where: { id: userId }, select: { nickname: true } });
    const myNickname = me?.nickname ?? '(닉네임 없음)';

    if (existing.status === 'REJECTED') {
      // 거절된 요청 → requesterId/addresseeId를 현재 요청자 기준으로 업데이트 후 재전송
      await prisma.$transaction([
        prisma.friendship.update({
          where: { id: existing.id },
          data: { requesterId: userId, addresseeId: target.id, status: 'PENDING' },
        }),
        prisma.notification.deleteMany({
          where: { type: 'FRIEND_REQUEST', payload: { path: ['friendshipId'], equals: existing.id } },
        }),
        prisma.notification.create({
          data: {
            userId: target.id,
            type: 'FRIEND_REQUEST',
            payload: { fromNickname: myNickname, friendshipId: existing.id },
            actionUrl: '/friends',
          },
        }),
      ]);
      await broadcastToUser(target.id, 'friend_request', { fromNickname: myNickname });
      return NextResponse.json({ ok: true }, { status: 200 });
    }

    // PENDING 상태
    if (existing.requesterId !== userId) {
      // 상대방이 이미 나에게 요청을 보낸 경우 → 자동 수락
      await prisma.$transaction([
        prisma.friendship.update({ where: { id: existing.id }, data: { status: 'ACCEPTED' } }),
        prisma.notification.deleteMany({
          where: {
            userId,
            type: 'FRIEND_REQUEST',
            payload: { path: ['friendshipId'], equals: existing.id },
          },
        }),
        prisma.notification.create({
          data: {
            userId: target.id,
            type: 'FRIEND_ACCEPTED',
            payload: { fromNickname: myNickname },
          },
        }),
      ]);
      await broadcastToUser(target.id, 'friend_accepted', { fromNickname: myNickname });
      return NextResponse.json({ ok: true }, { status: 200 });
    }

    // 내가 보낸 PENDING 요청 → 알림 재전송
    await prisma.$transaction([
      prisma.friendship.update({ where: { id: existing.id }, data: { status: 'PENDING' } }),
      prisma.notification.deleteMany({
        where: { userId: target.id, type: 'FRIEND_REQUEST' },
      }),
      prisma.notification.create({
        data: {
          userId: target.id,
          type: 'FRIEND_REQUEST',
          payload: { fromNickname: myNickname, friendshipId: existing.id },
          actionUrl: '/friends',
        },
      }),
    ]);
    await broadcastToUser(target.id, 'friend_request', { fromNickname: myNickname });
    return NextResponse.json({ ok: true }, { status: 200 });
  }

  const [friendship, me] = await Promise.all([
    prisma.friendship.create({ data: { requesterId: userId, addresseeId: target.id } }),
    prisma.user.findUnique({ where: { id: userId }, select: { nickname: true } }),
  ]);

  await prisma.notification.create({
    data: {
      userId: target.id,
      type: 'FRIEND_REQUEST',
      payload: { fromNickname: me?.nickname ?? '(닉네임 없음)', friendshipId: friendship.id },
      actionUrl: '/friends',
    },
  });
  await broadcastToUser(target.id, 'friend_request', { fromNickname: me?.nickname ?? '' });

  return NextResponse.json({ ok: true }, { status: 201 });
}
