import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { maskProfanity } from '@/lib/content-filter';

const PAGE_SIZE = 10;

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: questionId } = await params;
  const url = new URL(req.url);
  const page = Math.max(0, parseInt(url.searchParams.get('page') ?? '0', 10));

  const [comments, total] = await Promise.all([
    prisma.questionComment.findMany({
      where: { questionId, deletedAt: null, blinded: false },
      orderBy: { createdAt: 'asc' },
      skip: page * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        content: true,
        createdAt: true,
        userId: true,
        user: { select: { nickname: true } },
      },
    }),
    prisma.questionComment.count({ where: { questionId, deletedAt: null, blinded: false } }),
  ]);

  return NextResponse.json({ comments, total, pageCount: Math.ceil(total / PAGE_SIZE) });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id: questionId } = await params;

  const question = await prisma.question.findUnique({
    where: { id: questionId },
    select: { id: true, status: true },
  });
  if (!question || !['OFFICIAL', 'APPROVED'].includes(question.status)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const body = await req.json() as { content?: unknown };
  const raw = typeof body.content === 'string' ? body.content.trim() : '';
  if (!raw || raw.length > 50) {
    return NextResponse.json({ error: 'Invalid content' }, { status: 400 });
  }

  const dbWords = await prisma.blockedWord.findMany({ select: { word: true } });
  const content = maskProfanity(raw, dbWords.map((w) => w.word));

  const comment = await prisma.questionComment.create({
    data: { userId: session.user.id, questionId, content },
    select: {
      id: true, content: true, createdAt: true, userId: true,
      user: { select: { nickname: true } },
    },
  });

  return NextResponse.json({ comment });
}
