import { NextRequest, NextResponse } from 'next/server';
import { getServerUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

const PAGE_SIZE = 20;

export async function GET(req: NextRequest) {
  const user = await getServerUser();
  if (!user || user.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const search = searchParams.get('search') ?? '';
  const category = searchParams.get('category') ?? '';
  const sort = searchParams.get('sort') === 'oldest' ? 'asc' : 'desc';
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'));

  const where = {
    deletedAt: null,
    ...(search ? { content: { contains: search, mode: 'insensitive' as const } } : {}),
    ...(category ? { question: { category } } : {}),
  };

  const [total, comments] = await Promise.all([
    prisma.questionComment.count({ where }),
    prisma.questionComment.findMany({
      where,
      orderBy: { createdAt: sort },
      take: PAGE_SIZE,
      skip: (page - 1) * PAGE_SIZE,
      select: {
        id: true,
        content: true,
        blinded: true,
        createdAt: true,
        user: { select: { nickname: true } },
        question: { select: { id: true, question: true, category: true } },
      },
    }),
  ]);

  return NextResponse.json({ comments, total, pageCount: Math.ceil(total / PAGE_SIZE) });
}
