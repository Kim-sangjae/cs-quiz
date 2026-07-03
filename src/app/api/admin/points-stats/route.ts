import { NextResponse } from 'next/server';
import { getServerUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const user = await getServerUser();
  if (!user || user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const [issued, spent, hintCount, avgResult] = await Promise.all([
    prisma.pointTransaction.aggregate({
      where: { delta: { gt: 0 } },
      _sum: { delta: true },
    }),
    prisma.pointTransaction.aggregate({
      where: { delta: { lt: 0 } },
      _sum: { delta: true },
    }),
    prisma.pointTransaction.count({ where: { reason: 'HINT' } }),
    prisma.user.aggregate({
      where: { deletedAt: null },
      _avg: { points: true },
    }),
  ]);

  return NextResponse.json({
    totalIssued: issued._sum.delta ?? 0,
    totalSpent: Math.abs(spent._sum.delta ?? 0),
    hintCount,
    avgPoints: avgResult._avg.points ?? 0,
  });
}
