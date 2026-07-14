import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

const VALID_REASONS = ['INAPPROPRIATE_NICKNAME', 'HARASSMENT', 'SPAM', 'OTHER'] as const;
type Reason = typeof VALID_REASONS[number];

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id: reportedId } = await params;
  if (reportedId === session.user.id) {
    return NextResponse.json({ error: 'Cannot report yourself' }, { status: 400 });
  }

  const body = await req.json() as { reason?: unknown; description?: unknown };
  const reason = body.reason as Reason;
  if (!VALID_REASONS.includes(reason)) {
    return NextResponse.json({ error: 'Invalid reason' }, { status: 400 });
  }
  const description = typeof body.description === 'string' ? body.description.slice(0, 200) : undefined;

  const reported = await prisma.user.findUnique({ where: { id: reportedId }, select: { id: true } });
  if (!reported) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  const existing = await prisma.userReport.findUnique({
    where: { reporterId_reportedId: { reporterId: session.user.id, reportedId } },
  });
  if (existing) {
    return NextResponse.json({ error: '이미 신고한 사용자입니다' }, { status: 409 });
  }

  await prisma.userReport.create({
    data: { reporterId: session.user.id, reportedId, reason, description },
  });

  return NextResponse.json({ ok: true });
}
