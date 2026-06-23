import { NextResponse } from 'next/server';
import { getServerUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const user = await getServerUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const badges = await prisma.userBadge.findMany({
    where: { userId: user.id },
    select: { badge: true, earnedAt: true },
    orderBy: { earnedAt: 'asc' },
  });

  return NextResponse.json({ badges });
}
