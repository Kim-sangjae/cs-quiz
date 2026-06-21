import { NextRequest, NextResponse } from 'next/server';
import { getServerUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

function groupByKey(dates: string[], keyFn: (d: string) => string): Record<string, number> {
  const map: Record<string, number> = {};
  for (const d of dates) {
    const k = keyFn(d);
    map[k] = (map[k] ?? 0) + 1;
  }
  return map;
}

export async function GET(req: NextRequest) {
  const user = await getServerUser();
  if (!user || user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const period = (searchParams.get('period') ?? 'day') as 'day' | 'month' | 'year';

  const today = new Date().toISOString().slice(0, 10);
  const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);

  const chartFrom =
    period === 'year'
      ? new Date(Date.now() - 5 * 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
      : period === 'month'
      ? new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
      : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const keyFn = (date: string) =>
    period === 'day' ? date : period === 'month' ? date.slice(0, 7) : date.slice(0, 4);

  const [
    onlineNow,
    totalUsers,
    totalBattles,
    totalAttempts,
    questionStats,
    inquiryStats,
    pendingReports,
    reviewedReports,
    visitRows,
    sessionRows,
  ] = await Promise.all([
    prisma.userPresence.count({ where: { lastSeenAt: { gte: twoMinutesAgo } } }),
    prisma.user.count({ where: { deletedAt: null } }),
    prisma.gameRoom.count({ where: { status: 'FINISHED' } }),
    prisma.quizSession.count(),
    prisma.question.groupBy({ by: ['status'], _count: { id: true } }),
    prisma.inquiry.groupBy({ by: ['status'], _count: { id: true } }),
    prisma.report.count({ where: { status: 'PENDING' } }),
    prisma.report.count({ where: { status: 'REVIEWED' } }),
    prisma.dailyVisit.findMany({ where: { date: { gte: chartFrom } }, select: { date: true } }),
    prisma.quizSession.findMany({
      where: { submittedAt: { gte: new Date(`${chartFrom}T00:00:00.000Z`) } },
      select: { submittedAt: true },
    }),
  ]);

  const visitsByKey = groupByKey(visitRows.map((r) => r.date), keyFn);
  const attemptsByKey = groupByKey(
    sessionRows.map((r) => r.submittedAt.toISOString().slice(0, 10)),
    keyFn
  );

  const allKeys = [...new Set([...Object.keys(visitsByKey), ...Object.keys(attemptsByKey)])].sort();
  const chartVisits = allKeys.map((label) => ({ label, count: visitsByKey[label] ?? 0 }));
  const chartAttempts = allKeys.map((label) => ({ label, count: attemptsByKey[label] ?? 0 }));

  const periodKey = keyFn(today);
  const periodVisitors = visitsByKey[periodKey] ?? 0;
  const periodAttempts = attemptsByKey[periodKey] ?? 0;

  const qMap = Object.fromEntries(questionStats.map((s) => [s.status, s._count.id]));
  const iMap = Object.fromEntries(inquiryStats.map((s) => [s.status, s._count.id]));

  return NextResponse.json({
    onlineNow,
    periodVisitors,
    periodAttempts,
    totalUsers,
    totalBattles,
    totalAttempts,
    questionStats: {
      official: qMap.OFFICIAL ?? 0,
      approved: qMap.APPROVED ?? 0,
      pending: qMap.PENDING ?? 0,
      rejected: qMap.REJECTED ?? 0,
      blinded: qMap.BLINDED ?? 0,
    },
    inquiryStats: {
      pending: iMap.PENDING ?? 0,
      inProgress: iMap.IN_PROGRESS ?? 0,
      resolved: iMap.RESOLVED ?? 0,
    },
    reportStats: { pending: pendingReports, reviewed: reviewedReports },
    chartVisits,
    chartAttempts,
  });
}
