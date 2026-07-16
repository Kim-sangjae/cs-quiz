import { NextRequest, NextResponse } from 'next/server';
import { getServerUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import type { InquiryType } from '@prisma/client';
import { sendMail, ADMIN_EMAIL, escapeHtml } from '@/lib/mailer';

const TITLE_MAX = 100;
const CONTENT_MAX = 1000;

const TYPE_LABELS: Record<InquiryType, string> = {
  BUG_REPORT: '버그 신고',
  ACCOUNT_ISSUE: '계정 문제',
  CONTENT_ISSUE: '콘텐츠 문제',
  SUGGESTION: '건의사항',
  OTHER: '기타',
};

const VALID_TYPES: InquiryType[] = ['BUG_REPORT', 'ACCOUNT_ISSUE', 'CONTENT_ISSUE', 'SUGGESTION', 'OTHER'];

export async function GET() {
  const user = await getServerUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const inquiries = await prisma.inquiry.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true, type: true, title: true, content: true,
      status: true, adminReply: true, repliedAt: true, createdAt: true,
    },
  });

  return NextResponse.json(inquiries);
}

export async function POST(req: NextRequest) {
  const user = await getServerUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { type, title, content } = await req.json() as { type: string; title: string; content: string };

  if (
    !VALID_TYPES.includes(type as InquiryType) ||
    !title?.trim() || !content?.trim() ||
    title.trim().length > TITLE_MAX || content.trim().length > CONTENT_MAX
  ) {
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
  }

  const trimmedTitle = title.trim();
  const trimmedContent = content.trim();

  const inquiry = await prisma.inquiry.create({
    data: { userId: user.id, type: type as InquiryType, title: trimmedTitle, content: trimmedContent },
  });

  sendMail({
    to: ADMIN_EMAIL(),
    subject: `[CSORA] 새 문의: ${trimmedTitle}`,
    html: `
      <h3>새 문의가 접수되었습니다</h3>
      <table style="border-collapse:collapse;width:100%;font-family:sans-serif">
        <tr><td style="padding:6px 12px;color:#888">유형</td><td style="padding:6px 12px">${TYPE_LABELS[type as InquiryType]}</td></tr>
        <tr><td style="padding:6px 12px;color:#888">제목</td><td style="padding:6px 12px">${escapeHtml(trimmedTitle)}</td></tr>
        <tr><td style="padding:6px 12px;color:#888">작성자</td><td style="padding:6px 12px">${escapeHtml(user.nickname ?? user.email ?? '')}</td></tr>
        <tr><td style="padding:6px 12px;color:#888;vertical-align:top">내용</td><td style="padding:6px 12px;white-space:pre-wrap">${escapeHtml(trimmedContent)}</td></tr>
      </table>
      <p style="margin-top:16px"><a href="${process.env.NEXTAUTH_URL}/admin?tab=inquiries" style="color:#6366f1">관리자 패널에서 확인 →</a></p>
    `,
  }).catch(() => {});

  return NextResponse.json({ id: inquiry.id }, { status: 201 });
}
