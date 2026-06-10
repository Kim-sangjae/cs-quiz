import { Prisma } from '@prisma/client';
import { Suspense } from 'react';
import { getServerUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import SearchBar from '@/components/board/SearchBar';
import FilterBar from '@/components/board/FilterBar';
import QuestionCard from '@/components/board/QuestionCard';
import Pagination from '@/components/board/Pagination';

const VALID_CATEGORIES = ['ds', 'algo', 'os', 'network', 'db', 'arch'];
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
  _count: { select: { likes: true } },
} as const;

interface PageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function BoardPage({ searchParams }: PageProps) {
  const params = await searchParams;

  const q = typeof params.q === 'string' ? params.q.trim() : '';
  const cat = typeof params.cat === 'string' ? params.cat : 'all';
  const statusParam = typeof params.status === 'string' ? params.status : 'all';
  const sort = typeof params.sort === 'string' ? params.sort : 'newest';
  const page = Math.max(1, parseInt(typeof params.page === 'string' ? params.page : '1', 10));

  const user = await getServerUser();
  const isAdmin = user?.role === 'ADMIN';

  let statusIn: string[];
  if (statusParam === 'pending') {
    statusIn = ['PENDING'];
  } else if (statusParam === 'approved') {
    statusIn = ['APPROVED'];
  } else {
    statusIn = isAdmin ? ['PENDING', 'APPROVED', 'BLINDED'] : ['PENDING', 'APPROVED'];
  }

  const where: Prisma.QuestionWhereInput = {
    status: { in: statusIn as Prisma.EnumQuestionStatusFilter['in'] },
    ...(cat !== 'all' && VALID_CATEGORIES.includes(cat) ? { category: cat } : {}),
    ...(q ? { question: { contains: q, mode: 'insensitive' } } : {}),
  };

  let questions: Array<{
    id: string;
    category: string;
    question: string;
    status: string;
    attemptCount: number;
    correctCount: number;
    createdAt: Date;
    author: { nickname: string | null } | null;
    _count: { likes: number };
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

  return (
    <main className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-white mb-1">게시판</h1>
        <p className="text-sm text-neutral-500">커뮤니티가 등록한 CS 문제 모음</p>
      </div>

      <div className="flex flex-col gap-3 mb-6">
        <Suspense>
          <SearchBar />
        </Suspense>
        <Suspense>
          <FilterBar />
        </Suspense>
      </div>

      {questions.length === 0 ? (
        <p className="text-neutral-500 text-sm text-center py-16">검색 결과가 없습니다.</p>
      ) : (
        <>
          <p className="text-xs text-neutral-500 mb-3">총 {totalCount}개</p>
          <div className="space-y-3 mb-8">
            {questions.map((q) => (
              <QuestionCard
                key={q.id}
                id={q.id}
                category={q.category}
                question={q.question}
                status={q.status}
                attemptCount={q.attemptCount}
                correctCount={q.correctCount}
                createdAt={q.createdAt}
                author={q.author}
                likeCount={q._count.likes}
              />
            ))}
          </div>
          <Suspense>
            <Pagination currentPage={page} pageCount={pageCount} />
          </Suspense>
        </>
      )}
    </main>
  );
}
