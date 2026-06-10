import { NextRequest, NextResponse } from 'next/server';
import { getServerUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

const VALID_CATEGORIES = new Set(['ds', 'algo', 'os', 'network', 'db', 'arch']);

export async function GET(req: NextRequest) {
  const user = await getServerUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const category = searchParams.get('category');
  if (!category || !VALID_CATEGORIES.has(category)) {
    return NextResponse.json({ error: 'Invalid category' }, { status: 400 });
  }

  const wrongAttempts = await prisma.questionAttempt.findMany({
    where: {
      userId: user.id,
      isCorrect: false,
      question: { category },
    },
    orderBy: { attemptedAt: 'desc' },
    include: {
      question: {
        select: {
          id: true,
          category: true,
          question: true,
          options: true,
          answer: true,
          explanation: true,
        },
      },
    },
  });

  // 1패스: 문제별 틀린 횟수 집계
  const wrongCounts = new Map<string, number>();
  for (const a of wrongAttempts) {
    wrongCounts.set(a.questionId, (wrongCounts.get(a.questionId) ?? 0) + 1);
  }

  // 2패스: 최신 오답 기준 dedupe (attemptedAt desc 정렬이므로 첫 번째가 최신)
  const seen = new Set<string>();
  const items: {
    question: (typeof wrongAttempts)[0]['question'];
    selected: number;
    wrongCount: number;
  }[] = [];

  for (const a of wrongAttempts) {
    if (!seen.has(a.questionId)) {
      seen.add(a.questionId);
      items.push({
        question: a.question,
        selected: a.selected,
        wrongCount: wrongCounts.get(a.questionId) ?? 1,
      });
    }
  }

  return NextResponse.json({ items });
}
