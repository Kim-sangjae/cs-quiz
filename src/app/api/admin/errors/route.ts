import { NextRequest, NextResponse } from 'next/server';
import { getServerUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  const user = await getServerUser();
  if (!user || user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'));
  const limit = 20;
  const statusCode = searchParams.get('statusCode') ?? '';
  const errorCode = searchParams.get('errorCode') ?? '';
  const sort = searchParams.get('sort') === 'asc' ? 'asc' : 'desc';

  const where = {
    ...(statusCode ? { statusCode: parseInt(statusCode) } : {}),
    ...(errorCode ? { errorCode } : {}),
  };

  const [total, logs, errorCodes] = await Promise.all([
    prisma.errorLog.count({ where }),
    prisma.errorLog.findMany({
      where,
      orderBy: { createdAt: sort },
      skip: (page - 1) * limit,
      take: limit,
      include: { user: { select: { nickname: true, email: true } } },
    }),
    // 필터 옵션용 — 전체 유니크 errorCode 목록
    prisma.errorLog.findMany({
      select: { errorCode: true },
      where: { errorCode: { not: null } },
      distinct: ['errorCode'],
      orderBy: { errorCode: 'asc' },
    }),
  ]);

  return NextResponse.json({
    total,
    logs,
    totalPages: Math.max(1, Math.ceil(total / limit)),
    errorCodes: errorCodes.map((e) => e.errorCode).filter(Boolean),
  });
}

export async function DELETE(req: NextRequest) {
  const user = await getServerUser();
  if (!user || user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');

  if (id) {
    await prisma.errorLog.delete({ where: { id } });
  } else {
    await prisma.errorLog.deleteMany({});
  }

  return NextResponse.json({ ok: true });
}
