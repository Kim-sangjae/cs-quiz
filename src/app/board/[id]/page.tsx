import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getServerUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import LikeButton from '@/components/board/LikeButton';
import ReportModal from '@/components/board/ReportModal';

const CATEGORY_LABELS: Record<string, string> = {
  ds: '자료구조',
  algo: '알고리즘',
  os: 'OS',
  network: '네트워크',
  db: 'DB',
  arch: '컴퓨터구조',
};

const OPTION_LABELS = ['A', 'B', 'C', 'D'] as const;

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function BoardDetailPage({ params }: PageProps) {
  const { id } = await params;
  const user = await getServerUser();
  const isAdmin = user?.role === 'ADMIN';

  const question = await prisma.question.findUnique({
    where: { id },
    include: {
      author: { select: { id: true, nickname: true } },
      _count: { select: { likes: true } },
    },
  });

  if (!question) notFound();
  if (question.status === 'BLINDED' && !isAdmin) notFound();

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

  const options = question.options as string[];
  const accuracyText =
    question.attemptCount === 0
      ? '–'
      : `${Math.round((question.correctCount / question.attemptCount) * 100)}%`;

  const isAuthor = user?.id === question.author?.id;
  const showReport = !!user && !isAuthor;

  return (
    <main className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
      <Link
        href="/board"
        className="inline-flex items-center gap-1 text-sm text-neutral-400 hover:text-white transition-colors mb-6"
      >
        <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
        </svg>
        게시판으로
      </Link>

      <div className="bg-[#111111] border border-neutral-800 rounded-lg p-6">
        <div className="flex items-center gap-2 mb-4">
          <span className="inline-block text-xs text-neutral-500 border border-neutral-800 rounded px-2 py-0.5">
            {CATEGORY_LABELS[question.category] ?? question.category}
          </span>
          {question.status === 'APPROVED' ? (
            <span className="inline-block text-xs text-green-500 border border-green-500/30 rounded px-2 py-0.5">
              승인
            </span>
          ) : question.status === 'BLINDED' ? (
            <span className="inline-block text-xs text-red-500 border border-red-500/30 rounded px-2 py-0.5">
              블라인드
            </span>
          ) : (
            <span className="inline-block text-xs text-amber-500 border border-amber-500/30 rounded px-2 py-0.5">
              등록요청
            </span>
          )}
        </div>

        <p className="text-base font-medium text-white leading-relaxed mb-6">
          {question.question}
        </p>

        <div className="space-y-2 mb-6">
          {options.map((option, idx) => {
            const isAnswer = idx === question.answer;
            return (
              <div
                key={idx}
                className={`flex items-center gap-3 rounded-md border px-4 py-3 text-sm cursor-default ${
                  isAnswer
                    ? 'border-green-500 bg-green-500/10 text-green-400'
                    : 'border-neutral-800 bg-[#1a1a1a] text-neutral-500 opacity-50'
                }`}
              >
                <span className="text-xs font-mono flex-shrink-0">{OPTION_LABELS[idx]}</span>
                <span>{option}</span>
                {isAnswer && (
                  <svg
                    className="ml-auto flex-shrink-0"
                    width={16}
                    height={16}
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.5}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                )}
              </div>
            );
          })}
        </div>

        <div className="border-t border-neutral-800 pt-4 mb-6">
          <p className="text-xs text-neutral-500 mb-1">해설</p>
          <p className="text-sm text-neutral-300 leading-relaxed">{question.explanation}</p>
        </div>

        <div className="flex items-center justify-between text-xs text-neutral-500 mb-4">
          <span>{question.author?.nickname ?? '익명'}</span>
          <div className="flex items-center gap-3">
            <span>시도 {question.attemptCount}회</span>
            <span>정답률 {accuracyText}</span>
            <span>{new Date(question.createdAt).toLocaleDateString('ko-KR')}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <LikeButton
            questionId={id}
            initialLiked={hasLiked}
            initialCount={question._count.likes}
            isLoggedIn={!!user}
          />
          {showReport && (
            <ReportModal questionId={id} initialReported={hasReported} />
          )}
        </div>
      </div>
    </main>
  );
}
