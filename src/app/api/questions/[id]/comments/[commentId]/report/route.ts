import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { isRateLimited } from '@/lib/rate-limit';
import { sendMail, ADMIN_EMAIL, escapeHtml } from '@/lib/mailer';

const REASON_LABEL: Record<string, string> = {
  INAPPROPRIATE: '부적절한 내용', SPAM: '스팸', HARASSMENT: '괴롭힘/욕설', OTHER: '기타',
};

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; commentId: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  if (await isRateLimited(`report:${session.user.id}`, 10, 60)) {
    return NextResponse.json({ error: '신고를 너무 빠르게 접수하고 있습니다. 잠시 후 다시 시도하세요.' }, { status: 429 });
  }

  const { commentId } = await params;
  const body = await req.json() as { reason?: string; description?: string };
  const { reason, description } = body;

  const VALID_REASONS = ['INAPPROPRIATE', 'SPAM', 'HARASSMENT', 'OTHER'];
  if (!reason || !VALID_REASONS.includes(reason)) {
    return NextResponse.json({ error: 'Invalid reason' }, { status: 400 });
  }

  const comment = await prisma.questionComment.findUnique({
    where: { id: commentId },
    select: { id: true, deletedAt: true, blinded: true, userId: true, content: true, user: { select: { nickname: true } } },
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

  sendMail({
    to: ADMIN_EMAIL(),
    subject: `[CSORA] 댓글 신고: ${(comment.user.nickname ?? '익명')}님의 댓글`,
    html: `
      <h3>댓글 신고가 접수되었습니다</h3>
      <table style="border-collapse:collapse;width:100%;font-family:sans-serif">
        <tr><td style="padding:6px 12px;color:#888">사유</td><td style="padding:6px 12px">${REASON_LABEL[reason] ?? reason}</td></tr>
        <tr><td style="padding:6px 12px;color:#888">신고자</td><td style="padding:6px 12px">${escapeHtml(session.user.nickname ?? session.user.id)}</td></tr>
        <tr><td style="padding:6px 12px;color:#888">작성자</td><td style="padding:6px 12px">${escapeHtml(comment.user.nickname ?? '익명')}</td></tr>
        <tr><td style="padding:6px 12px;color:#888;vertical-align:top">댓글 내용</td><td style="padding:6px 12px;white-space:pre-wrap">${escapeHtml(comment.content)}</td></tr>
        ${description ? `<tr><td style="padding:6px 12px;color:#888;vertical-align:top">설명</td><td style="padding:6px 12px;white-space:pre-wrap">${escapeHtml(description)}</td></tr>` : ''}
      </table>
      <p style="margin-top:16px"><a href="${process.env.NEXTAUTH_URL}/admin?tab=reports" style="color:#6366f1">관리자 패널에서 확인 →</a></p>
    `,
  }).catch(() => {});

  return NextResponse.json({ ok: true });
}
