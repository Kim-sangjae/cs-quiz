import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const userId = session.user.id;

  const [received, sent] = await Promise.all([
    prisma.friendship.findMany({
      where: { addresseeId: userId, status: 'PENDING' },
      include: { requester: { select: { id: true, nickname: true } } },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.friendship.findMany({
      where: { requesterId: userId, status: 'PENDING' },
      include: { addressee: { select: { id: true, nickname: true } } },
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  return NextResponse.json({
    received: received.map((f) => ({
      id: f.id,
      userId: f.requester.id,
      nickname: f.requester.nickname ?? '(닉네임 없음)',
    })),
    sent: sent.map((f) => ({
      id: f.id,
      userId: f.addressee.id,
      nickname: f.addressee.nickname ?? '(닉네임 없음)',
    })),
  });
}
