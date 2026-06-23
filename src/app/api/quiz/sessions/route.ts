import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { getServerUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import type { UserAnswer } from '@/types';
import type { BadgeType } from '@/lib/badges';
import { awardBadges } from '@/lib/award-badges';
import { updateReviewSchedules } from '@/lib/review-schedule';

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

  // Badge checks — outside transaction; failure must not block response
  try {
    // Streak update
    const todayStr = new Date().toISOString().slice(0, 10);
    const yesterdayStr = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    const userProfile = await prisma.user.findUnique({
      where: { id: user.id },
      select: { streakCount: true, lastQuizDate: true },
    });
    let newStreak = 1;
    if (userProfile?.lastQuizDate) {
      const lastStr = new Date(userProfile.lastQuizDate).toISOString().slice(0, 10);
      if (lastStr === todayStr) {
        newStreak = userProfile.streakCount;
      } else if (lastStr === yesterdayStr) {
        newStreak = userProfile.streakCount + 1;
      }
    }
    await prisma.user.update({
      where: { id: user.id },
      data: { streakCount: newStreak, lastQuizDate: new Date() },
    });

    // Candidate badges
    const totalSessions = await prisma.quizSession.count({ where: { userId: user.id } });
    const candidates: BadgeType[] = [];

    if (totalSessions === 1) candidates.push('FIRST_QUIZ');
    if (totalSessions === 10) candidates.push('QUIZ_10');
    if (totalSessions === 50) candidates.push('QUIZ_50');
    if (score === questionIds.length && questionIds.length > 0) candidates.push('PERFECT_SCORE');
    if (newStreak >= 3) candidates.push('STREAK_3');
    if (newStreak >= 7) candidates.push('STREAK_7');

    // Category mastery (해당 카테고리 10회 이상 + 평균 정답률 80% 이상)
    if (category !== 'all') {
      const catSessions = await prisma.quizSession.findMany({
        where: { userId: user.id, category },
        select: { score: true, questionIds: true },
      });
      if (catSessions.length >= 15) {
        const avgAccuracy =
          catSessions.reduce((sum, s) => sum + s.score / (s.questionIds as string[]).length, 0) /
          catSessions.length;
        if (avgAccuracy >= 0.8) {
          candidates.push(`CAT_${category.toUpperCase()}` as BadgeType);
        }
      }
    }

    // 오답 극복: 이번 세션에서 맞춘 문제 중 이전에 틀린 적 있는 문제 존재
    const correctIds = answersWithCorrectness.filter((a) => a.isCorrect).map((a) => a.questionId);
    if (correctIds.length > 0) {
      const priorWrong = await prisma.questionAttempt.count({
        where: { userId: user.id, questionId: { in: correctIds }, isCorrect: false, sessionId: { not: session.id } },
      });
      if (priorWrong > 0) candidates.push('COMEBACK');
    }

    // 완주: 6개 카테고리 모두 1회 이상 플레이
    const REQUIRED_CATS = ['ds', 'algo', 'os', 'network', 'db', 'arch'];
    const completedCats = await prisma.quizSession.findMany({
      where: { userId: user.id, category: { in: REQUIRED_CATS } },
      select: { category: true },
      distinct: ['category'],
    });
    if (completedCats.length === REQUIRED_CATS.length) candidates.push('COMPLETIONIST');

    await awardBadges(user.id, candidates);
  } catch (e) {
    console.error('[sessions/POST] badge check failed:', e);
  }

  updateReviewSchedules(
    user.id,
    answersWithCorrectness.map((a) => ({ questionId: a.questionId, isCorrect: a.isCorrect }))
  ).catch(() => {});

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
