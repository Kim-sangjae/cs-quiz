import { NextResponse } from 'next/server';
import { questions } from '@/data/questions';
import { prisma } from '@/lib/prisma';

function getDailyQuestion() {
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const seed = today.split('-').reduce((acc, part) => acc * 31 + parseInt(part), 0);
  const index = Math.abs(seed) % questions.length;
  return questions[index];
}

export async function GET() {
  const q = getDailyQuestion();
  const dbQ = await prisma.question.findUnique({
    where: { id: q.id },
    select: { attemptCount: true, correctCount: true },
  });
  const attemptCount = dbQ?.attemptCount ?? 0;
  const correctRate = attemptCount > 0
    ? Math.round((dbQ!.correctCount / attemptCount) * 100)
    : null;
  return NextResponse.json({
    date: new Date().toISOString().slice(0, 10),
    id: q.id,
    category: q.category,
    question: q.question,
    options: q.options,
    attemptCount,
    correctRate,
  });
}

export async function POST(req: Request) {
  const { selected } = await req.json() as { selected: number };
  const q = getDailyQuestion();
  const correct = selected === q.answer;

  // 오늘의 문제 답변 통계를 DB에 반영
  await prisma.question.update({
    where: { id: q.id },
    data: {
      attemptCount: { increment: 1 },
      ...(correct ? { correctCount: { increment: 1 } } : {}),
    },
  }).catch(() => {});

  return NextResponse.json({ correct, answer: q.answer, explanation: q.explanation });
}
