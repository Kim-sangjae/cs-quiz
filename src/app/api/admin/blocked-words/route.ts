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

  const { word } = await req.json() as { word: unknown };
  if (typeof word !== 'string' || word.trim().length === 0) {
    return NextResponse.json({ error: 'Invalid word' }, { status: 400 });
  }

  const trimmed = word.trim().toLowerCase();
  try {
    const created = await prisma.blockedWord.create({
      data: { word: trimmed, createdBy: session.user.id },
    });
    return NextResponse.json(created);
  } catch {
    return NextResponse.json({ error: 'Already exists' }, { status: 409 });
  }
}

export async function DELETE(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await req.json() as { id: unknown };
  if (typeof id !== 'string') return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

  await prisma.blockedWord.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
