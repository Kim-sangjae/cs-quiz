import { NextRequest, NextResponse } from 'next/server';
import { getServerUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';

const PAGE_SIZE = 10;

export async function GET(req: NextRequest) {
  const user = await getServerUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const url = new URL(req.url);
  const page = Math.max(0, parseInt(url.searchParams.get('page') ?? '0', 10));
  const cat = url.searchParams.get('cat') ?? 'all';

  const where: Prisma.QuestionCommentWhereInput = {
    userId: user.id,
    deletedAt: null,
    question: {
      status: { in: ['OFFICIAL', 'APPROVED'] },
      ...(cat !== 'all' ? { category: cat } : {}),
    },
  };

  const [comments, total] = await Promise.all([
    prisma.questionComment.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: page * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        content: true,
        createdAt: true,
        question: {
          select: {
            id: true,
            category: true,
            question: true,
            status: true,
          },
        },
      },
    }),
    prisma.questionComment.count({ where }),
  ]);

  return NextResponse.json({
    comments,
    total,
    pageCount: Math.ceil(total / PAGE_SIZE),
  });
}
