import { NextResponse } from 'next/server';
import { getServerUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const user = await getServerUser();
  if (!user || user.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const inquiries = await prisma.inquiry.findMany({
    orderBy: { createdAt: 'desc' },
    select: {
      id: true, type: true, title: true, content: true,
      status: true, adminReply: true, repliedAt: true, createdAt: true,
      user: { select: { id: true, nickname: true, email: true } },
    },
  });

  return NextResponse.json(inquiries);
}
