import { NextRequest, NextResponse } from 'next/server';
import { getServerUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import type { InquiryType } from '@prisma/client';

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

  if (!VALID_TYPES.includes(type as InquiryType) || !title?.trim() || !content?.trim()) {
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
  }

  const inquiry = await prisma.inquiry.create({
    data: { userId: user.id, type: type as InquiryType, title: title.trim(), content: content.trim() },
  });

  return NextResponse.json({ id: inquiry.id }, { status: 201 });
}
