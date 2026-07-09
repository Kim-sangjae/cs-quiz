import { NextResponse } from 'next/server';
import { getServerUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

function getToday() {
  return new Date().toISOString().slice(0, 10);
}

export async function DELETE() {
  const user = await getServerUser();
  if (!user || user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const today = getToday();
  const [completions, stat] = await Promise.all([
    prisma.dailyChallengeCompletion.deleteMany({ where: { date: today } }),
    prisma.dailyChallengeStat.deleteMany({ where: { date: today } }),
  ]);

  return NextResponse.json({
    deleted: { completions: completions.count, stat: stat.count },
    date: today,
  });
}
