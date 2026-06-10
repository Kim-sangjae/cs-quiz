import { NextRequest, NextResponse } from 'next/server';
import { getServerUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

const VALID_REASONS = ['INAPPROPRIATE', 'ERROR', 'DUPLICATE', 'OTHER'] as const;
type ReportReason = (typeof VALID_REASONS)[number];

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getServerUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  const question = await prisma.question.findUnique({
    where: { id },
    select: { authorId: true },
  });

  if (!question) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  if (question.authorId === user.id) {
    return NextResponse.json({ error: '본인 문제는 신고할 수 없습니다' }, { status: 403 });
  }

  const existing = await prisma.report.findUnique({
    where: { reporterId_questionId: { reporterId: user.id, questionId: id } },
  });

  if (existing) {
    return NextResponse.json({ error: '이미 신고한 문제입니다' }, { status: 409 });
  }

  const body = await req.json();
  const reason = body.reason as ReportReason;
  const description: string | undefined = body.description;

  if (!VALID_REASONS.includes(reason)) {
    return NextResponse.json({ error: 'Invalid reason' }, { status: 400 });
  }

  await prisma.report.create({
    data: {
      reporterId: user.id,
      questionId: id,
      reason,
      description: description ?? null,
      status: 'PENDING',
    },
  });

  return NextResponse.json({ ok: true }, { status: 201 });
}
