import { NextResponse } from 'next/server';
import { getServerUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const user = await getServerUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const CATS = ['ds', 'algo', 'os', 'network', 'db', 'arch'];

  const [totalSessions, dbUser, attempts, completions, questionTotals, triedByCategory] = await Promise.all([
    prisma.quizSession.count({ where: { userId: user.id } }),
    prisma.user.findUnique({
      where: { id: user.id },
      select: { streakCount: true },
    }),
    prisma.$queryRaw<{ isCorrect: boolean; category: string }[]>`
      SELECT qa."isCorrect", q.category
      FROM "QuestionAttempt" qa
      JOIN "Question" q ON qa."questionId" = q.id
      WHERE qa."userId" = ${user.id}
    `,
    prisma.dailyChallengeCompletion.findMany({
      where: { userId: user.id },
      select: { date: true, correct: true },
      orderBy: { date: 'desc' },
      take: 90,
    }),
    prisma.question.groupBy({
      by: ['category'],
      where: { status: { in: ['OFFICIAL', 'APPROVED'] } },
      _count: { _all: true },
    }),
    prisma.$queryRaw<{ category: string; tried: bigint }[]>`
      SELECT q.category, COUNT(DISTINCT qa."questionId") AS tried
      FROM "QuestionAttempt" qa
      JOIN "Question" q ON qa."questionId" = q.id
      WHERE qa."userId" = ${user.id}
      GROUP BY q.category
    `,
  ]);

  const totalAttempts = attempts.length;
  const totalCorrect = attempts.filter((a) => a.isCorrect).length;
  const overallAccuracy =
    totalAttempts > 0 ? Math.round((totalCorrect / totalAttempts) * 100) : 0;

  const catMap = new Map<string, { total: number; correct: number }>();
  for (const a of attempts) {
    const cat = a.category;
    const e = catMap.get(cat) ?? { total: 0, correct: 0 };
    e.total++;
    if (a.isCorrect) e.correct++;
    catMap.set(cat, e);
  }

  let weakestCategory: string | null = null;
  let lowestAcc = Infinity;
  for (const [cat, { total, correct }] of catMap) {
    if (total < 5) continue;
    const acc = correct / total;
    if (acc < lowestAcc) {
      lowestAcc = acc;
      weakestCategory = cat;
    }
  }

  const categoryAttemptCounts: Record<string, number> = {};
  const categoryAccuracy: Record<string, number> = {};
  for (const [cat, { total, correct }] of catMap) {
    categoryAttemptCounts[cat] = total;
    categoryAccuracy[cat] = total > 0 ? Math.round((correct / total) * 100) : 0;
  }

  const categoryProgress: Record<string, { total: number; tried: number }> = {};
  for (const cat of CATS) {
    const totalEntry = questionTotals.find((q) => q.category === cat);
    const triedEntry = triedByCategory.find((q) => q.category === cat);
    categoryProgress[cat] = {
      total: totalEntry?._count._all ?? 0,
      tried: Number(triedEntry?.tried ?? 0),
    };
  }

  return NextResponse.json({
    totalSessions,
    overallAccuracy,
    weakestCategory,
    streakCount: dbUser?.streakCount ?? 0,
    categoryAttemptCounts,
    categoryAccuracy,
    dailyCompletions: completions.map((c) => ({ date: c.date, correct: c.correct })),
    categoryProgress,
  });
}
