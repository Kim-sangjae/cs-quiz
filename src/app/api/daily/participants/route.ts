import { NextResponse } from 'next/server';
import { getServerUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getKSTDateStr } from '@/lib/kst';

export async function GET() {
  const user = await getServerUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const today = getKSTDateStr();

  const completions = await prisma.dailyChallengeCompletion.findMany({
    where: { date: today },
    select: {
      correct: true,
      user: { select: { id: true, nickname: true } },
    },
    orderBy: { createdAt: 'asc' },
  });

  return NextResponse.json({
    participants: completions.map((c) => ({
      userId: c.user.id,
      nickname: c.user.nickname ?? '(닉네임 없음)',
      correct: c.correct,
    })),
  });
}
