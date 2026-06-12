import { NextRequest, NextResponse } from 'next/server';
import { getServerUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

const PAGE_SIZE = 20;
const VALID_CATEGORIES = ['ds', 'algo', 'os', 'network', 'db', 'arch'];
const ALL_STATUSES = ['OFFICIAL', 'PENDING', 'APPROVED', 'REJECTED', 'BLINDED'] as const;
type QuestionStatus = typeof ALL_STATUSES[number];

export async function GET(req: NextRequest) {
  const user = await getServerUser();
  if (!user || user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { searchParams } = req.nextUrl;
  const statusFilter = searchParams.get('status') ?? 'all';
  const cat = searchParams.get('cat') ?? 'all';
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));

  const statusIn: QuestionStatus[] =
    ALL_STATUSES.includes(statusFilter.toUpperCase() as QuestionStatus)
      ? [statusFilter.toUpperCase() as QuestionStatus]
      : [...ALL_STATUSES];

  const where = {
    status: { in: statusIn },
    ...(cat !== 'all' && VALID_CATEGORIES.includes(cat) ? { category: cat } : {}),
  };

  const [totalCount, questions] = await Promise.all([
    prisma.question.count({ where }),
    prisma.question.findMany({
      where,
      select: {
        id: true,
        category: true,
        question: true,
        options: true,
        answer: true,
        explanation: true,
        status: true,
        createdAt: true,
        author: { select: { nickname: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
  ]);

  return NextResponse.json({
    questions,
    totalCount,
    pageCount: Math.ceil(totalCount / PAGE_SIZE),
  });
}
