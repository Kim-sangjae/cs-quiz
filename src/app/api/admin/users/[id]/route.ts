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

  const { id } = await params;
  const body = await req.json() as { action: unknown };
  const { action } = body;

  if (action !== 'set-admin' && action !== 'set-user') {
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  }

  if (id === user.id && action === 'set-user') {
    return NextResponse.json({ error: 'Cannot demote yourself' }, { status: 400 });
  }

  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  await prisma.user.update({
    where: { id },
    data: { role: action === 'set-admin' ? 'ADMIN' : 'USER' },
  });

  return NextResponse.json({ ok: true });
}
