import { NextRequest, NextResponse } from 'next/server';
import { getServerUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getServerUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  const existing = await prisma.like.findUnique({
    where: { userId_questionId: { userId: user.id, questionId: id } },
  });

  if (existing) {
    await prisma.like.delete({
      where: { userId_questionId: { userId: user.id, questionId: id } },
    });
  } else {
    await prisma.like.create({
      data: { userId: user.id, questionId: id },
    });
  }

  const likeCount = await prisma.like.count({ where: { questionId: id } });

  return NextResponse.json({ liked: !existing, likeCount });
}
