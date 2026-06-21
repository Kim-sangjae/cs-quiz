import { NextResponse } from 'next/server';
import { getServerUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const user = await getServerUser();
  if (!user || user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const today = new Date().toISOString().slice(0, 10);
  const todayStart = new Date(`${today}T00:00:00.000Z`);
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);

  const [
    onlineNow,
    todayVisitors,
    totalUsers,
    totalBattles,
    todayAttempts,
    totalAttempts,
    questionStats,
    dailyVisitsRaw,
    dailyAttemptsRaw,
  ] = await Promise.all([
    prisma.userPresence.count({ where: { lastSeenAt: { gte: twoMinutesAgo } } }),
    prisma.dailyVisit.count({ where: { date: today } }),
    prisma.user.count({ where: { deletedAt: null } }),
    prisma.gameRoom.count({ where: { status: 'FINISHED' } }),
    prisma.quizSession.count({ where: { submittedAt: { gte: todayStart } } }),
    prisma.quizSession.count(),
    prisma.question.groupBy({
      by: ['status'],
      _count: { id: true },
    }),
    prisma.dailyVisit.groupBy({
      by: ['date'],
      where: { date: { gte: thirtyDaysAgo } },
      _count: { userId: true },
      orderBy: { date: 'asc' },
    }),
    prisma.quizSession.findMany({
      where: { submittedAt: { gte: new Date(`${thirtyDaysAgo}T00:00:00.000Z`) } },
      select: { submittedAt: true },
    }),
  ]);

  const qStats = Object.fromEntries(
    questionStats.map((s) => [s.status.toLowerCase(), s._count.id])
  ) as Record<string, number>;

  const attemptsByDate: Record<string, number> = {};
  for (const s of dailyAttemptsRaw) {
    const d = s.submittedAt.toISOString().slice(0, 10);
    attemptsByDate[d] = (attemptsByDate[d] ?? 0) + 1;
  }
  const dailyAttempts = Object.entries(attemptsByDate)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, count]) => ({ date, count }));

  return NextResponse.json({
    onlineNow,
    todayVisitors,
    totalUsers,
    totalBattles,
    todayAttempts,
    totalAttempts,
    questionStats: {
      official: qStats.official ?? 0,
      approved: qStats.approved ?? 0,
      pending: qStats.pending ?? 0,
      rejected: qStats.rejected ?? 0,
      blinded: qStats.blinded ?? 0,
    },
    dailyVisits: dailyVisitsRaw.map((r) => ({ date: r.date, count: r._count.userId })),
    dailyAttempts,
  });
}
