import { NextRequest, NextResponse } from 'next/server';
import { getServerUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getServerUser();
  if (!user || user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id: questionId } = await params;
  const body = await req.json() as { action: unknown };
  const { action } = body;

  if (action !== 'blind' && action !== 'dismiss') {
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  }

  const question = await prisma.question.findUnique({
    where: { id: questionId },
    select: { id: true },
  });
  if (!question) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  if (action === 'blind') {
    await prisma.$transaction(async (tx) => {
      await tx.question.update({
        where: { id: questionId },
        data: { status: 'BLINDED' },
      });
      await tx.report.updateMany({
        where: { questionId, status: 'PENDING' },
        data: { status: 'REVIEWED' },
      });
    });
  } else {
    await prisma.report.updateMany({
      where: { questionId, status: 'PENDING' },
      data: { status: 'REVIEWED' },
    });
  }

  return NextResponse.json({ ok: true });
}
