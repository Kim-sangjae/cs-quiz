import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { maskProfanity } from '@/lib/content-filter';

const LIMIT = 100;

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const friendId = new URL(req.url).searchParams.get('friendId');
  if (!friendId) return NextResponse.json({ error: 'Missing friendId' }, { status: 400 });

  const myId = session.user.id;

  const messages = await prisma.chatMessage.findMany({
    where: {
      OR: [
        { senderId: myId, receiverId: friendId },
        { senderId: friendId, receiverId: myId },
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

  const dbWords = await prisma.blockedWord.findMany({ select: { word: true } });
  const content = maskProfanity(raw, dbWords.map((w) => w.word));
  const myId = session.user.id;

  const message = await prisma.chatMessage.create({
    data: { senderId: myId, receiverId, content },
    include: { sender: { select: { nickname: true } } },
  });

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
  await prisma.chatMessage.deleteMany({
    where: { OR: [{ senderId: myId }, { receiverId: myId }] },
  });

  return NextResponse.json({ ok: true });
}
