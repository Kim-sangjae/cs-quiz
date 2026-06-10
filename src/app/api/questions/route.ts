import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { getServerUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

const VALID_CATEGORIES = ['ds', 'algo', 'os', 'network', 'db', 'arch'] as const;
const PAGE_SIZE = 20;

const questionListSelect = {
  id: true,
  category: true,
  question: true,
  options: true,
  status: true,
  rejectionReason: true,
  attemptCount: true,
  correctCount: true,
  createdAt: true,
  author: { select: { nickname: true } },
  _count: { select: { likes: true } },
};

export async function GET(req: NextRequest) {
  const user = await getServerUser();
  const isAdmin = user?.role === 'ADMIN';

  const { searchParams } = req.nextUrl;
  const q = searchParams.get('q')?.trim() ?? '';
  const cat = searchParams.get('cat') ?? 'all';
  const statusParam = searchParams.get('status') ?? 'all';
  const sort = searchParams.get('sort') ?? 'newest';
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));

  let statusIn: string[];
  if (statusParam === 'pending') {
    statusIn = ['PENDING'];
  } else if (statusParam === 'approved') {
    statusIn = ['APPROVED'];
  } else {
    statusIn = isAdmin
      ? ['PENDING', 'APPROVED', 'BLINDED']
      : ['PENDING', 'APPROVED'];
  }

  const where: Prisma.QuestionWhereInput = {
    status: { in: statusIn as Prisma.EnumQuestionStatusFilter['in'] },
    ...(cat !== 'all' && (VALID_CATEGORIES as readonly string[]).includes(cat)
      ? { category: cat }
      : {}),
    ...(q ? { question: { contains: q, mode: 'insensitive' } } : {}),
  };

  if (sort === 'accuracy_asc' || sort === 'accuracy_desc') {
    const all = await prisma.question.findMany({ where, select: questionListSelect });
    const sorted = [...all].sort((a, b) => {
      const infVal = sort === 'accuracy_asc' ? Infinity : -Infinity;
      const aAcc = a.attemptCount === 0 ? infVal : a.correctCount / a.attemptCount;
      const bAcc = b.attemptCount === 0 ? infVal : b.correctCount / b.attemptCount;
      return sort === 'accuracy_asc' ? aAcc - bAcc : bAcc - aAcc;
    });
    const totalCount = sorted.length;
    const pageCount = Math.ceil(totalCount / PAGE_SIZE);
    const questions = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
    return NextResponse.json({ questions, totalCount, pageCount });
  }

  const orderBy: Prisma.QuestionOrderByWithRelationInput =
    sort === 'likes' ? { likes: { _count: 'desc' } } : { createdAt: 'desc' };

  const [totalCount, questions] = await Promise.all([
    prisma.question.count({ where }),
    prisma.question.findMany({
      where,
      select: questionListSelect,
      orderBy,
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
  ]);

  return NextResponse.json({
    questions,
    totalCount,
    pageCount: Math.ceil(totalCount / PAGE_SIZE),
  });
}

export async function POST(req: NextRequest) {
  const user = await getServerUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!user.nickname) return NextResponse.json({ error: 'Nickname required' }, { status: 403 });

  const body = await req.json() as {
    category: unknown;
    question: unknown;
    options: unknown;
    answer: unknown;
    explanation: unknown;
  };

  const { category, question, options, answer, explanation } = body;

  if (
    typeof category !== 'string' ||
    !(VALID_CATEGORIES as readonly string[]).includes(category)
  ) {
    return NextResponse.json({ error: 'Invalid category' }, { status: 400 });
  }
  if (typeof question !== 'string' || question.length === 0 || question.length > 500) {
    return NextResponse.json({ error: 'Invalid question' }, { status: 400 });
  }
  if (
    !Array.isArray(options) ||
    options.length !== 4 ||
    !options.every(
      (o): o is string => typeof o === 'string' && o.length > 0 && o.length <= 200
    )
  ) {
    return NextResponse.json({ error: 'Invalid options' }, { status: 400 });
  }
  if (typeof answer !== 'number' || ![0, 1, 2, 3].includes(answer)) {
    return NextResponse.json({ error: 'Invalid answer' }, { status: 400 });
  }
  if (
    typeof explanation !== 'string' ||
    explanation.length === 0 ||
    explanation.length > 500
  ) {
    return NextResponse.json({ error: 'Invalid explanation' }, { status: 400 });
  }

  const created = await prisma.question.create({
    data: {
      authorId: user.id,
      category,
      question,
      options: options as Prisma.InputJsonValue,
      answer,
      explanation,
      status: 'PENDING',
    },
  });

  return NextResponse.json(created, { status: 201 });
}
