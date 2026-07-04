import { NextRequest, NextResponse } from 'next/server';
import { getServerUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

const PAGE_SIZE = 50;

export async function GET(req: NextRequest) {
  const user = await getServerUser();
  if (!user || user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
  const filterUser = searchParams.get('user') ?? '';

  const where = filterUser
    ? { user: { OR: [{ nickname: { contains: filterUser, mode: 'insensitive' as const } }, { email: { contains: filterUser, mode: 'insensitive' as const } }] } }
    : {};

  const [totalCount, transactions] = await Promise.all([
    prisma.pointTransaction.count({ where }),
    prisma.pointTransaction.findMany({
      where,
      select: {
        id: true,
        delta: true,
        reason: true,
        createdAt: true,
        user: { select: { nickname: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
  ]);

  return NextResponse.json({
    transactions,
    totalCount,
    pageCount: Math.ceil(totalCount / PAGE_SIZE),
  });
}
