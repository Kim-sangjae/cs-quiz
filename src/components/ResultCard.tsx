'use client';

import { useState } from 'react';
import type { Question } from '@/types';
import ReportModal from '@/components/board/ReportModal';

interface ResultCardProps {
  questionNumber: number;
  question: Question;
  userSelected: 0 | 1 | 2 | 3 | null;
  questionId?: string;
  initialBookmarked?: boolean;
}

const LABELS = ['A', 'B', 'C', 'D'] as const;

export default function ResultCard({
  questionNumber,
  question,
  userSelected,
  questionId,
  initialBookmarked = false,
}: ResultCardProps) {
  const [bookmarked, setBookmarked] = useState(initialBookmarked);
  const [bookmarkPending, setBookmarkPending] = useState(false);

  async function toggleBookmark() {
    if (!questionId || bookmarkPending) return;
    setBookmarkPending(true);
    try {
      const res = await fetch(`/api/questions/${questionId}/like`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json() as { liked: boolean };
        setBookmarked(data.liked);
      }
    } finally {
      setBookmarkPending(false);
    }
  }

  return (
    <div className="bg-[#111111] border border-neutral-800 rounded-lg p-6">
      <div className="flex items-center gap-3 mb-4">
        <span className="text-xs text-neutral-500 border border-neutral-800 rounded px-2 py-0.5">
          {question.category}
        </span>
        <span className="text-sm text-neutral-500">Q.{questionNumber}</span>
        {question.authorNickname && (
          <span className="text-[10px] text-neutral-700">등록: {question.authorNickname}</span>
        )}
        {questionId && (
          <button
            onClick={toggleBookmark}
            disabled={bookmarkPending}
            title={bookmarked ? '북마크 해제' : '북마크'}
            className={`ml-auto flex items-center gap-1 text-xs px-2.5 py-1 rounded-md border transition-colors disabled:opacity-50 ${
              bookmarked
                ? 'border-yellow-500/50 bg-yellow-500/10 text-yellow-400'
                : 'border-neutral-800 text-neutral-500 hover:border-neutral-600 hover:text-neutral-300'
            }`}
          >
            <svg width={13} height={13} viewBox="0 0 24 24" fill={bookmarked ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0z" />
            </svg>
            {bookmarked ? '북마크됨' : '북마크'}
          </button>
        )}
      </div>

      {userSelected === null && (
        <span className="inline-block text-[10px] text-red-400 border border-red-900/50 rounded px-1.5 py-0.5 mb-3">
          시간 초과 (미답변)
        </span>
      )}
      <p className="text-base font-medium text-white leading-relaxed mb-6">
        {question.question}
      </p>

      <div className="space-y-3">
        {question.options.map((option, i) => {
          const idx = i as 0 | 1 | 2 | 3;
          const isCorrect = idx === question.answer;
          const isUserWrong = userSelected !== null && idx === userSelected && !isCorrect;

          let cls =
            'w-full text-left rounded-md border px-4 py-3 text-sm flex items-start cursor-default ';
          if (isCorrect) {
            cls += 'border-green-500 bg-green-500/10 text-green-400';
          } else if (isUserWrong) {
            cls += 'border-red-500 bg-red-500/10 text-red-400';
          } else {
            cls += 'border-neutral-800 bg-[#1a1a1a] text-neutral-500';
          }

          return (
            <div key={idx} className={cls}>
              <span className="text-xs font-mono mr-3 flex-shrink-0 mt-0.5 opacity-70">
                {LABELS[i]}.
              </span>
              <span className="flex-1">{option}</span>
              {isCorrect && (
                <svg
                  className="ml-2 flex-shrink-0 mt-0.5"
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
              {isUserWrong && (
                <svg
                  className="ml-2 flex-shrink-0 mt-0.5"
                  width={16}
                  height={16}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              )}
            </div>
          );
        })}
      </div>

      <div className="border-t border-neutral-800 mt-4 pt-4">
        <p className="text-sm text-neutral-300 leading-relaxed">{question.explanation}</p>
        {questionId && (
          <div className="flex justify-end mt-3">
            <ReportModal questionId={questionId} initialReported={false} />
          </div>
        )}
      </div>
    </div>
  );
}
