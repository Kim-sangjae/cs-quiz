import { NextResponse } from 'next/server';
import { getServerUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const user = await getServerUser();
  if (!user || user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const questions = await prisma.question.findMany({
    where: { status: 'PENDING' },
    include: { author: { select: { nickname: true, email: true } } },
    orderBy: { createdAt: 'asc' },
  });

  return NextResponse.json(questions);
}
