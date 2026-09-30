import { NextRequest, NextResponse } from 'next/server';
import { getServerUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { writeLog } from '@/lib/audit';
import { reportResolutionLabel } from '@/lib/report-resolution';

export async function POST(req: NextRequest) {
  const user = await getServerUser();
  if (!user || user.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await req.json() as { questionIds: unknown; action: unknown };
  const { questionIds, action } = body;

  if (!Array.isArray(questionIds) || questionIds.length === 0) return NextResponse.json({ error: 'questionIds required' }, { status: 400 });
  if (action !== 'blind' && action !== 'dismiss') return NextResponse.json({ error: 'Invalid action' }, { status: 400 });

  // 알림 대상은 갱신 전에 미리 조회 — updateMany는 갱신된 행을 반환하지 않음
  const pendingReports = await prisma.report.findMany({
    where: { questionId: { in: questionIds as string[] }, status: 'PENDING' },
    select: { reporterId: true, questionId: true, question: { select: { question: true } } },
  });

  if (action === 'blind') {
    await prisma.$transaction(async (tx) => {
      await tx.question.updateMany({ where: { id: { in: questionIds as string[] }, status: { not: 'BLINDED' } }, data: { status: 'BLINDED' } });
      await tx.report.updateMany({ where: { questionId: { in: questionIds as string[] }, status: 'PENDING' }, data: { status: 'REVIEWED' } });
    });
    writeLog({ actorId: user.id, actorRole: user.role, action: 'REPORT_BLIND', targetType: 'Question', targetId: questionIds.join(','), payload: { count: questionIds.length } });
  } else {
    await prisma.report.updateMany({ where: { questionId: { in: questionIds as string[] }, status: 'PENDING' }, data: { status: 'REVIEWED' } });
    writeLog({ actorId: user.id, actorRole: user.role, action: 'REPORT_DISMISS', targetType: 'Question', targetId: questionIds.join(','), payload: { count: questionIds.length } });
  }

  if (pendingReports.length > 0) {
    const resolution = reportResolutionLabel(action === 'blind' ? 'BLINDED' : 'NO_ISSUE');
    await prisma.notification.createMany({
      data: pendingReports.map(({ reporterId, questionId, question }) => ({
        userId: reporterId,
        type: 'REPORT_RESOLVED' as const,
        payload: { questionId, questionTitle: question.question.slice(0, 50), resolution },
        actionUrl: `/board/${questionId}`,
      })),
    });
  }

  return NextResponse.json({ ok: true });
}
