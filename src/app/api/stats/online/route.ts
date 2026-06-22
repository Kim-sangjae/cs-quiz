import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);
  const count = await prisma.userPresence.count({
    where: { lastSeenAt: { gte: twoMinutesAgo } },
  });
  return NextResponse.json({ count });
}
