import { NextRequest, NextResponse } from 'next/server';
import { getServerUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getServerUser();
  if (!user || user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json() as { action: unknown; rejectionReason?: unknown };
  const { action, rejectionReason } = body;

  const VALID_ACTIONS = ['approve', 'reject', 'blind', 'unblind', 'delete'];
  if (!VALID_ACTIONS.includes(action as string)) {
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  }

  const question = await prisma.question.findUnique({
    where: { id },
    select: { id: true, authorId: true, question: true, status: true },
  });

  if (!question) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const questionTitle = question.question.slice(0, 50);

  if (action === 'approve' || action === 'reject') {
    if (question.status !== 'PENDING') {
      return NextResponse.json({ error: 'Question is not pending' }, { status: 409 });
    }

    if (action === 'approve') {
      await prisma.$transaction(async (tx) => {
        await tx.question.update({ where: { id }, data: { status: 'APPROVED' } });
        if (question.authorId) {
          await tx.notification.create({
            data: {
              userId: question.authorId,
              type: 'QUESTION_APPROVED',
              payload: { questionId: id, questionTitle },
              actionUrl: `/board/${id}`,
            },
          });
        }
      });
    } else {
      const reason =
        typeof rejectionReason === 'string' && rejectionReason.trim().length > 0
          ? rejectionReason.trim()
          : '검토 결과 등록 기준에 맞지 않습니다.';

      await prisma.$transaction(async (tx) => {
        await tx.question.update({
          where: { id },
          data: { status: 'REJECTED', rejectionReason: reason },
        });
        if (question.authorId) {
          await tx.notification.create({
            data: {
              userId: question.authorId,
              type: 'QUESTION_REJECTED',
              payload: { questionId: id, questionTitle, rejectionReason: reason },
              actionUrl: `/mypage`,
            },
          });
        }
      });
    }
  } else if (action === 'blind') {
    if (question.status === 'BLINDED') {
      return NextResponse.json({ error: 'Already blinded' }, { status: 409 });
    }
    if (question.status === 'OFFICIAL') {
      return NextResponse.json({ error: 'Cannot blind official questions' }, { status: 400 });
    }
    await prisma.question.update({ where: { id }, data: { status: 'BLINDED' } });
  } else if (action === 'unblind') {
    if (question.status !== 'BLINDED') {
      return NextResponse.json({ error: 'Not blinded' }, { status: 409 });
    }
    await prisma.question.update({ where: { id }, data: { status: 'APPROVED' } });
  } else if (action === 'delete') {
    if (question.status === 'OFFICIAL') {
      return NextResponse.json({ error: 'Cannot delete official questions' }, { status: 400 });
    }
    await prisma.$transaction(async (tx) => {
      await tx.questionAttempt.deleteMany({ where: { questionId: id } });
      await tx.like.deleteMany({ where: { questionId: id } });
      await tx.report.deleteMany({ where: { questionId: id } });
      await tx.question.delete({ where: { id } });
    });
  }

  return NextResponse.json({ ok: true });
}
