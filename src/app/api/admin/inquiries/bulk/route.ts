import { NextRequest, NextResponse } from 'next/server';
import { getServerUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { writeLog } from '@/lib/audit';
import type { InquiryStatus } from '@prisma/client';

const VALID_STATUSES: InquiryStatus[] = ['PENDING', 'IN_PROGRESS', 'RESOLVED'];

export async function POST(req: NextRequest) {
  const user = await getServerUser();
  if (!user || user.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await req.json() as { ids: unknown; status: unknown };
  const { ids, status } = body;

  if (!Array.isArray(ids) || ids.length === 0) return NextResponse.json({ error: 'ids required' }, { status: 400 });
  if (!VALID_STATUSES.includes(status as InquiryStatus)) return NextResponse.json({ error: 'Invalid status' }, { status: 400 });

  await prisma.inquiry.updateMany({ where: { id: { in: ids as string[] } }, data: { status: status as InquiryStatus } });
  writeLog({ actorId: user.id, actorRole: user.role, action: 'INQUIRY_STATUS_CHANGE', targetType: 'Inquiry', targetId: ids.join(','), payload: { status, count: ids.length } });

  return NextResponse.json({ ok: true });
}
