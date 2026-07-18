import { NextResponse, after } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { broadcastBattleStatusChange, STALE_QUESTION_MS } from '@/lib/battle-broadcast';
import { isRateLimited } from '@/lib/rate-limit';

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const userId = session.user.id;

  const rooms = await prisma.gameRoom.findMany({
    where: {
      status: { in: ['WAITING', 'PLAYING'] },
      OR: [{ hostId: userId }, { guestId: userId }],
    },
    include: {
      host: { select: { id: true, nickname: true } },
      guest: { select: { id: true, nickname: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  // WAITING 룸 중 20초 초과된 것 자동 취소 (FriendPanel 폴링 시에도 정리)
  const expiredWaiting = rooms.filter(
    (r) => r.status === 'WAITING' && Date.now() - r.createdAt.getTime() >= 20_000
  );
  if (expiredWaiting.length > 0) {
    await Promise.allSettled(
      expiredWaiting.map(async (r) => {
        await prisma.$transaction(async (tx) => {
          const cur = await tx.gameRoom.findUnique({ where: { id: r.id, status: 'WAITING' } });
          if (!cur) return;
          if (cur.guestId) {
            const guestNotifs = await tx.notification.findMany({
              where: { userId: cur.guestId, type: 'BATTLE_INVITE' },
            });
            const toDelete = guestNotifs
              .filter((n) => (n.payload as { roomId?: string }).roomId === r.id)
              .map((n) => n.id);
            if (toDelete.length > 0) await tx.notification.deleteMany({ where: { id: { in: toDelete } } });
          }
          await tx.gameRoom.delete({ where: { id: r.id } });
        });
      })
    );
  }

  // PLAYING 룸 중 5분 이상 문제가 안 바뀐 것 정리 (양쪽 다 이탈해서
  // 아무도 그 대결방 페이지를 다시 열지 않으면 [id]/route.ts의 stale 체크가
  // 영영 안 돌기 때문에, 여기 폴링에서도 같은 기준으로 정리)
  const stalePlaying = rooms.filter(
    (r) => r.status === 'PLAYING' && r.questionStartedAt &&
      Date.now() - r.questionStartedAt.getTime() > STALE_QUESTION_MS
  );
  if (stalePlaying.length > 0) {
    const results = await Promise.allSettled(
      stalePlaying.map((r) =>
        prisma.gameRoom.updateMany({
          where: { id: r.id, status: 'PLAYING' },
          data: { status: 'FINISHED', consecutiveAllSkip: 999 },
        })
      )
    );
    if (results.some((r) => r.status === 'fulfilled' && r.value.count > 0)) {
      after(broadcastBattleStatusChange());
    }
  }

  const staleIds = new Set(stalePlaying.map((r) => r.id));
  const activeRooms = rooms.filter(
    (r) =>
      !(r.status === 'WAITING' && Date.now() - r.createdAt.getTime() >= 20_000) &&
      !staleIds.has(r.id)
  );

  return NextResponse.json({ rooms: activeRooms });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const userId = session.user.id;
  const { friendId, category } = await req.json() as { friendId: string; category: string };

  // XP는 표시용이라 파밍 자체보다, 같은 상대와 대결방을 무한 생성해 DB에
  // 부하를 주는 것만 막을 목적 — 친구쌍 기준이라 친구가 많은 유저의 정상적인
  // 다회 대결은 걸리지 않음
  const pairKey = [userId, friendId].sort().join('-');
  if (await isRateLimited(`battle-create:${pairKey}`, 50, 86400)) {
    return NextResponse.json({ error: '오늘 이 상대와의 대결 생성 횟수를 초과했습니다. 내일 다시 시도하세요.' }, { status: 429 });
  }

  const friendship = await prisma.friendship.findFirst({
    where: {
      status: 'ACCEPTED',
      OR: [
        { requesterId: userId, addresseeId: friendId },
        { requesterId: friendId, addresseeId: userId },
      ],
    },
  });
  if (!friendship) return NextResponse.json({ error: '친구 관계가 아닙니다' }, { status: 400 });

  // 상대방이 이미 대결 중이면 차단
  const friendActiveRoom = await prisma.gameRoom.findFirst({
    where: {
      status: { in: ['WAITING', 'PLAYING'] },
      OR: [{ hostId: friendId }, { guestId: friendId }],
    },
  });
  if (friendActiveRoom) {
    return NextResponse.json({ error: '상대방이 이미 대결 중입니다' }, { status: 409 });
  }

  // 나도 이미 대결 중이면 차단
  const myActiveRoom = await prisma.gameRoom.findFirst({
    where: {
      status: { in: ['WAITING', 'PLAYING'] },
      OR: [{ hostId: userId }, { guestId: userId }],
    },
  });
  if (myActiveRoom) {
    return NextResponse.json({ error: '이미 대결이 진행 중입니다' }, { status: 409 });
  }

  const questions = await prisma.question.findMany({
    where: {
      ...(category !== 'all' && { category }),
      status: { in: ['OFFICIAL', 'APPROVED'] },
    },
    select: { id: true },
  });
  if (questions.length < 10) {
    return NextResponse.json({ error: '해당 카테고리에 문제가 부족합니다' }, { status: 400 });
  }

  const questionIds = shuffle(questions.map((q) => q.id)).slice(0, 10);

  const [room, me] = await Promise.all([
    prisma.gameRoom.create({
      data: { hostId: userId, guestId: friendId, category, questionIds },
    }),
    prisma.user.findUnique({ where: { id: userId }, select: { nickname: true } }),
  ]);

  await prisma.notification.create({
    data: {
      userId: friendId,
      type: 'BATTLE_INVITE',
      payload: { fromNickname: me?.nickname ?? '(닉네임 없음)', roomId: room.id, category },
      actionUrl: `/battle/${room.id}`,
    },
  });

  after(broadcastBattleStatusChange());
  return NextResponse.json({ roomId: room.id }, { status: 201 });
}
