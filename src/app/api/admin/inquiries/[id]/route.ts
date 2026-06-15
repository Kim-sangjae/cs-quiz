import { NextRequest, NextResponse } from 'next/server';
import { getServerUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { writeLog } from '@/lib/audit';
import type { InquiryStatus } from '@prisma/client';

const VALID_STATUSES: InquiryStatus[] = ['PENDING', 'IN_PROGRESS', 'RESOLVED'];

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getServerUser();
  if (!user || user.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await params;
  const { status, adminReply } = await req.json() as { status?: string; adminReply?: string };

  if (status && !VALID_STATUSES.includes(status as InquiryStatus)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
  }

  const existing = await prisma.inquiry.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const wasUnreplied = !existing.adminReply;
  const hasNewReply = typeof adminReply === 'string' && adminReply.trim().length > 0;

  await prisma.$transaction(async (tx) => {
    await tx.inquiry.update({
      where: { id },
      data: {
        ...(status ? { status: status as InquiryStatus } : {}),
        ...(typeof adminReply === 'string' ? {
          adminReply: adminReply.trim() || null,
          repliedAt: adminReply.trim() ? new Date() : null,
        } : {}),
      },
    });

    if (wasUnreplied && hasNewReply) {
      await tx.notification.create({
        data: {
          userId: existing.userId,
          type: 'INQUIRY_REPLIED',
          payload: { inquiryTitle: existing.title },
          actionUrl: '/inquiry',
        },
      });
    }
  });

  if (hasNewReply && wasUnreplied) {
    writeLog({ actorId: user.id, actorRole: user.role, action: 'INQUIRY_REPLY', targetType: 'Inquiry', targetId: id, payload: { title: existing.title } });
  } else if (status) {
    writeLog({ actorId: user.id, actorRole: user.role, action: 'INQUIRY_STATUS_CHANGE', targetType: 'Inquiry', targetId: id, payload: { title: existing.title, status } });
  }

  return NextResponse.json({ ok: true });
}
