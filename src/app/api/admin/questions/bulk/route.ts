import { NextRequest, NextResponse } from 'next/server';
import { getServerUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { writeLog } from '@/lib/audit';
import { checkQuestionBadges } from '@/lib/award-badges';

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
      select: { authorId: true },
    });
    await prisma.question.updateMany({ where: { id: { in: ids as string[] }, status: 'PENDING' }, data: { status: 'APPROVED' } });
    writeLog({ actorId: user.id, actorRole: user.role, action: 'QUESTION_APPROVE', targetType: 'Question', targetId: ids.join(','), payload: { count: ids.length } });
    const authorIds = [...new Set(toApprove.map((q) => q.authorId).filter(Boolean))] as string[];
    for (const authorId of authorIds) checkQuestionBadges(authorId).catch(() => {});
  } else if (action === 'reject') {
    await prisma.question.updateMany({ where: { id: { in: ids as string[] }, status: 'PENDING' }, data: { status: 'REJECTED', rejectionReason: reason } });
    writeLog({ actorId: user.id, actorRole: user.role, action: 'QUESTION_REJECT', targetType: 'Question', targetId: ids.join(','), payload: { count: ids.length, reason } });
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
