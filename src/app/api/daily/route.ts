import { NextResponse } from 'next/server';
import { questions } from '@/data/questions';
import { prisma } from '@/lib/prisma';

function getDailyQuestion() {
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const seed = today.split('-').reduce((acc, part) => acc * 31 + parseInt(part), 0);
  const index = Math.abs(seed) % questions.length;
  return questions[index];
}

async function getDailyQuestionDbRecord() {
  const q = getDailyQuestion();
  const dbQ = await prisma.question.findFirst({
    where: { question: q.question },
    select: { id: true, attemptCount: true, correctCount: true },
  });
  return { q, dbQ };
}

export async function GET() {
  const { q, dbQ } = await getDailyQuestionDbRecord();
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
  const { q, dbQ } = await getDailyQuestionDbRecord();
  const correct = selected === q.answer;

  let newAttemptCount = 0;
  let newCorrectRate: number | null = null;

  if (dbQ) {
    const updatedQ = await prisma.question.update({
      where: { id: dbQ.id },
      data: {
        attemptCount: { increment: 1 },
        ...(correct ? { correctCount: { increment: 1 } } : {}),
      },
      select: { attemptCount: true, correctCount: true },
    }).catch(() => null);

    newAttemptCount = updatedQ?.attemptCount ?? 0;
    newCorrectRate = newAttemptCount > 0
      ? Math.round((updatedQ!.correctCount / newAttemptCount) * 100)
      : null;
  }

  return NextResponse.json({
    correct,
    answer: q.answer,
    explanation: q.explanation,
    correctRate: newCorrectRate,
    attemptCount: newAttemptCount,
  });
}
