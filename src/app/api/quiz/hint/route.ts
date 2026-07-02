import { NextRequest, NextResponse } from 'next/server';
import { getServerUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

const HINT_COST = 30;

export async function POST(req: NextRequest) {
  const user = await getServerUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { questionId } = await req.json() as { questionId?: string };
  if (!questionId) return NextResponse.json({ error: 'questionId required' }, { status: 400 });

  const [userData, question] = await Promise.all([
    prisma.user.findUnique({ where: { id: user.id }, select: { points: true } }),
    prisma.question.findUnique({ where: { id: questionId }, select: { answer: true, options: true } }),
  ]);

  if (!userData || userData.points < HINT_COST) {
    return NextResponse.json({ error: 'Insufficient points' }, { status: 402 });
  }
  if (!question) return NextResponse.json({ error: 'Question not found' }, { status: 404 });

  // 정답이 아닌 보기 중 하나를 랜덤 선택
  const wrongOptions = [0, 1, 2, 3].filter((i) => i !== question.answer);
  const eliminateIndex = wrongOptions[Math.floor(Math.random() * wrongOptions.length)];

  await prisma.$transaction([
    prisma.user.update({ where: { id: user.id }, data: { points: { decrement: HINT_COST } } }),
    prisma.pointTransaction.create({ data: { userId: user.id, delta: -HINT_COST, reason: 'HINT' } }),
  ]);

  const newPoints = userData.points - HINT_COST;
  return NextResponse.json({ eliminateIndex, newPoints });
}
