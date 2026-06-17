import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { getServerUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import type { UserAnswer } from '@/types';

export async function POST(req: NextRequest) {
  const user = await getServerUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json() as {
    category: string;
    questionIds: string[];
    answers: UserAnswer[];
  };
  const { category, questionIds, answers } = body;

  const prevAttemptCount = await prisma.questionAttempt.count({
    where: { userId: user.id, question: { category } },
  });

  const dbQuestions = await prisma.question.findMany({
    where: { id: { in: questionIds } },
    select: { id: true, answer: true },
  });

  const correctAnswerMap: Record<string, number> = {};
  for (const q of dbQuestions) {
    correctAnswerMap[q.id] = q.answer;
  }

  const answersWithCorrectness = answers.map((ans) => ({
    ...ans,
    isCorrect: ans.selected === correctAnswerMap[ans.questionId],
  }));
  const score = answersWithCorrectness.filter((a) => a.isCorrect).length;

  const session = await prisma.$transaction(async (tx) => {
    const created = await tx.quizSession.create({
      data: {
        userId: user.id,
        category,
        questionIds: questionIds as unknown as Prisma.InputJsonValue,
        answers: answers as unknown as Prisma.InputJsonValue,
        score,
      },
    });

    await tx.questionAttempt.createMany({
      data: answersWithCorrectness.map((ans) => ({
        userId: user.id,
        questionId: ans.questionId,
        sessionId: created.id,
        selected: ans.selected,
        isCorrect: ans.isCorrect,
      })),
    });

    for (const ans of answersWithCorrectness) {
      await tx.question.update({
        where: { id: ans.questionId },
        data: {
          attemptCount: { increment: 1 },
          ...(ans.isCorrect ? { correctCount: { increment: 1 } } : {}),
        },
      });
    }

    return created;
  });

  // Streak update — outside transaction; failure must not affect quiz save
  try {
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { lastQuizDate: true, streakCount: true },
    });

    const today = new Date().toISOString().slice(0, 10);
    const yesterdayDate = new Date(today);
    yesterdayDate.setDate(yesterdayDate.getDate() - 1);
    const yesterday = yesterdayDate.toISOString().slice(0, 10);

    let newStreakCount = 1;
    if (dbUser?.lastQuizDate) {
      const lastDate = dbUser.lastQuizDate.toISOString().slice(0, 10);
      if (lastDate === today) {
        newStreakCount = dbUser.streakCount;
      } else if (lastDate === yesterday) {
        newStreakCount = dbUser.streakCount + 1;
      }
      // else: reset to 1 (already set above)
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { streakCount: newStreakCount, lastQuizDate: new Date() },
    });
  } catch (e) {
    console.error('[sessions/POST] streak update failed:', e);
  }

  // Level-up detection — outside transaction; failure must not block response
  const KNOWN_CATEGORIES = new Set(['ds', 'algo', 'os', 'network', 'db', 'arch']);
  if (KNOWN_CATEGORIES.has(category)) {
    try {
      function getLevel(total: number): number {
        if (total >= 300) return 4;
        if (total >= 150) return 3;
        if (total >= 50) return 2;
        return 1;
      }
      const LEVEL_NAMES: Record<number, string> = { 1: '입문', 2: '학습', 3: '숙련', 4: '마스터' };
      const newAttemptCount = prevAttemptCount + answers.length;
      const prevLevel = getLevel(prevAttemptCount);
      const newLevel = getLevel(newAttemptCount);
      if (newLevel > prevLevel) {
        await prisma.notification.create({
          data: {
            userId: user.id,
            type: 'LEVEL_UP',
            payload: { category, prevLevel, newLevel, levelName: LEVEL_NAMES[newLevel] },
            actionUrl: '/mypage',
          },
        });
      }
    } catch (e) {
      console.error('[sessions/POST] level-up check failed:', e);
    }
  }

  return NextResponse.json({ sessionId: session.id });
}

export async function GET() {
  const user = await getServerUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const sessions = await prisma.quizSession.findMany({
    where: { userId: user.id },
    orderBy: { submittedAt: 'desc' },
    take: 20,
  });

  return NextResponse.json({ sessions });
}
