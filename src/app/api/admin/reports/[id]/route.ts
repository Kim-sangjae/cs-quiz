import { NextRequest, NextResponse } from 'next/server';
import { getServerUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { writeLog } from '@/lib/audit';
import { REPORT_RESOLUTION_REASONS, reportResolutionLabel } from '@/lib/report-resolution';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getServerUser();
  if (!user || user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id: questionId } = await params;
  const body = await req.json() as { action: unknown; resolutionReason?: unknown; resolutionNote?: unknown };
  const { action } = body;

  if (action !== 'blind' && action !== 'dismiss') {
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  }

  const resolutionReason = REPORT_RESOLUTION_REASONS.some((r) => r.value === body.resolutionReason)
    ? (body.resolutionReason as string)
    : (action === 'blind' ? 'BLINDED' : 'NO_ISSUE');
  const resolutionNote = typeof body.resolutionNote === 'string' ? body.resolutionNote.trim().slice(0, 300) : '';

  const question = await prisma.question.findUnique({
    where: { id: questionId },
    select: { id: true, question: true },
  });
  if (!question) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // 알림 대상은 갱신 전에 미리 조회 — updateMany는 갱신된 행을 반환하지 않음
  const pendingReporters = await prisma.report.findMany({
    where: { questionId, status: 'PENDING' },
    select: { reporterId: true },
  });

  if (action === 'blind') {
    await prisma.$transaction(async (tx) => {
      await tx.question.update({
        where: { id: questionId },
        data: { status: 'BLINDED' },
      });
      await tx.report.updateMany({
        where: { questionId, status: 'PENDING' },
        data: { status: 'REVIEWED' },
      });
    });
    writeLog({ actorId: user.id, actorRole: user.role, action: 'REPORT_BLIND', targetType: 'Question', targetId: questionId });
  } else {
    await prisma.report.updateMany({
      where: { questionId, status: 'PENDING' },
      data: { status: 'REVIEWED' },
    });
    writeLog({ actorId: user.id, actorRole: user.role, action: 'REPORT_DISMISS', targetType: 'Question', targetId: questionId });
  }

  if (pendingReporters.length > 0) {
    await prisma.notification.createMany({
      data: pendingReporters.map(({ reporterId }) => ({
        userId: reporterId,
        type: 'REPORT_RESOLVED' as const,
        payload: {
          questionId,
          questionTitle: question.question.slice(0, 50),
          resolution: reportResolutionLabel(resolutionReason),
          note: resolutionNote || undefined,
        },
        actionUrl: `/board/${questionId}`,
      })),
    });
  }

  return NextResponse.json({ ok: true });
}
