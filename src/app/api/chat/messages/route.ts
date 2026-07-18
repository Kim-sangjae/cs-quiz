import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { maskProfanity } from '@/lib/content-filter';
import { isRateLimited } from '@/lib/rate-limit';

const LIMIT = 100;

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const friendId = new URL(req.url).searchParams.get('friendId');
  if (!friendId) return NextResponse.json({ error: 'Missing friendId' }, { status: 400 });

  const myId = session.user.id;

  // 내가 숨김 처리(로그아웃)한 메시지는 제외
  const messages = await prisma.chatMessage.findMany({
    where: {
      OR: [
        { senderId: myId, receiverId: friendId, hiddenBySender: false },
        { senderId: friendId, receiverId: myId, hiddenByReceiver: false },
      ],
    },
    include: { sender: { select: { nickname: true } } },
    orderBy: { createdAt: 'asc' },
    take: LIMIT,
  });

  return NextResponse.json({
    messages: messages.map((m) => ({
      id: m.id,
      senderId: m.senderId,
      senderNickname: m.sender.nickname ?? '알 수 없음',
      content: m.content,
      sentAt: m.createdAt.getTime(),
    })),
  });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json() as { receiverId?: string; content?: string };
  const raw = typeof body.content === 'string' ? body.content.trim() : '';
  const receiverId = typeof body.receiverId === 'string' ? body.receiverId : '';

  if (!raw || raw.length > 200 || !receiverId) {
    return NextResponse.json({ error: 'Invalid' }, { status: 400 });
  }

  const myId = session.user.id;

  if (receiverId === myId) {
    return NextResponse.json({ error: 'Invalid' }, { status: 400 });
  }

  // 친구 관계(수락됨)가 아니면 메시지를 보낼 수 없음
  const friendship = await prisma.friendship.findFirst({
    where: {
      status: 'ACCEPTED',
      OR: [
        { requesterId: myId, addresseeId: receiverId },
        { requesterId: receiverId, addresseeId: myId },
      ],
    },
    select: { id: true },
  });
  if (!friendship) {
    return NextResponse.json({ error: '친구 관계가 아닙니다.' }, { status: 403 });
  }

  if (await isRateLimited(`chat:${myId}`, 20, 10)) {
    return NextResponse.json({ error: '메시지를 너무 빠르게 보내고 있습니다. 잠시 후 다시 시도하세요.' }, { status: 429 });
  }

  const dbWords = await prisma.blockedWord.findMany({ select: { word: true } });
  const content = maskProfanity(raw, dbWords.map((w) => w.word));

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const [message] = await Promise.all([
    prisma.chatMessage.create({
      data: { senderId: myId, receiverId, content },
      include: { sender: { select: { nickname: true } } },
    }),
    prisma.chatMessage.deleteMany({
      where: {
        createdAt: { lt: thirtyDaysAgo },
        OR: [
          { senderId: myId, receiverId },
          { senderId: receiverId, receiverId: myId },
        ],
      },
    }),
  ]);

  return NextResponse.json({
    message: {
      id: message.id,
      senderId: message.senderId,
      senderNickname: message.sender.nickname ?? '알 수 없음',
      content: message.content,
      sentAt: message.createdAt.getTime(),
    },
  });
}

export async function DELETE() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const myId = session.user.id;
  // 내 화면에서만 숨김 (상대방은 계속 볼 수 있음) → 양쪽 모두 숨기면 실제 삭제
  await prisma.$transaction([
    prisma.chatMessage.updateMany({
      where: { senderId: myId },
      data: { hiddenBySender: true },
    }),
    prisma.chatMessage.updateMany({
      where: { receiverId: myId },
      data: { hiddenByReceiver: true },
    }),
    prisma.chatMessage.deleteMany({
      where: { hiddenBySender: true, hiddenByReceiver: true },
    }),
  ]);

  return NextResponse.json({ ok: true });
}
