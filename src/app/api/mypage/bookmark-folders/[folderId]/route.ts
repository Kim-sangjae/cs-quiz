import { NextRequest, NextResponse } from 'next/server';
import { getServerUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

type Params = { params: Promise<{ folderId: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  const user = await getServerUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { folderId } = await params;
  const { name } = await req.json() as { name?: string };
  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    return NextResponse.json({ error: 'Name required' }, { status: 400 });
  }

  try {
    const folder = await prisma.bookmarkFolder.updateMany({
      where: { id: folderId, userId: user.id },
      data: { name: name.trim().slice(0, 30) },
    });
    if (folder.count === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Name already exists' }, { status: 409 });
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const user = await getServerUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { folderId } = await params;
  // 폴더 삭제 시 소속 북마크는 미분류(null)로 이동 (onDelete: SetNull)
  const result = await prisma.bookmarkFolder.deleteMany({
    where: { id: folderId, userId: user.id },
  });
  if (result.count === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ ok: true });
}
