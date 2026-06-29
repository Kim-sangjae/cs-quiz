import { NextResponse } from 'next/server';
import { getServerUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const user = await getServerUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const sessions = await prisma.quizSession.findMany({
    where: { userId: user.id },
    orderBy: { submittedAt: 'desc' },
    select: { id: true, score: true, category: true, submittedAt: true },
  });

  return NextResponse.json({
    sessions: sessions.map((s) => ({ ...s, submittedAt: s.submittedAt.toISOString() })),
    total: sessions.length,
  });
}
