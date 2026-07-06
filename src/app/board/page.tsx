import { Prisma } from '@prisma/client';
import { Suspense } from 'react';
import Link from 'next/link';
import { getServerUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import SearchBar from '@/components/board/SearchBar';
import FilterBar from '@/components/board/FilterBar';
import AuthorSearchBar from '@/components/board/AuthorSearchBar';
import BoardListClient from '@/components/board/BoardListClient';
import Pagination from '@/components/board/Pagination';

const VALID_CATEGORIES = ['ds', 'algo', 'os', 'network', 'db', 'arch', 'se'];
const PAGE_SIZE = 20;

const questionSelect = {
  id: true,
  category: true,
  question: true,
  status: true,
  attemptCount: true,
  correctCount: true,
  createdAt: true,
  author: { select: { nickname: true } },
  _count: { select: { likes: true, comments: { where: { deletedAt: null } } } },
} as const;

interface PageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function BoardPage({ searchParams }: PageProps) {
  const params = await searchParams;

  const q = typeof params.q === 'string' ? params.q.trim() : '';
  const author = typeof params.author === 'string' ? params.author.trim() : '';
  const cat = typeof params.cat === 'string' ? params.cat : 'all';
  const sort = typeof params.sort === 'string' ? params.sort : 'newest';
  const page = Math.max(1, parseInt(typeof params.page === 'string' ? params.page : '1', 10));

  const untried = params.untried === '1';

  const user = await getServerUser();
  const isAdmin = user?.role === 'ADMIN';

  const statusIn = isAdmin ? ['OFFICIAL', 'APPROVED', 'BLINDED'] : ['OFFICIAL', 'APPROVED'];

  const where: Prisma.QuestionWhereInput = {
    status: { in: statusIn as Prisma.EnumQuestionStatusFilter['in'] },
    ...(cat !== 'all' && VALID_CATEGORIES.includes(cat) ? { category: cat } : {}),
    ...(q ? { question: { contains: q, mode: 'insensitive' } } : {}),
    ...(author ? {
      author: {
        OR: [
          { nickname: { contains: author, mode: 'insensitive' } },
          { email: { startsWith: author.toLowerCase() } },
        ],
      },
    } : {}),
  };

  if (untried && user) {
    const tried = await prisma.questionAttempt.findMany({
      where: { userId: user.id },
      select: { questionId: true },
      distinct: ['questionId'],
    });
    const triedIds = tried.map((t) => t.questionId);
    where.id = { notIn: triedIds };
  }

  let questions: Array<{
    id: string;
    category: string;
    question: string;
    status: string;
    attemptCount: number;
    correctCount: number;
    createdAt: Date;
    author: { nickname: string | null } | null;
    _count: { likes: number; comments: number };
  }>;
  let totalCount: number;

  if (sort === 'accuracy_asc' || sort === 'accuracy_desc') {
    const all = await prisma.question.findMany({ where, select: questionSelect });
    const sorted = [...all].sort((a, b) => {
      const infVal = sort === 'accuracy_asc' ? Infinity : -Infinity;
      const aAcc = a.attemptCount === 0 ? infVal : a.correctCount / a.attemptCount;
      const bAcc = b.attemptCount === 0 ? infVal : b.correctCount / b.attemptCount;
      return sort === 'accuracy_asc' ? aAcc - bAcc : bAcc - aAcc;
    });
    totalCount = sorted.length;
    questions = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  } else {
    const orderBy: Prisma.QuestionOrderByWithRelationInput =
      sort === 'likes' ? { likes: { _count: 'desc' } } : { createdAt: 'desc' };

    [totalCount, questions] = await Promise.all([
      prisma.question.count({ where }),
      prisma.question.findMany({
        where,
        select: questionSelect,
        orderBy,
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
      }),
    ]);
  }

  const pageCount = Math.ceil(totalCount / PAGE_SIZE);

  type MyAttemptEntry = { count: number; lastCorrect: boolean };
  const myAttempts: Record<string, MyAttemptEntry> = {};
  if (user && questions.length > 0) {
    const questionIds = questions.map((q) => q.id);
    const attempts = await prisma.questionAttempt.findMany({
      where: { userId: user.id, questionId: { in: questionIds } },
      select: { questionId: true, isCorrect: true },
      orderBy: { attemptedAt: 'desc' },
    });
    for (const a of attempts) {
      const e = myAttempts[a.questionId];
      if (!e) myAttempts[a.questionId] = { count: 1, lastCorrect: a.isCorrect };
      else e.count++;
    }
  }

  return (
    <main className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-white mb-1">게시판</h1>
          <p className="text-sm text-neutral-500">커뮤니티가 등록한 CS 문제 모음</p>
        </div>
        <Link
          href="/board/submit"
          className="rounded-md bg-white text-black text-sm font-medium px-4 py-2 hover:bg-neutral-200 transition-colors flex-shrink-0"
        >
          문제 등록
        </Link>
      </div>

      {author && (
        <div className="flex items-center gap-2 mb-4">
          <span className="text-xs text-neutral-400 border border-neutral-700 rounded-full px-3 py-1 flex items-center gap-1.5">
            출제자: <span className="text-white font-medium">{author}</span>
            <Link href="/board" className="ml-1 text-neutral-600 hover:text-white transition-colors">×</Link>
          </span>
        </div>
      )}
      <div className="flex flex-col gap-3 mb-6">
        <Suspense>
          <SearchBar />
        </Suspense>
        <Suspense>
          <AuthorSearchBar />
        </Suspense>
        <Suspense>
          <FilterBar isLoggedIn={!!user} />
        </Suspense>
      </div>

      {questions.length === 0 ? (
        <p className="text-neutral-500 text-sm text-center py-16">검색 결과가 없습니다.</p>
      ) : (
        <>
          <p className="text-xs text-neutral-500 mb-3">총 {totalCount}개</p>
          <BoardListClient
            questions={questions.map((q) => ({
              id: q.id,
              category: q.category,
              question: q.question,
              status: q.status,
              attemptCount: q.attemptCount,
              correctCount: q.correctCount,
              createdAt: q.createdAt.toISOString(),
              author: q.author,
              likeCount: q._count.likes,
              commentCount: q._count.comments,
            }))}
            myAttempts={myAttempts}
          />
          <Suspense>
            <Pagination currentPage={page} pageCount={pageCount} />
          </Suspense>
        </>
      )}
    </main>
  );
}
