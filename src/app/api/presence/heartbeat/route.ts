import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const today = new Date().toISOString().slice(0, 10);
  await Promise.all([
    prisma.userPresence.upsert({
      where: { userId: session.user.id },
      create: { userId: session.user.id },
      update: { lastSeenAt: new Date() },
    }),
    prisma.dailyVisit.upsert({
      where: { userId_date: { userId: session.user.id, date: today } },
      create: { userId: session.user.id, date: today },
      update: {},
    }),
  ]);

  return NextResponse.json({ ok: true });
}
