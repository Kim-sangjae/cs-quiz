import { NextRequest, NextResponse } from 'next/server';
import { getServerUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const user = await getServerUser();
  const isAdmin = user?.role === 'ADMIN';

  const question = await prisma.question.findUnique({
    where: { id },
    include: {
      author: { select: { nickname: true } },
      _count: { select: { likes: true } },
    },
  });

  if (!question) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (question.status === 'BLINDED' && !isAdmin) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  let hasLiked = false;
  let hasReported = false;
  if (user) {
    const [like, report] = await Promise.all([
      prisma.like.findUnique({
        where: { userId_questionId: { userId: user.id, questionId: id } },
      }),
      prisma.report.findFirst({
        where: { reporterId: user.id, questionId: id },
      }),
    ]);
    hasLiked = !!like;
    hasReported = !!report;
  }

  return NextResponse.json({ ...question, hasLiked, hasReported });
}
