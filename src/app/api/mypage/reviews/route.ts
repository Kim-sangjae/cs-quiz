import { NextResponse } from 'next/server';
import { getServerUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const user = await getServerUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const endOfToday = new Date();
  endOfToday.setHours(23, 59, 59, 999);

  const [due, total] = await Promise.all([
    prisma.reviewSchedule.findMany({
      where: { userId: user.id, nextReviewAt: { lte: endOfToday } },
      select: { questionId: true, step: true },
      orderBy: { nextReviewAt: 'asc' },
    }),
    prisma.reviewSchedule.count({ where: { userId: user.id } }),
  ]);

  return NextResponse.json({ due, total });
}
