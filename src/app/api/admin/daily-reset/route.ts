import { NextResponse } from 'next/server';
import { getServerUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getKSTDateStr } from '@/lib/kst';

export async function DELETE() {
  const user = await getServerUser();
  if (!user || user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const today = getKSTDateStr();
  const [completions, stat] = await Promise.all([
    prisma.dailyChallengeCompletion.deleteMany({ where: { date: today } }),
    prisma.dailyChallengeStat.deleteMany({ where: { date: today } }),
  ]);

  return NextResponse.json({
    deleted: { completions: completions.count, stat: stat.count },
    date: today,
  });
}
