import { NextResponse } from 'next/server';
import { getServerUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getKSTMidnight } from '@/lib/kst';

export async function GET() {
  const user = await getServerUser();
  if (!user || user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const today = getKSTMidnight();

  const [dbSizeResult, aiQGenToday, aiQGenTotal, aiOptGenToday, aiOptGenTotal] = await Promise.all([
    prisma.$queryRaw<[{ size: string }]>`SELECT pg_size_pretty(pg_database_size(current_database())) AS size`,
    prisma.auditLog.count({ where: { action: 'AI_QUESTION_GENERATE', createdAt: { gte: today } } }),
    prisma.auditLog.count({ where: { action: 'AI_QUESTION_GENERATE' } }),
    prisma.auditLog.count({ where: { action: 'AI_OPTION_GENERATE', createdAt: { gte: today } } }),
    prisma.auditLog.count({ where: { action: 'AI_OPTION_GENERATE' } }),
  ]);

  return NextResponse.json({
    dbSize: dbSizeResult[0]?.size ?? '-',
    aiQGenToday,
    aiQGenTotal,
    aiOptGenToday,
    aiOptGenTotal,
  });
}
