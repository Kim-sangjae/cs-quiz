import { NextResponse } from 'next/server';
import { getServerUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const user = await getServerUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const [userData, transactions] = await Promise.all([
    prisma.user.findUnique({ where: { id: user.id }, select: { points: true } }),
    prisma.pointTransaction.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: { id: true, delta: true, reason: true, createdAt: true },
    }),
  ]);

  return NextResponse.json({ points: userData?.points ?? 0, transactions });
}
