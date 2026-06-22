import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const userId = session.user.id;
  const { id } = await params;

  const room = await prisma.gameRoom.findUnique({
    where: { id },
    include: {
      host: { select: { id: true, nickname: true } },
      guest: { select: { id: true, nickname: true } },
    },
  });
  if (!room) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const isHost = room.hostId === userId;
  const isGuest = room.guestId === userId;
  if (!isHost && !isGuest) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const myRole = isHost ? 'host' : 'guest';
  const questionIds = room.questionIds as string[];
  const hostAnswers = room.hostAnswers as number[];
  const guestAnswers = room.guestAnswers as number[];

  if (room.status === 'WAITING') {
    return NextResponse.json({
      id: room.id,
      status: 'WAITING',
      category: room.category,
      host: room.host,
      guest: room.guest,
      myRole,
    });
  }

  if (room.status === 'FINISHED') {
    const questions = await prisma.question.findMany({
      where: { id: { in: questionIds } },
      select: { id: true, question: true, options: true, answer: true, explanation: true },
    });
    const sortedQs = questionIds.map((qid) => questions.find((q) => q.id === qid)!);
    return NextResponse.json({
      id: room.id,
      status: 'FINISHED',
      category: room.category,
      host: room.host,
      guest: room.guest,
      hostScore: room.hostScore,
      guestScore: room.guestScore,
      hostAnswers,
      guestAnswers,
      questions: sortedQs,
      myRole,
    });
  }

  // PLAYING
  const currentQ = room.currentQ;
  const currentQuestionId = questionIds[currentQ];
  const question = await prisma.question.findUnique({
    where: { id: currentQuestionId },
    select: { id: true, question: true, options: true },
  });

  return NextResponse.json({
    id: room.id,
    status: 'PLAYING',
    category: room.category,
    currentQ,
    totalQ: questionIds.length,
    host: room.host,
    guest: room.guest,
    hostScore: room.hostScore,
    guestScore: room.guestScore,
    hostAnswered: hostAnswers.length > currentQ,
    guestAnswered: guestAnswers.length > currentQ,
    question,
    myRole,
    mySelected: isHost
      ? (hostAnswers.length > currentQ ? hostAnswers[currentQ] : null)
      : (guestAnswers.length > currentQ ? guestAnswers[currentQ] : null),
    quitRequestBy: room.quitRequestBy ?? null,
  });
}
