import { NextRequest, NextResponse } from 'next/server';
import { getServerUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

const PAGE_SIZE = 20;

export async function GET(req: NextRequest) {
  const user = await getServerUser();
  if (!user || user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const search = searchParams.get('search') ?? '';
  const role = searchParams.get('role') ?? 'all';
  const status = searchParams.get('status') ?? 'all';
  const sort = searchParams.get('sort') === 'asc' ? 'asc' : 'desc';
  const sortBy = searchParams.get('sortBy') === 'xp' ? 'xp' : 'createdAt';
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'));

  const where = {
    ...(search ? {
      OR: [
        { nickname: { contains: search, mode: 'insensitive' as const } },
        { email: { contains: search, mode: 'insensitive' as const } },
      ],
    } : {}),
    ...(role !== 'all' ? { role: role as 'ADMIN' | 'USER' } : {}),
    ...(status === 'active' ? { deletedAt: null } : {}),
    ...(status === 'deactivated' ? { deletedAt: { not: null } } : {}),
  };

  const [total, users] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      select: {
        id: true,
        email: true,
        nickname: true,
        role: true,
        deletedAt: true,
        createdAt: true,
        xp: true,
        _count: { select: { quizSessions: true } },
      },
      orderBy: { [sortBy]: sort },
      take: PAGE_SIZE,
      skip: (page - 1) * PAGE_SIZE,
    }),
  ]);

  return NextResponse.json({ users, total, pageCount: Math.ceil(total / PAGE_SIZE) });
}
