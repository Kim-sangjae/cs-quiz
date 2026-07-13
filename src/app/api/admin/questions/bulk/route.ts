import { NextRequest, NextResponse } from 'next/server';
import { getServerUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { writeLog } from '@/lib/audit';
import { checkQuestionBadges } from '@/lib/award-badges';
import { generateEmbedding, toVectorString } from '@/lib/embedding';
import { XP_REWARDS } from '@/lib/user-level';

export async function POST(req: NextRequest) {
  const user = await getServerUser();
  if (!user || user.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await req.json() as { ids: unknown; action: unknown; rejectionReason?: unknown };
  const { ids, action, rejectionReason } = body;

  if (!Array.isArray(ids) || ids.length === 0) return NextResponse.json({ error: 'ids required' }, { status: 400 });
  const VALID = ['approve', 'reject', 'blind', 'delete'];
  if (!VALID.includes(action as string)) return NextResponse.json({ error: 'Invalid action' }, { status: 400 });

  const reason = typeof rejectionReason === 'string' && rejectionReason.trim()
    ? rejectionReason.trim()
    : '검토 결과 등록 기준에 맞지 않습니다.';

  if (action === 'approve') {
    const toApprove = await prisma.question.findMany({
      where: { id: { in: ids as string[] }, status: 'PENDING' },
      select: { id: true, authorId: true, question: true, options: true, answer: true },
    });
    await prisma.$transaction(async (tx) => {
      await tx.question.updateMany({ where: { id: { in: toApprove.map((q) => q.id) } }, data: { status: 'APPROVED' } });
      const notifications = toApprove.filter((q) => q.authorId).map((q) => ({
        userId: q.authorId!,
        type: 'QUESTION_APPROVED' as const,
        payload: { questionId: q.id, questionTitle: q.question.slice(0, 50) },
        actionUrl: `/board/${q.id}`,
      }));
      if (notifications.length > 0) await tx.notification.createMany({ data: notifications });
      // 작성자별 문제 승인 경험치 (단건 승인과 동일 정책)
      const xpByAuthor = new Map<string, number>();
      for (const q of toApprove) {
        if (q.authorId) xpByAuthor.set(q.authorId, (xpByAuthor.get(q.authorId) ?? 0) + XP_REWARDS.QUESTION_APPROVED);
      }
      for (const [authorId, xp] of xpByAuthor) {
        await tx.user.update({ where: { id: authorId }, data: { xp: { increment: xp } } });
      }
    });
    writeLog({ actorId: user.id, actorRole: user.role, action: 'QUESTION_APPROVE', targetType: 'Question', targetId: ids.join(','), payload: { count: toApprove.length } });
    const authorIds = [...new Set(toApprove.map((q) => q.authorId).filter(Boolean))] as string[];
    for (const authorId of authorIds) checkQuestionBadges(authorId).catch(() => {});
    // 비동기 임베딩 생성
    for (const q of toApprove) {
      const opts = q.options as string[];
      const answerText = opts?.[q.answer] ?? '';
      const textToEmbed = answerText ? `${q.question} ${answerText}` : q.question;
      generateEmbedding(textToEmbed).then(async (embedding) => {
        const vectorStr = toVectorString(embedding);
        await prisma.$executeRaw`UPDATE "Question" SET embedding = ${vectorStr}::vector WHERE id = ${q.id}`;
      }).catch(() => {});
    }
  } else if (action === 'reject') {
    const toReject = await prisma.question.findMany({
      where: { id: { in: ids as string[] }, status: 'PENDING' },
      select: { id: true, authorId: true, question: true },
    });
    await prisma.$transaction(async (tx) => {
      await tx.question.updateMany({ where: { id: { in: toReject.map((q) => q.id) } }, data: { status: 'REJECTED', rejectionReason: reason } });
      const notifications = toReject.filter((q) => q.authorId).map((q) => ({
        userId: q.authorId!,
        type: 'QUESTION_REJECTED' as const,
        payload: { questionId: q.id, questionTitle: q.question.slice(0, 50), rejectionReason: reason },
        actionUrl: `/mypage`,
      }));
      if (notifications.length > 0) await tx.notification.createMany({ data: notifications });
    });
    writeLog({ actorId: user.id, actorRole: user.role, action: 'QUESTION_REJECT', targetType: 'Question', targetId: ids.join(','), payload: { count: toReject.length, reason } });
  } else if (action === 'blind') {
    await prisma.question.updateMany({ where: { id: { in: ids as string[] }, status: { not: 'BLINDED' } }, data: { status: 'BLINDED' } });
    writeLog({ actorId: user.id, actorRole: user.role, action: 'QUESTION_BLIND', targetType: 'Question', targetId: ids.join(','), payload: { count: ids.length } });
  } else if (action === 'delete') {
    await prisma.$transaction(async (tx) => {
      await tx.questionAttempt.deleteMany({ where: { questionId: { in: ids as string[] } } });
      await tx.like.deleteMany({ where: { questionId: { in: ids as string[] } } });
      await tx.report.deleteMany({ where: { questionId: { in: ids as string[] } } });
      await tx.question.deleteMany({ where: { id: { in: ids as string[] } } });
    });
    writeLog({ actorId: user.id, actorRole: user.role, action: 'QUESTION_DELETE', targetType: 'Question', targetId: ids.join(','), payload: { count: ids.length } });
  }

  return NextResponse.json({ ok: true });
}
