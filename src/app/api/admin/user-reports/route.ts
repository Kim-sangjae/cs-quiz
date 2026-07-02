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
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await req.json() as { id?: unknown; ids?: unknown; action?: unknown; reason?: unknown };
  const action = body.action as string;
  const reason = typeof body.reason === 'string' ? body.reason : '부적절한 닉네임 사용';

  // Bulk dismiss
  if (Array.isArray(body.ids) && action === 'dismiss') {
    const ids = (body.ids as unknown[]).filter((id): id is string => typeof id === 'string');
    await prisma.userReport.updateMany({ where: { id: { in: ids } }, data: { status: 'REVIEWED' } });
    return NextResponse.json({ ok: true });
  }

  if (typeof body.id !== 'string') return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  const reportId = body.id;

  if (action === 'dismiss') {
    await prisma.userReport.update({ where: { id: reportId }, data: { status: 'REVIEWED' } });
    return NextResponse.json({ ok: true });
  }

  const report = await prisma.userReport.findUnique({ where: { id: reportId }, select: { reportedId: true } });
  if (!report) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  if (action === 'blind') {
    await prisma.$transaction([
      prisma.user.update({
        where: { id: report.reportedId },
        data: { deletedAt: new Date(), tokenVersion: { increment: 1 } },
      }),
      prisma.userReport.updateMany({
        where: { reportedId: report.reportedId, status: 'PENDING' },
        data: { status: 'REVIEWED' },
      }),
      prisma.notification.create({
        data: {
          userId: report.reportedId,
          type: 'ACCOUNT_BLINDED',
          payload: { reason },
        },
      }),
    ]);
    return NextResponse.json({ ok: true });
  }

  if (action === 'change-nickname') {
    await prisma.$transaction([
      prisma.user.update({
        where: { id: report.reportedId },
        data: { nickname: null, tokenVersion: { increment: 1 } },
      }),
      prisma.userReport.update({ where: { id: reportId }, data: { status: 'REVIEWED' } }),
      prisma.notification.create({
        data: {
          userId: report.reportedId,
          type: 'NICKNAME_FORCED_CHANGED',
          payload: { reason },
        },
      }),
    ]);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
}
