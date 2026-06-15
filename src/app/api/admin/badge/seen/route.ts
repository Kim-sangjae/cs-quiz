import { NextResponse } from 'next/server';
import { getServerUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function POST() {
  const user = await getServerUser();
  if (!user || user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const current = await prisma.user.findUnique({
    where: { id: user.id },
    select: { adminLastSeenAt: true },
  });
  const prevSeenAt = current?.adminLastSeenAt?.toISOString() ?? null;

  await prisma.user.update({
    where: { id: user.id },
    data: { adminLastSeenAt: new Date() },
  });

  return NextResponse.json({ prevSeenAt });
}
