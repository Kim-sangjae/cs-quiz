import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { maskProfanity } from '@/lib/content-filter';

export async function PATCH(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { bio } = await req.json() as { bio: string };
  const raw = (bio ?? '').trim().slice(0, 20);
  const dbWords = await prisma.blockedWord.findMany({ select: { word: true } });
  const trimmed = maskProfanity(raw, dbWords.map((w) => w.word)).slice(0, 20);

  await prisma.user.update({
    where: { id: session.user.id },
    data: { bio: trimmed || null },
  });

  return NextResponse.json({ ok: true, bio: trimmed || null });
}
