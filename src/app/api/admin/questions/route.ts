import { NextRequest, NextResponse } from 'next/server';
import { getServerUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

const PAGE_SIZE = 10;
const VALID_CATEGORIES = ['ds', 'algo', 'os', 'network', 'db', 'arch', 'se'];

export async function GET(req: NextRequest) {
  const user = await getServerUser();
  if (!user || user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { searchParams } = req.nextUrl;
  const cat = searchParams.get('category') ?? 'all';
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));

  const where = {
    status: 'PENDING' as const,
    ...(cat !== 'all' && VALID_CATEGORIES.includes(cat) ? { category: cat } : {}),
  };

  const [total, questions] = await Promise.all([
    prisma.question.count({ where }),
    prisma.question.findMany({
      where,
      select: {
        id: true, category: true, question: true,
        options: true, answer: true, explanation: true, createdAt: true,
        author: { select: { nickname: true, email: true } },
      },
      orderBy: { createdAt: 'asc' },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
  ]);

  // 카테고리별 PENDING 수 (필터 탭에 표시용)
  const categoryCounts = await prisma.question.groupBy({
    by: ['category'],
    where: { status: 'PENDING' },
    _count: { _all: true },
  });

  return NextResponse.json({
    questions,
    total,
    pageCount: Math.ceil(total / PAGE_SIZE),
    categoryCounts: categoryCounts.map((c) => ({ category: c.category, count: c._count._all })),
  });
}
