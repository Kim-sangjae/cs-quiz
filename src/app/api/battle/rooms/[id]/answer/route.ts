import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const userId = session.user.id;
  const { id } = await params;
  const { selected } = await req.json() as { selected: number };

  const room = await prisma.gameRoom.findUnique({ where: { id } });
  if (!room) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (room.status !== 'PLAYING') return NextResponse.json({ error: '진행 중인 대전이 아닙니다' }, { status: 400 });

  const isHost = room.hostId === userId;
  const isGuest = room.guestId === userId;
  if (!isHost && !isGuest) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const hostAnswers = room.hostAnswers as number[];
  const guestAnswers = room.guestAnswers as number[];
  const currentQ = room.currentQ;

  if (isHost && hostAnswers.length > currentQ) {
    return NextResponse.json({ error: '이미 답변했습니다' }, { status: 400 });
  }
  if (isGuest && guestAnswers.length > currentQ) {
    return NextResponse.json({ error: '이미 답변했습니다' }, { status: 400 });
  }

  const questionIds = room.questionIds as string[];
  const q = await prisma.question.findUnique({
    where: { id: questionIds[currentQ] },
    select: { answer: true },
  });
  if (!q) return NextResponse.json({ error: 'Question not found' }, { status: 500 });

  const isCorrect = selected >= 0 && selected === q.answer;

  const newHostAnswers = isHost ? [...hostAnswers, selected] : hostAnswers;
  const newGuestAnswers = isGuest ? [...guestAnswers, selected] : guestAnswers;

  const bothAnswered = newHostAnswers.length > currentQ && newGuestAnswers.length > currentQ;
  const newCurrentQ = bothAnswered ? currentQ + 1 : currentQ;
  const newStatus = bothAnswered && newCurrentQ >= 7 ? 'FINISHED' : room.status;

  const scoreUpdate = isHost && isCorrect
    ? { hostScore: { increment: 1 } }
    : isGuest && isCorrect
      ? { guestScore: { increment: 1 } }
      : {};

  await prisma.gameRoom.update({
    where: { id },
    data: {
      hostAnswers: newHostAnswers,
      guestAnswers: newGuestAnswers,
      currentQ: newCurrentQ,
      status: newStatus,
      ...scoreUpdate,
    },
  });

  return NextResponse.json({ correct: isCorrect });
}
