import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest) {
  const { email, content } = await req.json() as { email?: string; content?: string };

  if (!email?.trim() || !content?.trim()) {
    return NextResponse.json({ error: '이메일과 내용을 입력해주세요.' }, { status: 400 });
  }

  const user = await prisma.user.findFirst({
    where: { email: email.trim() },
    select: { id: true, deletedAt: true },
  });

  if (!user) {
    return NextResponse.json({ error: '해당 이메일로 가입된 계정을 찾을 수 없습니다.' }, { status: 404 });
  }

  await prisma.inquiry.create({
    data: {
      userId: user.id,
      type: 'ACCOUNT_ISSUE',
      title: '계정 비활성화 문의',
      content: content.trim(),
    },
  });

  return NextResponse.json({ ok: true }, { status: 201 });
}
