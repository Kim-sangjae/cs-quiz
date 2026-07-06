import { NextResponse, after } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { broadcastBattleUpdate, broadcastBattleStatusChange } from '@/lib/battle-broadcast';
import { checkBattleBadges } from '@/lib/award-badges';

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

  const hostPrevAnswer = hostAnswers.length > currentQ ? hostAnswers[currentQ] : undefined;
  const guestPrevAnswer = guestAnswers.length > currentQ ? guestAnswers[currentQ] : undefined;

  // 이미 답변했고 자동제출(-1)이 아니면 차단
  if (isHost && hostPrevAnswer !== undefined && hostPrevAnswer !== -1) {
    return NextResponse.json({ error: '이미 답변했습니다' }, { status: 400 });
  }
  if (isGuest && guestPrevAnswer !== undefined && guestPrevAnswer !== -1) {
    return NextResponse.json({ error: '이미 답변했습니다' }, { status: 400 });
  }

  const questionIds = room.questionIds as string[];
  const q = await prisma.question.findUnique({
    where: { id: questionIds[currentQ] },
    select: { answer: true },
  });
  if (!q) return NextResponse.json({ error: 'Question not found' }, { status: 500 });

  const isCorrect = selected >= 0 && selected === q.answer;

  // 재답변(-1→실제선택) 시 해당 인덱스 교체, 최초 답변 시 push
  const newHostAnswers = isHost
    ? hostPrevAnswer === -1
      ? [...hostAnswers.slice(0, currentQ), selected, ...hostAnswers.slice(currentQ + 1)]
      : [...hostAnswers, selected]
    : hostAnswers;
  const newGuestAnswers = isGuest
    ? guestPrevAnswer === -1
      ? [...guestAnswers.slice(0, currentQ), selected, ...guestAnswers.slice(currentQ + 1)]
      : [...guestAnswers, selected]
    : guestAnswers;

  const bothAnswered = newHostAnswers.length > currentQ && newGuestAnswers.length > currentQ;
  // 재답변 케이스: 상대가 이미 -1이 아닌 값으로 답변했으면 bothAnswered=true
  const newCurrentQ = bothAnswered ? currentQ + 1 : currentQ;

  // 쌍방 스킵 연속 카운트 (둘 다 -1이면 증가, 아니면 0)
  const thisRoundBothSkipped =
    bothAnswered &&
    newHostAnswers[currentQ] === -1 &&
    newGuestAnswers[currentQ] === -1;
  const newConsecutive = bothAnswered
    ? thisRoundBothSkipped
      ? room.consecutiveAllSkip + 1
      : 0
    : room.consecutiveAllSkip;
  const isVoid = newConsecutive >= 3;
  const newStatus =
    bothAnswered && (newCurrentQ >= questionIds.length || isVoid) ? 'FINISHED' : room.status;

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
      consecutiveAllSkip: newConsecutive,
      ...scoreUpdate,
      ...(bothAnswered && newCurrentQ < questionIds.length ? { questionStartedAt: new Date() } : {}),
    },
  });

  await broadcastBattleUpdate(id);
  if (newStatus === 'FINISHED') {
    after(broadcastBattleStatusChange());
    if (room.guestId && !isVoid) after(checkBattleBadges(room.hostId, room.guestId).catch(() => {}));
  }
  return NextResponse.json({ correct: isCorrect });
}
