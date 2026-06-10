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
