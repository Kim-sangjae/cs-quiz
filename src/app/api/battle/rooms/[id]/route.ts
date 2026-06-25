import { NextResponse, after } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { broadcastBattleUpdate, broadcastBattleStatusChange } from '@/lib/battle-broadcast';
import { checkBattleBadges } from '@/lib/award-badges';

const QUESTION_TIMEOUT_MS = 20 * 1000;
const SKIP_TIMEOUT_MS = 5 * 1000; // 연속 쌍방 스킵 시 단축 타이머

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const userId = session.user.id;
  const { id } = await params;

  let room = await prisma.gameRoom.findUnique({
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

  // 서버사이드 타임아웃 자동제출
  if (room.status === 'PLAYING' && room.questionStartedAt) {
    // consecutiveAllSkip >= 1 이면 단축 타이머(5s) 적용
    const effectiveTimeoutMs = room.consecutiveAllSkip >= 1 ? SKIP_TIMEOUT_MS : QUESTION_TIMEOUT_MS;
    const elapsed = Date.now() - room.questionStartedAt.getTime();
    if (elapsed >= effectiveTimeoutMs) {
      const hA = room.hostAnswers as number[];
      const gA = room.guestAnswers as number[];
      const cQ = room.currentQ;
      const hostNeeds = hA.length <= cQ;
      const guestNeeds = gA.length <= cQ;

      if (hostNeeds || guestNeeds) {
        try {
          const updated = await prisma.$transaction(async (tx) => {
            const cur = await tx.gameRoom.findUnique({ where: { id } });
            if (!cur || cur.status !== 'PLAYING' || !cur.questionStartedAt) return null;
            const curTimeoutMs = cur.consecutiveAllSkip >= 1 ? SKIP_TIMEOUT_MS : QUESTION_TIMEOUT_MS;
            if (Date.now() - cur.questionStartedAt.getTime() < curTimeoutMs) return null;
            const chA = cur.hostAnswers as number[];
            const cgA = cur.guestAnswers as number[];
            const ccQ = cur.currentQ;
            if (chA.length > ccQ && cgA.length > ccQ) return null;
            const newHA = chA.length <= ccQ ? [...chA, -1] : chA;
            const newGA = cgA.length <= ccQ ? [...cgA, -1] : cgA;
            const both = newHA.length > ccQ && newGA.length > ccQ;
            const newCQ = both ? ccQ + 1 : ccQ;
            const qIds = cur.questionIds as string[];
            // 이번 턴 쌍방 스킵 여부
            const thisRoundBothSkipped = both && newHA[ccQ] === -1 && newGA[ccQ] === -1;
            const newConsecutive = thisRoundBothSkipped ? cur.consecutiveAllSkip + 1 : 0;
            // 2턴 연속 쌍방 스킵 → 무효 종료
            const isVoid = newConsecutive >= 3;
            const newStatus = both && (newCQ >= qIds.length || isVoid) ? 'FINISHED' : cur.status;
            return await tx.gameRoom.update({
              where: { id },
              data: {
                hostAnswers: newHA,
                guestAnswers: newGA,
                currentQ: newCQ,
                status: newStatus,
                consecutiveAllSkip: both ? newConsecutive : cur.consecutiveAllSkip,
                questionStartedAt: both && newCQ < qIds.length ? new Date() : cur.questionStartedAt,
              },
              include: {
                host: { select: { id: true, nickname: true } },
                guest: { select: { id: true, nickname: true } },
              },
            });
          });
          if (updated) {
            room = updated;
            await broadcastBattleUpdate(id); // 타임아웃 자동제출 → 상대방에게 즉시 알림
            if (updated.status === 'FINISHED') {
              after(broadcastBattleStatusChange());
              if (updated.guestId) after(checkBattleBadges(updated.hostId, updated.guestId).catch(() => {}));
            }
          }
        } catch { /* 동시 업데이트 무시 */ }
      }
    }
  }

  const myRole = isHost ? 'host' : 'guest';
  const questionIds = room.questionIds as string[];
  const hostAnswers = room.hostAnswers as number[];
  const guestAnswers = room.guestAnswers as number[];

  if (room.status === 'WAITING') {
    // 20초 초과 시 서버사이드 자동 취소
    const elapsed = Date.now() - room.createdAt.getTime();
    if (elapsed >= 20_000) {
      try {
        await prisma.$transaction(async (tx) => {
          const cur = await tx.gameRoom.findUnique({ where: { id, status: 'WAITING' } });
          if (!cur) return;
          if (cur.guestId) {
            const guestNotifs = await tx.notification.findMany({
              where: { userId: cur.guestId, type: 'BATTLE_INVITE' },
            });
            const toDelete = guestNotifs
              .filter((n) => (n.payload as { roomId?: string }).roomId === id)
              .map((n) => n.id);
            if (toDelete.length > 0) await tx.notification.deleteMany({ where: { id: { in: toDelete } } });
          }
          await tx.gameRoom.delete({ where: { id } });
        });
      } catch { /* 이미 취소됨 */ }
      return NextResponse.json({ error: 'waiting_timeout' }, { status: 404 });
    }

    return NextResponse.json({
      id: room.id,
      status: 'WAITING',
      category: room.category,
      host: room.host,
      guest: room.guest,
      myRole,
      createdAt: room.createdAt.toISOString(),
    });
  }

  if (room.status === 'FINISHED') {
    const questions = await prisma.question.findMany({
      where: { id: { in: questionIds } },
      select: { id: true, question: true, options: true, answer: true, explanation: true },
    });
    const sortedQs = questionIds.map((qid) => questions.find((q) => q.id === qid)!);
    // 무효 조건: 연속 쌍방 스킵 2회 (처음부터 포함)
    const isVoid = room.consecutiveAllSkip >= 3;
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
      isVoid,
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
    myPrevAnswers: isHost ? hostAnswers.slice(0, currentQ) : guestAnswers.slice(0, currentQ),
    quitRequestBy: room.quitRequestBy ?? null,
    questionStartedAt: room.questionStartedAt?.toISOString() ?? null,
    consecutiveAllSkip: room.consecutiveAllSkip,
  });
}
