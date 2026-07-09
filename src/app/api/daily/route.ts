import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';

function getToday() {
  return new Date().toISOString().slice(0, 10);
}

function dateSeed(dateStr: string): number {
  return Math.abs(dateStr.split('-').reduce((acc, part) => acc * 31 + parseInt(part), 0));
}

async function getDailyQuestion() {
  const questions = await prisma.question.findMany({
    where: { status: { in: ['OFFICIAL', 'APPROVED'] } },
    select: { id: true, category: true, question: true, options: true, answer: true, explanation: true },
    orderBy: { id: 'asc' },
  });
  if (questions.length === 0) return null;
  const today = getToday();
  const index = dateSeed(today) % questions.length;
  return questions[index];
}

export async function GET() {
  const session = await auth();
  const q = await getDailyQuestion();
  if (!q) return NextResponse.json({ error: 'No questions' }, { status: 404 });

  const today = getToday();
  const [totalAttempts, correctAttempts, completion] = await Promise.all([
    prisma.dailyChallengeCompletion.count({ where: { date: today } }),
    prisma.dailyChallengeCompletion.count({ where: { date: today, correct: true } }),
    session?.user?.id
      ? prisma.dailyChallengeCompletion.findUnique({
          where: { userId_date: { userId: session.user.id, date: today } },
        })
      : Promise.resolve(null),
  ]);

  const correctRate = totalAttempts > 0
    ? Math.round((correctAttempts / totalAttempts) * 100)
    : null;

  return NextResponse.json({
    date: today,
    id: q.id,
    category: q.category,
    question: q.question,
    options: q.options,
    attemptCount: totalAttempts,
    correctRate,
    // 인증 사용자가 이미 완료한 경우: 서버 결과 반환 (브라우저 간 일관성 보장)
    ...(completion ? {
      userCompleted: {
        correct: completion.correct,
        answer: q.answer,
        explanation: q.explanation ?? '',
      },
    } : {}),
  });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { selected } = await req.json() as { selected: number };
  const q = await getDailyQuestion();
  if (!q) return NextResponse.json({ error: 'No questions' }, { status: 404 });

  const today = getToday();
  const correct = selected === q.answer;
  const userId = session.user.id;

  // 중복 제출 차단: existing 먼저 확인 후에만 stat 업데이트
  const existing = await prisma.dailyChallengeCompletion.findUnique({
    where: { userId_date: { userId, date: today } },
  });

  if (existing) {
    const [tot, cor] = await Promise.all([
      prisma.dailyChallengeCompletion.count({ where: { date: today } }),
      prisma.dailyChallengeCompletion.count({ where: { date: today, correct: true } }),
    ]);
    return NextResponse.json({
      correct: existing.correct,
      answer: q.answer,
      explanation: q.explanation,
      correctRate: tot > 0 ? Math.round((cor / tot) * 100) : null,
      attemptCount: tot,
      alreadyCompleted: true,
    });
  }

  const updated = await prisma.dailyChallengeStat.upsert({
    where: { date: today },
    create: {
      date: today,
      questionId: q.id,
      attemptCount: 1,
      correctCount: correct ? 1 : 0,
    },
    update: {
      attemptCount: { increment: 1 },
      ...(correct ? { correctCount: { increment: 1 } } : {}),
    },
  });

  await prisma.dailyChallengeCompletion.create({
    data: { userId, date: today, correct },
  });

  try {
    const dbUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { lastQuizDate: true, streakCount: true },
    });
    const yesterdayDate = new Date(today);
    yesterdayDate.setDate(yesterdayDate.getDate() - 1);
    const yesterday = yesterdayDate.toISOString().slice(0, 10);
    let newStreakCount = 1;
    if (dbUser?.lastQuizDate) {
      const lastDate = dbUser.lastQuizDate.toISOString().slice(0, 10);
      if (lastDate === today) newStreakCount = dbUser.streakCount;
      else if (lastDate === yesterday) newStreakCount = dbUser.streakCount + 1;
    }
    await prisma.user.update({
      where: { id: userId },
      data: { streakCount: newStreakCount, lastQuizDate: new Date() },
    });
  } catch (e) {
    console.error('[daily/POST] streak update failed:', e);
  }

  const newCorrectRate = updated.attemptCount > 0
    ? Math.round((updated.correctCount / updated.attemptCount) * 100)
    : null;

  return NextResponse.json({
    correct,
    answer: q.answer,
    explanation: q.explanation,
    correctRate: newCorrectRate,
    attemptCount: updated.attemptCount,
    alreadyCompleted: false,
  });
}
