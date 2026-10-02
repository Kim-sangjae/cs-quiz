import { NextRequest, NextResponse } from 'next/server';
import { getServerUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { isRateLimited } from '@/lib/rate-limit';
import { sendMail, ADMIN_EMAIL, escapeHtml } from '@/lib/mailer';

const VALID_REASONS = ['INAPPROPRIATE', 'ERROR', 'DUPLICATE', 'OTHER'] as const;
type ReportReason = (typeof VALID_REASONS)[number];

const REASON_LABEL: Record<ReportReason, string> = {
  INAPPROPRIATE: '부적절한 내용', ERROR: '오류/오답', DUPLICATE: '중복 문제', OTHER: '기타',
};

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getServerUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  if (await isRateLimited(`report:${user.id}`, 10, 60)) {
    return NextResponse.json({ error: '신고를 너무 빠르게 접수하고 있습니다. 잠시 후 다시 시도하세요.' }, { status: 429 });
  }

  const { id } = await params;

  const question = await prisma.question.findUnique({
    where: { id },
    select: { authorId: true, question: true, category: true },
  });

  if (!question) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  if (question.authorId === user.id) {
    return NextResponse.json({ error: '본인 문제는 신고할 수 없습니다' }, { status: 403 });
  }

  const existing = await prisma.report.findUnique({
    where: { reporterId_questionId: { reporterId: user.id, questionId: id } },
  });

  if (existing) {
    return NextResponse.json({ error: '이미 신고한 문제입니다' }, { status: 409 });
  }

  const body = await req.json();
  const reason = body.reason as ReportReason;
  const description: string | undefined = body.description;

  if (!VALID_REASONS.includes(reason)) {
    return NextResponse.json({ error: 'Invalid reason' }, { status: 400 });
  }

  await prisma.report.create({
    data: {
      reporterId: user.id,
      questionId: id,
      reason,
      description: description ?? null,
      status: 'PENDING',
    },
  });

  sendMail({
    to: ADMIN_EMAIL(),
    subject: `[CSORA] 문제 신고: ${question.question.slice(0, 40)}`,
    html: `
      <h3>문제 신고가 접수되었습니다</h3>
      <table style="border-collapse:collapse;width:100%;font-family:sans-serif">
        <tr><td style="padding:6px 12px;color:#888">사유</td><td style="padding:6px 12px">${REASON_LABEL[reason]}</td></tr>
        <tr><td style="padding:6px 12px;color:#888">신고자</td><td style="padding:6px 12px">${escapeHtml(user.nickname ?? user.email ?? '')}</td></tr>
        <tr><td style="padding:6px 12px;color:#888">카테고리</td><td style="padding:6px 12px">${escapeHtml(question.category)}</td></tr>
        <tr><td style="padding:6px 12px;color:#888;vertical-align:top">문제</td><td style="padding:6px 12px;white-space:pre-wrap">${escapeHtml(question.question)}</td></tr>
        ${description ? `<tr><td style="padding:6px 12px;color:#888;vertical-align:top">설명</td><td style="padding:6px 12px;white-space:pre-wrap">${escapeHtml(description)}</td></tr>` : ''}
      </table>
      <p style="margin-top:16px"><a href="${process.env.NEXTAUTH_URL}/admin?tab=reports" style="color:#6366f1">관리자 패널에서 확인 →</a></p>
    `,
  }).catch(() => {});

  return NextResponse.json({ ok: true }, { status: 201 });
}
