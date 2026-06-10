import { NextRequest, NextResponse } from 'next/server';
import type { QuestionStatus } from '@prisma/client';
import { getServerUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

const STATUS_MAP: Record<string, QuestionStatus[]> = {
  all: ['PENDING', 'APPROVED', 'REJECTED'],
  pending: ['PENDING'],
  approved: ['APPROVED'],
  rejected: ['REJECTED'],
};

export async function GET(req: NextRequest) {
  const user = await getServerUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const statusParam = searchParams.get('status') ?? 'all';
  const statusFilter = STATUS_MAP[statusParam] ?? STATUS_MAP.all;

  const questions = await prisma.question.findMany({
    where: {
      authorId: user.id,
      status: { in: statusFilter },
    },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      category: true,
      question: true,
      status: true,
      rejectionReason: true,
      createdAt: true,
      _count: { select: { likes: true } },
    },
  });

  return NextResponse.json({ questions });
}
