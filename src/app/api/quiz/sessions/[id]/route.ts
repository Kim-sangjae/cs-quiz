import { NextRequest, NextResponse } from 'next/server';
import { getServerUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import type { Question, UserAnswer, Category } from '@/types';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getServerUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  const session = await prisma.quizSession.findUnique({ where: { id } });
  if (!session) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (session.userId !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const questionIds = session.questionIds as string[];
  const dbQuestions = await prisma.question.findMany({
    where: { id: { in: questionIds } },
  });

  const questionsMap = new Map(dbQuestions.map((q) => [q.id, q]));
  const questions: Question[] = questionIds
    .map((qid) => {
      const q = questionsMap.get(qid);
      if (!q) return null;
      return {
        id: q.id,
        category: q.category as Category,
        question: q.question,
        options: q.options as [string, string, string, string],
        answer: q.answer as 0 | 1 | 2 | 3,
        explanation: q.explanation,
      };
    })
    .filter((q): q is Question => q !== null);

  return NextResponse.json({
    session,
    questions,
    answers: session.answers as unknown as UserAnswer[],
  });
}
