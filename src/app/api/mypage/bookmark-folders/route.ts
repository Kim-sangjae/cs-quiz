import { NextRequest, NextResponse } from 'next/server';
import { getServerUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const user = await getServerUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const folders = await prisma.bookmarkFolder.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      name: true,
      createdAt: true,
      _count: { select: { likes: true } },
    },
  });
  return NextResponse.json({ folders });
}

export async function POST(req: NextRequest) {
  const user = await getServerUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { name } = await req.json() as { name?: string };
  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    return NextResponse.json({ error: 'Name required' }, { status: 400 });
  }
  const trimmed = name.trim().slice(0, 30);

  const existing = await prisma.bookmarkFolder.count({ where: { userId: user.id } });
  if (existing >= 10) {
    return NextResponse.json({ error: 'Max 10 folders' }, { status: 400 });
  }

  try {
    const folder = await prisma.bookmarkFolder.create({
      data: { userId: user.id, name: trimmed },
      select: { id: true, name: true, createdAt: true },
    });
    return NextResponse.json({ folder });
  } catch {
    return NextResponse.json({ error: 'Folder name already exists' }, { status: 409 });
  }
}
