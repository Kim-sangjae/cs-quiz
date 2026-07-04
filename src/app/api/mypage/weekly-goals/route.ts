import { NextRequest, NextResponse } from 'next/server';
import { getServerUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { WEEKLY_GOALS, getISOWeek, getWeekStart } from '@/lib/weekly-goals';

export async function GET() {
  const user = await getServerUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const week = getISOWeek();
  const weekStart = getWeekStart();

  const [sessions, claims] = await Promise.all([
    prisma.quizSession.findMany({
      where: { userId: user.id, submittedAt: { gte: weekStart } },
      select: { category: true, score: true, mode: true },
    }),
    prisma.weeklyGoalClaim.findMany({
      where: { userId: user.id, goalKey: { startsWith: `${week}:` } },
      select: { goalKey: true },
    }),
  ]);

  const claimedKeys = new Set(claims.map((c) => c.goalKey.split(':')[1]));

  const normalSessions = sessions.filter((s) => s.mode === 'normal');
  const reviewSessions = sessions.filter((s) => s.mode === 'review');
  const categories = new Set(normalSessions.map((s) => s.category));

  const goals = WEEKLY_GOALS.map((g) => {
    let progress = 0;
    if (g.key === 'QUIZ_3') progress = normalSessions.length;
    if (g.key === 'ACCURACY_70') progress = normalSessions.filter((s) => s.score >= 14).length > 0 ? 1 : 0;
    if (g.key === 'CATEGORY_3') progress = categories.size;
    if (g.key === 'REVIEW_1') progress = reviewSessions.length;

    const completed = progress >= g.target;
    const claimed = claimedKeys.has(g.key);

    return {
      ...g,
      progress: Math.min(progress, g.target),
      completed,
      claimed,
      ...(g.key === 'CATEGORY_3' ? { categories: [...categories] } : {}),
    };
  });

  return NextResponse.json({ goals, week });
}

export async function POST(req: NextRequest) {
  const user = await getServerUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { goalKey } = await req.json() as { goalKey?: string };
  const goal = WEEKLY_GOALS.find((g) => g.key === goalKey);
  if (!goal) return NextResponse.json({ error: 'Invalid goal' }, { status: 400 });

  const week = getISOWeek();
  const weekStart = getWeekStart();
  const claimKey = `${week}:${goalKey}`;

  // 완료 여부 재검증
  const sessions = await prisma.quizSession.findMany({
    where: { userId: user.id, submittedAt: { gte: weekStart } },
    select: { category: true, score: true, mode: true },
  });

  const normalSessions = sessions.filter((s) => s.mode === 'normal');
  const reviewSessions = sessions.filter((s) => s.mode === 'review');
  const categories = new Set(normalSessions.map((s) => s.category));

  let completed = false;
  if (goalKey === 'QUIZ_3') completed = normalSessions.length >= 3;
  if (goalKey === 'ACCURACY_70') completed = normalSessions.some((s) => s.score >= 14);
  if (goalKey === 'CATEGORY_3') completed = categories.size >= 3;
  if (goalKey === 'REVIEW_1') completed = reviewSessions.length >= 1;

  if (!completed) return NextResponse.json({ error: 'Goal not completed' }, { status: 400 });

  try {
    await prisma.$transaction([
      prisma.weeklyGoalClaim.create({ data: { userId: user.id, goalKey: claimKey, points: goal.points } }),
      prisma.user.update({ where: { id: user.id }, data: { points: { increment: goal.points } } }),
      prisma.pointTransaction.create({ data: { userId: user.id, delta: goal.points, reason: `WEEKLY_GOAL:${goalKey}` } }),
    ]);
  } catch {
    return NextResponse.json({ error: 'Already claimed' }, { status: 409 });
  }

  const newUser = await prisma.user.findUnique({ where: { id: user.id }, select: { points: true } });
  return NextResponse.json({ ok: true, points: newUser?.points ?? 0, earned: goal.points });
}
