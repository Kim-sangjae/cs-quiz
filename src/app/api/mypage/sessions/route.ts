import { NextRequest, NextResponse } from 'next/server';
import { getServerUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  const user = await getServerUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const page = Math.max(0, parseInt(searchParams.get('page') ?? '0'));
  const pageSize = Math.min(20, Math.max(1, parseInt(searchParams.get('pageSize') ?? '5')));
  const sort = searchParams.get('sort') ?? 'newest';

  const orderBy =
    sort === 'oldest'     ? { submittedAt: 'asc'  as const } :
    sort === 'wrong_desc' ? { score:       'asc'  as const } :
    sort === 'wrong_asc'  ? { score:       'desc' as const } :
                            { submittedAt: 'desc' as const };

  const [total, sessions] = await Promise.all([
    prisma.quizSession.count({ where: { userId: user.id } }),
    prisma.quizSession.findMany({
      where: { userId: user.id },
      orderBy,
      take: pageSize,
      skip: page * pageSize,
    }),
  ]);

  if (sessions.length === 0) return NextResponse.json({ sessions: [], total });

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
    mode: s.mode,
    submittedAt: s.submittedAt.toISOString(),
    answers: s.answers as { questionId: string; selected: number }[],
    questions: (s.questionIds as string[])
      .map((id) => qMap.get(id))
      .filter((q): q is NonNullable<typeof q> => q !== undefined),
  }));

  return NextResponse.json({ sessions: result, total });
}
