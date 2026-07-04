import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function PATCH(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { isPlayingQuiz } = await req.json() as { isPlayingQuiz: boolean };

  await prisma.userPresence.upsert({
    where: { userId: session.user.id },
    update: { isPlayingQuiz: !!isPlayingQuiz },
    create: { userId: session.user.id, isPlayingQuiz: !!isPlayingQuiz },
  });

  return NextResponse.json({ ok: true });
}
