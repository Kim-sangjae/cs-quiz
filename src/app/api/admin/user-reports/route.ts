import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== 'ADMIN') return null;
  return session;
}

export async function GET() {
  if (!await requireAdmin()) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const reports = await prisma.userReport.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      reporter: { select: { id: true, nickname: true, email: true } },
      reported: { select: { id: true, nickname: true, email: true } },
    },
  });

  return NextResponse.json(reports);
}

export async function PATCH(req: NextRequest) {
  if (!await requireAdmin()) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id, action } = await req.json() as { id?: unknown; action?: unknown };
  if (typeof id !== 'string' || action !== 'dismiss') {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  await prisma.userReport.update({ where: { id }, data: { status: 'REVIEWED' } });
  return NextResponse.json({ ok: true });
}
