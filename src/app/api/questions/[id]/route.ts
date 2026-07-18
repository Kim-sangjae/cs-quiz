import { NextRequest, NextResponse } from 'next/server';
import { getServerUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { isRateLimited, getClientIp } from '@/lib/rate-limit';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const user = await getServerUser();
  const isAdmin = user?.role === 'ADMIN';

  const rateLimitKey = user ? `questions-detail:user:${user.id}` : `questions-detail:ip:${getClientIp(req)}`;
  if (await isRateLimited(rateLimitKey, 60, 60)) {
    return NextResponse.json({ error: '요청이 너무 많습니다. 잠시 후 다시 시도하세요.' }, { status: 429 });
  }

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

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getServerUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const question = await prisma.question.findUnique({ where: { id } });
  if (!question) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (question.authorId !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  if (question.status !== 'REJECTED') {
    return NextResponse.json({ error: '거절된 문제만 수정 후 재요청할 수 있습니다.' }, { status: 400 });
  }

  const body = await req.json() as {
    category: string;
    question: string;
    options: string[];
    answer: number;
    explanation: string;
  };

  const { category, question: questionText, options, answer, explanation } = body;

  if (
    !category || !questionText || !Array.isArray(options) ||
    options.length !== 4 || typeof answer !== 'number' || !explanation
  ) {
    return NextResponse.json({ error: '입력값이 올바르지 않습니다.' }, { status: 400 });
  }

  await prisma.question.update({
    where: { id },
    data: { category, question: questionText, options, answer, explanation, status: 'PENDING', rejectionReason: null },
  });

  return NextResponse.json({ ok: true });
}
