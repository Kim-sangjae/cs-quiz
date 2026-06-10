import { NextResponse } from 'next/server';
import { getServerUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const user = await getServerUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const sessions = await prisma.quizSession.findMany({
    where: { userId: user.id },
    orderBy: { submittedAt: 'desc' },
    take: 20,
  });

  if (sessions.length === 0) return NextResponse.json({ sessions: [] });

  const allIds = new Set<string>();
  for (const s of sessions) {
    for (const id of s.questionIds as string[]) allIds.add(id);
  }

  const questions = await prisma.question.findMany({
    where: { id: { in: Array.from(allIds) } },
    select: {
      id: true,
      category: true,
      question: true,
      options: true,
      answer: true,
      explanation: true,
    },
  });

  const qMap = new Map(questions.map((q) => [q.id, q]));

  const result = sessions.map((s) => ({
    id: s.id,
    category: s.category,
    score: s.score,
    submittedAt: s.submittedAt.toISOString(),
    answers: s.answers as { questionId: string; selected: number }[],
    questions: (s.questionIds as string[])
      .map((id) => qMap.get(id))
      .filter((q): q is NonNullable<typeof q> => q !== undefined),
  }));

  return NextResponse.json({ sessions: result });
}
