import { NextResponse } from 'next/server';
import { getServerUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const user = await getServerUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const likes = await prisma.like.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
    include: {
      question: {
        select: { id: true, category: true, question: true, status: true },
      },
    },
  });

  return NextResponse.json({ questions: likes.map((l) => l.question) });
}
