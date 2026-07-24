import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getKSTDateStr } from '@/lib/kst';

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const today = getKSTDateStr();
  const userId = session.user.id;

  const [existing] = await Promise.all([
    prisma.dailyVisit.findUnique({ where: { userId_date: { userId, date: today } }, select: { userId: true } }),
    prisma.userPresence.upsert({
      where: { userId },
      create: { userId },
      update: { lastSeenAt: new Date() },
    }),
  ]);

  if (!existing) {
    await prisma.dailyVisit.create({ data: { userId, date: today } }).catch(() => {});
  }

  return NextResponse.json({ ok: true });
}
