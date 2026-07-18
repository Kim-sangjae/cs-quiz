import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { getServerUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import type { UserAnswer } from '@/types';
import type { BadgeType } from '@/lib/badges';
import { awardBadges } from '@/lib/award-badges';
import { updateReviewSchedules } from '@/lib/review-schedule';
import { getKSTDateStr } from '@/lib/kst';
import { quizXp } from '@/lib/user-level';
import { isRateLimited } from '@/lib/rate-limit';

export async function POST(req: NextRequest) {
  const user = await getServerUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // 동일 세션 스크립트 반복 제출로 XP/포인트/뱃지를 무제한 파밍하는 것 방지
  if (await isRateLimited(`quiz-submit:${user.id}`, 10, 60)) {
    return NextResponse.json({ error: '퀴즈 제출이 너무 잦습니다. 잠시 후 다시 시도하세요.' }, { status: 429 });
  }

  const body = await req.json() as {
    category: string;
    questionIds: string[];
    answers: UserAnswer[];
    mode?: string;
  };
  const { category, questionIds, answers, mode = 'normal' } = body;

  if (!Array.isArray(questionIds) || questionIds.length > 30 ||
      !Array.isArray(answers) || answers.length > 30) {
    return NextResponse.json({ error: 'Invalid' }, { status: 400 });
  }

  const safeMode = ['normal', 'review', 'timed'].includes(mode) ? mode : 'normal';
  const isRanked = safeMode !== 'review'; // review 모드는 뱃지/레벨업/출석 제외

  const prevAttemptCount = isRanked
    ? await prisma.questionAttempt.count({ where: { userId: user.id, question: { category } } })
    : 0;

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
        mode: safeMode,
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

  if (isRanked) {
    // Level-up detection
    const KNOWN_CATEGORIES = new Set(['ds', 'algo', 'os', 'network', 'db', 'arch', 'se']);
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

    // Badge checks
    try {
      const todayStr = getKSTDateStr();
      const yesterdayStr = new Date(Date.now() + 9 * 3600_000 - 86400_000).toISOString().slice(0, 10);
      const userProfile = await prisma.user.findUnique({
        where: { id: user.id },
        select: { streakCount: true, lastQuizDate: true },
      });
      let newStreak = 1;
      if (userProfile?.lastQuizDate) {
        const lastStr = new Date(userProfile.lastQuizDate.getTime() + 9 * 3600_000).toISOString().slice(0, 10);
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

      const totalSessions = await prisma.quizSession.count({
        where: { userId: user.id, mode: { in: ['normal', 'timed'] } },
      });
      const candidates: BadgeType[] = [];

      if (totalSessions >= 1) candidates.push('FIRST_QUIZ');
      if (totalSessions >= 10) candidates.push('QUIZ_10');
      if (totalSessions >= 50) candidates.push('QUIZ_50');
      if (score === questionIds.length && questionIds.length > 0) candidates.push('PERFECT_SCORE');
      if (newStreak >= 3) candidates.push('STREAK_3');
      if (newStreak >= 7) candidates.push('STREAK_7');

      if (category !== 'all') {
        const catSessions = await prisma.quizSession.findMany({
          where: { userId: user.id, category, mode: { in: ['normal', 'timed'] } },
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

      const everWrong = await prisma.questionAttempt.findMany({
        where: { userId: user.id, isCorrect: false },
        select: { questionId: true },
        distinct: ['questionId'],
      });
      if (everWrong.length >= 10) {
        const overcame = await prisma.questionAttempt.findMany({
          where: { userId: user.id, questionId: { in: everWrong.map((e) => e.questionId) }, isCorrect: true },
          select: { questionId: true },
          distinct: ['questionId'],
        });
        if (overcame.length >= 10) candidates.push('COMEBACK');
      }

      const REQUIRED_CATS = ['ds', 'algo', 'os', 'network', 'db', 'arch'];
      const catCounts = await prisma.quizSession.groupBy({
        by: ['category'],
        where: { userId: user.id, category: { in: REQUIRED_CATS }, mode: { in: ['normal', 'timed'] } },
        _count: { _all: true },
      });
      const allCatsCompleted = REQUIRED_CATS.every(
        (cat) => (catCounts.find((c) => c.category === cat)?._count._all ?? 0) >= 5,
      );
      if (allCatsCompleted) candidates.push('COMPLETIONIST');

      await awardBadges(user.id, candidates);
    } catch (e) {
      console.error('[sessions/POST] badge check failed:', e);
    }
  }

  updateReviewSchedules(
    user.id,
    answersWithCorrectness.map((a) => ({ questionId: a.questionId, isCorrect: a.isCorrect }))
  ).catch(() => {});

  // 유저 레벨 경험치: 모든 모드 지급 (기본 10 + 정답당 1)
  let xpEarned = quizXp(score);
  try {
    await prisma.user.update({
      where: { id: user.id },
      data: { xp: { increment: xpEarned } },
    });
  } catch (e) {
    console.error('[sessions/POST] xp award failed:', e);
    xpEarned = 0;
  }

  // 일반/시간제한 모드: 정답률에 따라 포인트 지급
  let pointsEarned = 0;
  if (isRanked) {
    const accuracy = questionIds.length > 0 ? score / questionIds.length : 0;
    pointsEarned = accuracy >= 0.7 ? 5 : 2;
    try {
      await prisma.$transaction([
        prisma.user.update({
          where: { id: user.id },
          data: { points: { increment: pointsEarned } },
        }),
        prisma.pointTransaction.create({
          data: {
            userId: user.id,
            delta: pointsEarned,
            reason: accuracy >= 0.7 ? 'QUIZ_COMPLETE_HIGH' : 'QUIZ_COMPLETE_LOW',
          },
        }),
      ]);
    } catch (e) {
      console.error('[sessions/POST] point award failed:', e);
      pointsEarned = 0;
    }
  }

  return NextResponse.json({ sessionId: session.id, pointsEarned, xpEarned });
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
