import { NextResponse } from 'next/server';
import { getServerUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const user = await getServerUser();
  if (!user || user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const rows = await prisma.question.groupBy({
    by: ['category'],
    where: { status: { in: ['OFFICIAL', 'APPROVED'] } },
    _count: { _all: true },
    orderBy: { category: 'asc' },
  });

  return NextResponse.json(rows.map((r) => ({ category: r.category, count: r._count._all })));
}
