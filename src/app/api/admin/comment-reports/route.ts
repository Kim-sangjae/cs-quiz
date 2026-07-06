import { NextRequest, NextResponse } from 'next/server';
import { getServerUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { writeLog } from '@/lib/audit';

export async function GET() {
  const user = await getServerUser();
  if (!user || user.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const reports = await prisma.commentReport.findMany({
    select: {
      id: true,
      reason: true,
      description: true,
      status: true,
      createdAt: true,
      commentId: true,
      reporter: { select: { nickname: true } },
      comment: {
        select: {
          id: true,
          content: true,
          deletedAt: true,
          userId: true,
          user: { select: { nickname: true } },
          question: { select: { id: true, question: true, category: true } },
        },
      },
    },
    orderBy: { createdAt: 'asc' },
  });

  // 댓글별로 그룹핑
  const map = new Map<string, {
    commentId: string;
    comment: typeof reports[number]['comment'];
    reportCount: number;
    latestReportAt: string;
    dismissed: boolean;
    reports: typeof reports;
  }>();

  for (const report of reports) {
    if (!map.has(report.commentId)) {
      map.set(report.commentId, {
        commentId: report.commentId,
        comment: report.comment,
        reportCount: 0,
        latestReportAt: report.createdAt.toISOString(),
        dismissed: true,
        reports: [],
      });
    }
    const entry = map.get(report.commentId)!;
    entry.reportCount += 1;
    entry.latestReportAt = report.createdAt.toISOString();
    entry.reports.push(report);
    if (report.status === 'PENDING') entry.dismissed = false;
  }

  const grouped = Array.from(map.values()).sort((a, b) => b.reportCount - a.reportCount);
  return NextResponse.json(grouped);
}

export async function PATCH(req: NextRequest) {
  const user = await getServerUser();
  if (!user || user.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await req.json() as { commentId: string; action: string };
  const { commentId, action } = body;

  if (!['delete', 'dismiss'].includes(action)) {
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  }

  const comment = await prisma.questionComment.findUnique({
    where: { id: commentId },
    select: { userId: true, questionId: true, content: true },
  });
  if (!comment) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  if (action === 'delete') {
    // 신고 사유 수집 (대표 사유 1개)
    const pendingReports = await prisma.commentReport.findMany({
      where: { commentId, status: 'PENDING' },
      select: { reason: true },
    });
    const reasonLabel: Record<string, string> = {
      INAPPROPRIATE: '부적절한 내용',
      SPAM: '스팸/광고',
      HARASSMENT: '욕설/비방',
      OTHER: '기타',
    };
    const primaryReason = pendingReports[0]?.reason ?? 'OTHER';
    const commentPreview = comment.content.length > 30
      ? comment.content.slice(0, 30) + '…'
      : comment.content;

    await prisma.$transaction([
      prisma.questionComment.update({ where: { id: commentId }, data: { deletedAt: new Date() } }),
      prisma.commentReport.updateMany({ where: { commentId, status: 'PENDING' }, data: { status: 'REVIEWED' } }),
      prisma.notification.create({
        data: {
          userId: comment.userId,
          type: 'COMMENT_DELETED',
          payload: {
            reason: reasonLabel[primaryReason] ?? '기타',
            commentPreview,
          },
          actionUrl: `/board/${comment.questionId}`,
        },
      }),
    ]);
    writeLog({ actorId: user.id, actorRole: user.role, action: 'COMMENT_DELETE', targetType: 'Comment', targetId: commentId });
  } else {
    await prisma.commentReport.updateMany({ where: { commentId, status: 'PENDING' }, data: { status: 'REVIEWED' } });
  }

  return NextResponse.json({ ok: true });
}
