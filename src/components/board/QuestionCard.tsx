'use client';

import Link from 'next/link';

const CATEGORY_LABELS: Record<string, string> = {
  ds: '자료구조',
  algo: '알고리즘',
  os: 'OS',
  network: '네트워크',
  db: 'DB',
  arch: '컴퓨터구조',
  se: 'SW공학',
};

function relativeTime(date: Date | string): string {
  const ms = Date.now() - new Date(date).getTime();
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 1) return '방금 전';
  if (minutes < 60) return `${minutes}분 전`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}시간 전`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}일 전`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}개월 전`;
  return `${Math.floor(months / 12)}년 전`;
}

interface QuestionCardProps {
  id: string;
  category: string;
  question: string;
  status: string;
  attemptCount: number;
  correctCount: number;
  createdAt: Date | string;
  author: { nickname: string | null } | null;
  likeCount: number;
  myAttempt?: { count: number; lastCorrect: boolean } | null;
  onClick?: () => void;
}

export default function QuestionCard({
  id,
  category,
  question,
  status,
  attemptCount,
  correctCount,
  createdAt,
  author,
  likeCount,
  myAttempt,
  onClick,
}: QuestionCardProps) {
  const accuracyText =
    attemptCount === 0
      ? '–'
      : `${Math.round((correctCount / attemptCount) * 100)}%`;

  const preview = question.length > 50 ? question.slice(0, 50) + '...' : question;

  const inner = (
    <>
      <div className="flex items-center gap-2 mb-2">
        <span className="inline-block text-xs text-neutral-500 border border-neutral-800 rounded px-2 py-0.5">
          {CATEGORY_LABELS[category] ?? category}
        </span>
        {(status === 'APPROVED' || status === 'OFFICIAL') ? (
          <span className="inline-block text-xs text-green-500 border border-green-500/30 rounded px-2 py-0.5">
            승인
          </span>
        ) : (
          <span className="inline-block text-xs text-amber-500 border border-amber-500/30 rounded px-2 py-0.5">
            등록요청
          </span>
        )}
      </div>
      <p className="text-sm text-white font-medium leading-relaxed mb-3">{preview}</p>
      <div className="flex items-center justify-between text-xs text-neutral-500">
        <span>{author?.nickname ?? '익명'}</span>
        <div className="flex items-center gap-3">
          <span>시도 {attemptCount}회</span>
          <span>정답률 {accuracyText}</span>
          {myAttempt ? (
            <span className={myAttempt.lastCorrect ? 'text-emerald-500' : 'text-red-400'}>
              {myAttempt.count}회 · {myAttempt.lastCorrect ? '정답' : '오답'}
            </span>
          ) : null}
          <span className="flex items-center gap-0.5">
            <svg width={11} height={11} viewBox="0 0 24 24" fill="currentColor" stroke="none">
              <path d="M12 21.593c-5.63-5.539-11-10.297-11-14.402 0-3.791 3.068-5.191 5.281-5.191 1.312 0 4.151.501 5.719 4.457 1.59-3.968 4.464-4.447 5.726-4.447 2.54 0 5.274 1.621 5.274 5.181 0 4.069-5.136 8.625-11 14.402z"/>
            </svg>
            {likeCount}
          </span>
          <span>{relativeTime(createdAt)}</span>
        </div>
      </div>
    </>
  );

  if (onClick) {
    return (
      <button
        onClick={onClick}
        className="w-full text-left bg-[#111111] border border-neutral-800 rounded-lg p-4 hover:border-neutral-600 transition-colors"
      >
        {inner}
      </button>
    );
  }

  return (
    <Link
      href={`/board/${id}`}
      className="block bg-[#111111] border border-neutral-800 rounded-lg p-4 hover:border-neutral-600 transition-colors"
    >
      {inner}
    </Link>
  );
}
