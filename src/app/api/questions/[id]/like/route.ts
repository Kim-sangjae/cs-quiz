import { NextRequest, NextResponse } from 'next/server';
import { getServerUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { awardBadges } from '@/lib/award-badges';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getServerUser();
  const { id } = await params;

  if (!user) return NextResponse.json({ liked: false, likeCount: 0 });

  const [existing, likeCount] = await Promise.all([
    prisma.like.findUnique({ where: { userId_questionId: { userId: user.id, questionId: id } } }),
    prisma.like.count({ where: { questionId: id } }),
  ]);

  return NextResponse.json({ liked: !!existing, likeCount });
}

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getServerUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  const existing = await prisma.like.findUnique({
    where: { userId_questionId: { userId: user.id, questionId: id } },
  });

  if (existing) {
    await prisma.like.delete({
      where: { userId_questionId: { userId: user.id, questionId: id } },
    });
  } else {
    await prisma.like.create({
      data: { userId: user.id, questionId: id },
    });
  }

  const likeCount = await prisma.like.count({ where: { questionId: id } });

  // 북마크 10개 달성 시 문제 작성자 뱃지 체크
  if (!existing && likeCount >= 10) {
    const q = await prisma.question.findUnique({ where: { id }, select: { authorId: true } });
    if (q?.authorId) awardBadges(q.authorId, ['LIKED_QUESTION']).catch(() => {});
  }

  return NextResponse.json({ liked: !existing, likeCount });
}
