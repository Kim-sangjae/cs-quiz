import { NextRequest, NextResponse } from 'next/server';
import { getServerUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { writeLog } from '@/lib/audit';

export async function POST(req: NextRequest) {
  const user = await getServerUser();
  if (!user || user.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await req.json() as { ids: unknown; action: unknown };
  const { ids, action } = body;

  if (!Array.isArray(ids) || ids.length === 0) return NextResponse.json({ error: 'ids required' }, { status: 400 });
  const VALID = ['deactivate', 'reactivate'];
  if (!VALID.includes(action as string)) return NextResponse.json({ error: 'Invalid action' }, { status: 400 });

  const safeIds = (ids as string[]).filter((id) => id !== user.id);
  if (safeIds.length === 0) return NextResponse.json({ error: 'Cannot self-modify' }, { status: 400 });

  if (action === 'deactivate') {
    await prisma.user.updateMany({
      where: { id: { in: safeIds }, deletedAt: null },
      data: { deletedAt: new Date(), tokenVersion: { increment: 1 } },
    });
    writeLog({ actorId: user.id, actorRole: user.role, action: 'USER_DEACTIVATE', targetType: 'User', targetId: safeIds.join(','), payload: { count: safeIds.length } });
  } else {
    await prisma.user.updateMany({
      where: { id: { in: safeIds }, deletedAt: { not: null } },
      data: { deletedAt: null },
    });
    writeLog({ actorId: user.id, actorRole: user.role, action: 'USER_REACTIVATE', targetType: 'User', targetId: safeIds.join(','), payload: { count: safeIds.length } });
  }

  return NextResponse.json({ ok: true });
}
