import { NextResponse } from 'next/server';
import { questions } from '@/data/questions';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';

function getDailyQuestion() {
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const seed = today.split('-').reduce((acc, part) => acc * 31 + parseInt(part), 0);
  const index = Math.abs(seed) % questions.length;
  return questions[index];
}

function getToday() {
  return new Date().toISOString().slice(0, 10);
}

export async function GET() {
  const q = getDailyQuestion();
  const today = getToday();

  const stat = await prisma.dailyChallengeStat.findUnique({ where: { date: today } });
  const attemptCount = stat?.attemptCount ?? 0;
  const correctRate = attemptCount > 0
    ? Math.round((stat!.correctCount / attemptCount) * 100)
    : null;

  return NextResponse.json({
    date: today,
    id: q.id,
    category: q.category,
    question: q.question,
    options: q.options,
    attemptCount,
    correctRate,
  });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { selected } = await req.json() as { selected: number };
  const q = getDailyQuestion();
  const today = getToday();
  const correct = selected === q.answer;

  const dbQ = await prisma.question.findFirst({
    where: { question: q.question },
    select: { id: true },
  });

  const updated = await prisma.dailyChallengeStat.upsert({
    where: { date: today },
    create: {
      date: today,
      questionId: dbQ?.id ?? '',
      attemptCount: 1,
      correctCount: correct ? 1 : 0,
    },
    update: {
      attemptCount: { increment: 1 },
      ...(correct ? { correctCount: { increment: 1 } } : {}),
    },
  });

  const newCorrectRate = updated.attemptCount > 0
    ? Math.round((updated.correctCount / updated.attemptCount) * 100)
    : null;

  return NextResponse.json({
    correct,
    answer: q.answer,
    explanation: q.explanation,
    correctRate: newCorrectRate,
    attemptCount: updated.attemptCount,
  });
}
