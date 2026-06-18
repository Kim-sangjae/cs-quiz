'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import ResultCard from './ResultCard';
import type { Question } from '@/types';

const CATEGORY_LABELS: Record<string, string> = {
  ds: '자료구조', algo: '알고리즘', os: '운영체제',
  network: '네트워크', db: '데이터베이스', arch: '컴퓨터 구조',
};

const LABELS = ['A', 'B', 'C', 'D'] as const;

interface FetchedQuestion {
  id: string;
  category: string;
  question: string;
  options: string[];
  answer: number;
  explanation: string;
  status: string;
  rejectionReason?: string | null;
}

interface PrefetchedQuestion {
  id: string;
  category: string;
  question: string;
  options: unknown;
  answer: number;
  explanation: string;
}

interface QuestionDrawerProps {
  open: boolean;
  questionId: string | null;
  prefetched?: PrefetchedQuestion;
  userSelected?: number;
  questionNumber?: number;
  onClose: () => void;
}

export default function QuestionDrawer({
  open,
  questionId,
  prefetched,
  userSelected,
  questionNumber,
  onClose,
}: QuestionDrawerProps) {
  const [fetched, setFetched] = useState<FetchedQuestion | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) { setFetched(null); return; }
    if (prefetched || !questionId) return;
    setLoading(true);
    fetch(`/api/questions/${questionId}`)
      .then((r) => r.json())
      .then((data) => setFetched(data as FetchedQuestion))
      .catch(() => setFetched(null))
      .finally(() => setLoading(false));
  }, [open, questionId, prefetched]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const q = prefetched ?? fetched;
  const options = q ? (q.options as string[]) : [];
  const isUserQuestion = fetched && ['APPROVED', 'PENDING', 'REJECTED'].includes(fetched.status);
  const rejectionReason = fetched?.status === 'REJECTED' ? fetched.rejectionReason : null;

  return (
    <>
      <div
        className={`fixed inset-0 bg-black/60 z-40 transition-opacity duration-200 ${
          open ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
      />
      <div
        className={`fixed top-0 right-0 h-full w-full max-w-sm bg-[#0d0d0d] border-l border-neutral-800 z-50 flex flex-col shadow-2xl transition-transform duration-200 ease-out ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-800 flex-shrink-0">
          <span className="text-sm font-medium text-white">문제 보기</span>
          <button
            onClick={onClose}
            className="text-neutral-400 hover:text-white transition-colors p-1 -mr-1"
            aria-label="닫기"
          >
            <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5">
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <p className="text-neutral-500 text-sm">불러오는 중...</p>
            </div>
          ) : !q ? (
            <div className="flex items-center justify-center h-32">
              <p className="text-neutral-500 text-sm">문제를 불러올 수 없습니다.</p>
            </div>
          ) : userSelected !== undefined ? (
            <ResultCard
              questionNumber={questionNumber ?? 1}
              question={q as unknown as Question}
              userSelected={userSelected as 0 | 1 | 2 | 3}
              questionId={q.id}
            />
          ) : (
            <>
              <span className="text-xs text-neutral-500 border border-neutral-800 rounded px-2 py-0.5 inline-block mb-3">
                {CATEGORY_LABELS[q.category] ?? q.category}
              </span>
              <p className="text-sm text-white leading-relaxed mb-5">{q.question}</p>
              <div className="space-y-2 mb-5">
                {options.map((opt, i) => {
                  const isCorrect = i === q.answer;
                  return (
                    <div
                      key={i}
                      className={`rounded-md border px-4 py-2.5 text-sm flex items-start gap-3 ${
                        isCorrect
                          ? 'border-green-500 bg-green-500/10 text-green-400'
                          : 'border-neutral-700 text-neutral-300'
                      }`}
                    >
                      <span className="text-xs font-mono opacity-70 flex-shrink-0 mt-0.5">{LABELS[i]}.</span>
                      <span>{opt}</span>
                    </div>
                  );
                })}
              </div>
              {q.explanation && (
                <div className="border-t border-neutral-800 pt-4 mb-4">
                  <p className="text-xs text-neutral-500 mb-1.5">해설</p>
                  <p className="text-xs text-neutral-400 leading-relaxed">{q.explanation}</p>
                </div>
              )}
              {rejectionReason && (
                <div className="border-t border-neutral-800 pt-4 mb-4">
                  <p className="text-xs text-neutral-500 mb-1.5">거절 사유</p>
                  <p className="text-xs text-red-400 leading-relaxed">{rejectionReason}</p>
                  <div className="mt-3">
                    <Link
                      href={`/board/submit?resubmit=${q.id}`}
                      onClick={onClose}
                      className="text-xs text-white border border-neutral-600 rounded px-3 py-1.5 hover:bg-neutral-800 transition-colors"
                    >
                      수정 후 재요청
                    </Link>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {q && !loading && userSelected === undefined && isUserQuestion && (
          <div className="flex-shrink-0 px-5 pb-5 pt-3 border-t border-neutral-800">
            <Link
              href={`/board/${q.id}`}
              onClick={onClose}
              className="text-xs text-neutral-400 hover:text-white transition-colors"
            >
              게시판에서 보기 →
            </Link>
          </div>
        )}
      </div>
    </>
  );
}
