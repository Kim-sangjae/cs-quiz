import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { isRateLimited } from '@/lib/rate-limit';
import { sendMail, ADMIN_EMAIL, escapeHtml } from '@/lib/mailer';

const VALID_REASONS = ['INAPPROPRIATE_NICKNAME', 'HARASSMENT', 'SPAM', 'OTHER'] as const;
type Reason = typeof VALID_REASONS[number];

const REASON_LABEL: Record<Reason, string> = {
  INAPPROPRIATE_NICKNAME: '부적절한 닉네임', HARASSMENT: '괴롭힘/욕설', SPAM: '스팸', OTHER: '기타',
};

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  if (await isRateLimited(`report:${session.user.id}`, 10, 60)) {
    return NextResponse.json({ error: '신고를 너무 빠르게 접수하고 있습니다. 잠시 후 다시 시도하세요.' }, { status: 429 });
  }

  const { id: reportedId } = await params;
  if (reportedId === session.user.id) {
    return NextResponse.json({ error: 'Cannot report yourself' }, { status: 400 });
  }

  const body = await req.json() as { reason?: unknown; description?: unknown };
  const reason = body.reason as Reason;
  if (!VALID_REASONS.includes(reason)) {
    return NextResponse.json({ error: 'Invalid reason' }, { status: 400 });
  }
  const description = typeof body.description === 'string' ? body.description.slice(0, 200) : undefined;

  const reported = await prisma.user.findUnique({ where: { id: reportedId }, select: { id: true, nickname: true } });
  if (!reported) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  const existing = await prisma.userReport.findUnique({
    where: { reporterId_reportedId: { reporterId: session.user.id, reportedId } },
  });
  if (existing) {
    return NextResponse.json({ error: '이미 신고한 사용자입니다' }, { status: 409 });
  }

  await prisma.userReport.create({
    data: { reporterId: session.user.id, reportedId, reason, description },
  });

  sendMail({
    to: ADMIN_EMAIL(),
    subject: `[CSORA] 유저 신고: ${reported.nickname ?? reportedId}`,
    html: `
      <h3>유저 신고가 접수되었습니다</h3>
      <table style="border-collapse:collapse;width:100%;font-family:sans-serif">
        <tr><td style="padding:6px 12px;color:#888">사유</td><td style="padding:6px 12px">${REASON_LABEL[reason]}</td></tr>
        <tr><td style="padding:6px 12px;color:#888">신고자</td><td style="padding:6px 12px">${escapeHtml(session.user.nickname ?? session.user.id)}</td></tr>
        <tr><td style="padding:6px 12px;color:#888">피신고자</td><td style="padding:6px 12px">${escapeHtml(reported.nickname ?? reportedId)}</td></tr>
        ${description ? `<tr><td style="padding:6px 12px;color:#888;vertical-align:top">설명</td><td style="padding:6px 12px;white-space:pre-wrap">${escapeHtml(description)}</td></tr>` : ''}
      </table>
      <p style="margin-top:16px"><a href="${process.env.NEXTAUTH_URL}/admin?tab=reports" style="color:#6366f1">관리자 패널에서 확인 →</a></p>
    `,
  }).catch(() => {});

  return NextResponse.json({ ok: true });
}
