import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ note: null });

  const { id } = await params;
  const note = await prisma.questionNote.findUnique({
    where: { userId_questionId: { userId: session.user.id, questionId: id } },
    select: { content: true, updatedAt: true },
  });
  return NextResponse.json({ note });
}

export async function PUT(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const { content } = await req.json() as { content?: string };
  if (!content || typeof content !== 'string' || content.trim().length === 0) {
    return NextResponse.json({ error: 'Content required' }, { status: 400 });
  }
  if (content.length > 1000) {
    return NextResponse.json({ error: 'Too long' }, { status: 400 });
  }

  const note = await prisma.questionNote.upsert({
    where: { userId_questionId: { userId: session.user.id, questionId: id } },
    create: { userId: session.user.id, questionId: id, content: content.trim() },
    update: { content: content.trim() },
    select: { content: true, updatedAt: true },
  });
  return NextResponse.json({ note });
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  await prisma.questionNote.deleteMany({
    where: { userId: session.user.id, questionId: id },
  });
  return NextResponse.json({ ok: true });
}
