import { NextResponse } from 'next/server';
import { getServerUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const user = await getServerUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const [totalSessions, dbUser, attempts] = await Promise.all([
    prisma.quizSession.count({ where: { userId: user.id } }),
    prisma.user.findUnique({
      where: { id: user.id },
      select: { streakCount: true },
    }),
    prisma.questionAttempt.findMany({
      where: { userId: user.id },
      select: {
        isCorrect: true,
        question: { select: { category: true } },
      },
    }),
  ]);

  const totalAttempts = attempts.length;
  const totalCorrect = attempts.filter((a) => a.isCorrect).length;
  const overallAccuracy =
    totalAttempts > 0 ? Math.round((totalCorrect / totalAttempts) * 100) : 0;

  const catMap = new Map<string, { total: number; correct: number }>();
  for (const a of attempts) {
    const cat = a.question.category;
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

  return NextResponse.json({
    totalSessions,
    overallAccuracy,
    weakestCategory,
    streakCount: dbUser?.streakCount ?? 0,
  });
}
