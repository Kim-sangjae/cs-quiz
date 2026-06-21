import { NextResponse } from 'next/server';
import { getServerUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const user = await getServerUser();
  if (!user || user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const today = new Date().toISOString().slice(0, 10);
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);

  const [onlineNow, todayVisitors, totalUsers, activeBattles, dailyVisitsRaw] = await Promise.all([
    prisma.userPresence.count({ where: { lastSeenAt: { gte: twoMinutesAgo } } }),
    prisma.dailyVisit.count({ where: { date: today } }),
    prisma.user.count({ where: { deletedAt: null } }),
    prisma.gameRoom.count({ where: { status: 'PLAYING' } }),
    prisma.dailyVisit.groupBy({
      by: ['date'],
      where: { date: { gte: thirtyDaysAgo } },
      _count: { userId: true },
      orderBy: { date: 'asc' },
    }),
  ]);

  const dailyVisits = dailyVisitsRaw.map((r) => ({ date: r.date, count: r._count.userId }));

  return NextResponse.json({ onlineNow, todayVisitors, totalUsers, activeBattles, dailyVisits });
}
