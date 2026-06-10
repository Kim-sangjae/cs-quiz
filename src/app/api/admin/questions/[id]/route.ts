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

  if (action !== 'approve' && action !== 'reject') {
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  }

  const question = await prisma.question.findUnique({
    where: { id },
    select: { id: true, authorId: true, question: true, status: true },
  });

  if (!question) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (question.status !== 'PENDING') {
    return NextResponse.json({ error: 'Question is not pending' }, { status: 409 });
  }

  const questionTitle = question.question.slice(0, 50);

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

  return NextResponse.json({ ok: true });
}
