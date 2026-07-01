import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== 'ADMIN') return null;
  return session;
}

export async function GET() {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const words = await prisma.blockedWord.findMany({ orderBy: { createdAt: 'desc' } });
  return NextResponse.json(words);
}

export async function POST(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await req.json() as { words: unknown };
  const raw = body.words;
  const words = Array.isArray(raw) ? raw : (typeof raw === 'string' ? [raw] : []);
  const trimmed = words
    .map((w) => (typeof w === 'string' ? w.trim().toLowerCase() : ''))
    .filter((w) => w.length > 0);

  if (trimmed.length === 0) {
    return NextResponse.json({ error: 'Invalid words' }, { status: 400 });
  }

  const results = await Promise.allSettled(
    trimmed.map((word) =>
      prisma.blockedWord.create({ data: { word, createdBy: session.user.id } })
    )
  );

  const added = results.filter((r) => r.status === 'fulfilled').length;
  const skipped = results.filter((r) => r.status === 'rejected').length;
  return NextResponse.json({ added, skipped });
}

export async function DELETE(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await req.json() as { id: unknown };
  if (typeof id !== 'string') return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

  await prisma.blockedWord.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
