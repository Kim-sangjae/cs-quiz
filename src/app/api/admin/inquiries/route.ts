import { NextRequest, NextResponse } from 'next/server';
import { getServerUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { InquiryType, InquiryStatus } from '@prisma/client';

const PAGE_SIZE = 10;

export async function GET(req: NextRequest) {
  const user = await getServerUser();
  if (!user || user.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status') ?? '';
  const type = searchParams.get('type') ?? '';
  const sort = searchParams.get('sort') ?? 'newest';
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'));

  const where = {
    ...(status ? { status: status as InquiryStatus } : {}),
    ...(type ? { type: type as InquiryType } : {}),
  };

  const orderBy = sort === 'oldest'
    ? { createdAt: 'asc' as const }
    : { createdAt: 'desc' as const };

  const [total, inquiries] = await Promise.all([
    prisma.inquiry.count({ where }),
    prisma.inquiry.findMany({
      where,
      orderBy,
      take: PAGE_SIZE,
      skip: (page - 1) * PAGE_SIZE,
      select: {
        id: true, type: true, title: true, content: true,
        status: true, adminReply: true, repliedAt: true, createdAt: true,
        user: { select: { id: true, nickname: true, email: true } },
      },
    }),
  ]);

  return NextResponse.json({ inquiries, total, pageCount: Math.ceil(total / PAGE_SIZE) });
}
