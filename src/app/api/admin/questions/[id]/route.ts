import { NextRequest, NextResponse } from 'next/server';
import { getServerUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { generateEmbedding, toVectorString } from '@/lib/embedding';
import { writeLog } from '@/lib/audit';
import { checkQuestionBadges } from '@/lib/award-badges';

const VALID_CATEGORIES = ['ds', 'algo', 'os', 'network', 'db', 'arch'];

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getServerUser();
  if (!user || user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json() as {
    action: unknown;
    rejectionReason?: unknown;
    editData?: unknown;
  };
  const { action, rejectionReason, editData } = body;

  const VALID_ACTIONS = ['approve', 'reject', 'blind', 'unblind', 'delete', 'edit'];
  if (!VALID_ACTIONS.includes(action as string)) {
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  }

  const question = await prisma.question.findUnique({
    where: { id },
    select: { id: true, authorId: true, question: true, options: true, answer: true, status: true },
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

      writeLog({ actorId: user.id, actorRole: user.role, action: 'QUESTION_APPROVE', targetType: 'Question', targetId: id, payload: { questionTitle } });
      if (question.authorId) checkQuestionBadges(question.authorId).catch(() => {});
      // 승인 후 비동기로 임베딩 생성 — 실패해도 승인은 유지됨
      const opts = question.options as string[];
      const answerText = opts?.[question.answer] ?? '';
      const textToEmbed = answerText ? `${question.question} ${answerText}` : question.question;
      generateEmbedding(textToEmbed).then(async (embedding) => {
        const vectorStr = toVectorString(embedding);
        await prisma.$executeRaw`
          UPDATE "Question" SET embedding = ${vectorStr}::vector WHERE id = ${id}
        `;
      }).catch(() => { /* 백필 API로 나중에 처리 가능 */ });
    } else {
      const reason =
        typeof rejectionReason === 'string' && rejectionReason.trim().length > 0
          ? rejectionReason.trim()
          : '검토 결과 등록 기준에 맞지 않습니다.';

      writeLog({ actorId: user.id, actorRole: user.role, action: 'QUESTION_REJECT', targetType: 'Question', targetId: id, payload: { questionTitle, reason } });
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
    await prisma.question.update({ where: { id }, data: { status: 'BLINDED' } });
    writeLog({ actorId: user.id, actorRole: user.role, action: 'QUESTION_BLIND', targetType: 'Question', targetId: id, payload: { questionTitle } });
  } else if (action === 'unblind') {
    if (question.status !== 'BLINDED') {
      return NextResponse.json({ error: 'Not blinded' }, { status: 409 });
    }
    await prisma.question.update({
      where: { id },
      data: { status: question.status === 'BLINDED' ? 'APPROVED' : question.status },
    });
    writeLog({ actorId: user.id, actorRole: user.role, action: 'QUESTION_UNBLIND', targetType: 'Question', targetId: id, payload: { questionTitle } });
  } else if (action === 'delete') {
    await prisma.$transaction(async (tx) => {
      await tx.questionAttempt.deleteMany({ where: { questionId: id } });
      await tx.like.deleteMany({ where: { questionId: id } });
      await tx.report.deleteMany({ where: { questionId: id } });
      await tx.question.delete({ where: { id } });
    });
    writeLog({ actorId: user.id, actorRole: user.role, action: 'QUESTION_DELETE', targetType: 'Question', targetId: id, payload: { questionTitle } });
  } else if (action === 'edit') {
    const d = editData as {
      category?: unknown;
      question?: unknown;
      options?: unknown;
      answer?: unknown;
      explanation?: unknown;
    } | undefined;

    if (!d) return NextResponse.json({ error: 'editData required' }, { status: 400 });

    const category = typeof d.category === 'string' && VALID_CATEGORIES.includes(d.category)
      ? d.category : undefined;
    const questionText = typeof d.question === 'string' && d.question.trim().length > 0
      ? d.question.trim() : undefined;
    const options = Array.isArray(d.options) && d.options.length === 4 &&
      d.options.every((o) => typeof o === 'string' && o.trim().length > 0)
      ? (d.options as string[]) : undefined;
    const answer = typeof d.answer === 'number' && [0, 1, 2, 3].includes(d.answer)
      ? d.answer : undefined;
    const explanation = typeof d.explanation === 'string' && d.explanation.trim().length > 0
      ? d.explanation.trim() : undefined;

    const updateData = {
      ...(category !== undefined ? { category } : {}),
      ...(questionText !== undefined ? { question: questionText } : {}),
      ...(options !== undefined ? { options } : {}),
      ...(answer !== undefined ? { answer } : {}),
      ...(explanation !== undefined ? { explanation } : {}),
    };

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    await prisma.question.update({ where: { id }, data: updateData });
    writeLog({ actorId: user.id, actorRole: user.role, action: 'QUESTION_EDIT', targetType: 'Question', targetId: id, payload: { questionTitle, fields: Object.keys(updateData) } });
  }

  return NextResponse.json({ ok: true });
}
