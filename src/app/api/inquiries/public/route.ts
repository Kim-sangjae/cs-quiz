import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest) {
  const { email, content } = await req.json() as { email?: string; content?: string };

  if (!email?.trim() || !content?.trim()) {
    return NextResponse.json({ error: '이메일과 내용을 입력해주세요.' }, { status: 400 });
  }

  const trimmedEmail = email.trim();

  // 비활성화된 계정만 조회 (정상 계정으로 잘못 귀속되지 않도록)
  const user = await prisma.user.findFirst({
    where: { email: trimmedEmail, deletedAt: { not: null } },
    select: { id: true },
  });

  if (!user) {
    return NextResponse.json({ error: '해당 이메일로 비활성화된 계정을 찾을 수 없습니다. 이메일을 다시 확인해주세요.' }, { status: 404 });
  }

  await prisma.inquiry.create({
    data: {
      userId: user.id,
      type: 'ACCOUNT_ISSUE',
      title: `[계정문의] ${trimmedEmail}`,
      content: `연락처 이메일: ${trimmedEmail}\n\n${content.trim()}`,
    },
  });

  return NextResponse.json({ ok: true }, { status: 201 });
}
