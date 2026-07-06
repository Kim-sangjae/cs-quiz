import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; commentId: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { commentId } = await params;
  const body = await req.json() as { reason?: string; description?: string };
  const { reason, description } = body;

  const VALID_REASONS = ['INAPPROPRIATE', 'SPAM', 'HARASSMENT', 'OTHER'];
  if (!reason || !VALID_REASONS.includes(reason)) {
    return NextResponse.json({ error: 'Invalid reason' }, { status: 400 });
  }

  const comment = await prisma.questionComment.findUnique({
    where: { id: commentId },
    select: { id: true, deletedAt: true, blinded: true, userId: true },
  });
  if (!comment || comment.deletedAt || comment.blinded) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  if (comment.userId === session.user.id) {
    return NextResponse.json({ error: 'Cannot report own comment' }, { status: 400 });
  }

  try {
    await prisma.commentReport.create({
      data: {
        reporterId: session.user.id,
        commentId,
        reason: reason as 'INAPPROPRIATE' | 'SPAM' | 'HARASSMENT' | 'OTHER',
        description: description?.trim() || null,
      },
    });
  } catch {
    return NextResponse.json({ error: 'Already reported' }, { status: 409 });
  }

  return NextResponse.json({ ok: true });
}
