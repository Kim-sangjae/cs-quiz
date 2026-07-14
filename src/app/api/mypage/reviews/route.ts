import { NextResponse } from 'next/server';
import { getServerUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getKSTMidnight } from '@/lib/kst';

export async function GET() {
  const user = await getServerUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // KST 기준 오늘 자정까지(=내일 KST 자정 직전) 도래한 복습을 "오늘의 복습"으로 취급
  const endOfToday = getKSTMidnight(1);

  const [due, total] = await Promise.all([
    prisma.reviewSchedule.findMany({
      where: { userId: user.id, nextReviewAt: { lt: endOfToday } },
      select: { questionId: true, step: true },
      orderBy: { nextReviewAt: 'asc' },
    }),
    prisma.reviewSchedule.count({ where: { userId: user.id } }),
  ]);

  return NextResponse.json({ due, total });
}
