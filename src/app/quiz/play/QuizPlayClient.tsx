"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { Question, UserAnswer } from "@/types";
import QuizCard from "@/components/QuizCard";
import Navigator from "@/components/Navigator";
import ProgressBar from "@/components/ProgressBar";

interface Props {
  questions: Question[];
  category: string;
  isReview?: boolean;
}

export default function QuizPlayClient({ questions, category, isReview }: Props) {
  const router = useRouter();
  const [answers, setAnswers] = useState<UserAnswer[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);
  const [exitModal, setExitModal] = useState<{ url: string | null; isBack: boolean } | null>(null);
  const autoAdvanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const allowNavRef = useRef(false);

  const isDirty = answers.length > 0 && !isSubmitting;

  // 브라우저 닫기/새로고침
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (!isDirty) return;
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  // 헤더 링크 클릭 인터셉트 (캡처 페이즈)
  useEffect(() => {
    const handleLinkClick = (e: MouseEvent) => {
      if (!isDirty) return;
      const anchor = (e.target as HTMLElement).closest("a");
      if (!anchor) return;
      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#") || /^https?:\/\//.test(href)) return;
      e.preventDefault();
      e.stopPropagation();
      setExitModal({ url: href, isBack: false });
    };
    document.addEventListener("click", handleLinkClick, true);
    return () => document.removeEventListener("click", handleLinkClick, true);
  }, [isDirty]);

  // 브라우저 뒤로가기 (popstate)
  useEffect(() => {
    const handlePopState = () => {
      if (allowNavRef.current) {
        allowNavRef.current = false;
        return;
      }
      if (!isDirty) return;
      history.pushState(null, '', window.location.href);
      setExitModal({ url: null, isBack: true });
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [isDirty]);

  function handleExitConfirm() {
    setExitModal(null);
    if (exitModal?.isBack) {
      allowNavRef.current = true;
      router.back();
    } else if (exitModal?.url) {
      router.push(exitModal.url);
    }
  }

  function handleSelect(questionId: string, selected: 0 | 1 | 2 | 3): void {
    setAnswers((prev) => {
      const existing = prev.findIndex((a) => a.questionId === questionId);
      if (existing !== -1) {
        const next = [...prev];
        next[existing] = { questionId, selected };
        return next;
      }
      return [...prev, { questionId, selected }];
    });

    if (autoAdvanceTimer.current) clearTimeout(autoAdvanceTimer.current);
    if (currentIndex < questions.length - 1) {
      autoAdvanceTimer.current = setTimeout(() => {
        setCurrentIndex((i) => i + 1);
      }, 500);
    }
  }

  async function handleSubmit(): Promise<void> {
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/quiz/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category,
          questionIds: questions.map((q) => q.id),
          answers,
        }),
      });
      if (res.status === 401) {
        setShowLoginPrompt(true);
        setIsSubmitting(false);
        return;
      }
      if (!res.ok) {
        router.replace("/");
        return;
      }
      const { sessionId } = await res.json() as { sessionId: string };
      router.push(`/result/${sessionId}`);
    } catch (e) {
      console.error("[QuizPlay] submit failed:", e);
      router.replace("/");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (questions.length === 0) return null;

  const current = questions[currentIndex];
  const selectedIndex =
    answers.find((a) => a.questionId === current.id)?.selected ?? null;
  const answeredIndices = answers.map((a) =>
    questions.findIndex((q) => q.id === a.questionId)
  );
  const unanswered = questions.length - answers.length;
  const allAnswered = unanswered === 0;
  const pct = Math.round((answers.length / questions.length) * 100);

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      {/* 로그인 유도 모달 */}
      {showLoginPrompt && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 px-4">
          <div className="bg-[#111] border border-neutral-800 rounded-xl p-6 max-w-sm w-full">
            <h2 className="text-white font-semibold text-base mb-2">로그인이 필요합니다</h2>
            <p className="text-neutral-400 text-sm mb-6 leading-relaxed">
              퀴즈 결과를 저장하려면 로그인이 필요합니다. 로그인 후 오답 복습, 랭킹 등 모든 기능을 사용할 수 있습니다.
            </p>
            <div className="flex gap-3">
              <Link
                href="/api/auth/signin"
                className="flex-1 rounded-lg bg-white text-black text-sm font-semibold py-2.5 text-center hover:bg-neutral-200 transition-colors"
              >
                로그인
              </Link>
              <button
                onClick={() => router.push("/")}
                className="flex-1 rounded-lg border border-neutral-700 text-sm text-neutral-300 py-2.5 hover:border-neutral-500 hover:text-white transition-colors"
              >
                홈으로
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 퀴즈 이탈 확인 모달 */}
      {exitModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 px-4">
          <div className="bg-[#111] border border-neutral-800 rounded-xl p-6 max-w-sm w-full">
            <h2 className="text-white font-semibold text-base mb-2">퀴즈를 종료하시겠습니까?</h2>
            <p className="text-neutral-400 text-sm mb-6 leading-relaxed">
              지금 나가면 현재까지의 답변 {answers.length}개가 모두 사라집니다.
            </p>
            <div className="flex gap-3">
              <button
                onClick={handleExitConfirm}
                className="flex-1 rounded-lg bg-neutral-800 border border-neutral-700 text-sm text-neutral-200 py-2.5 hover:bg-neutral-700 transition-colors"
              >
                나가기
              </button>
              <button
                onClick={() => setExitModal(null)}
                className="flex-1 rounded-lg bg-white text-black text-sm font-semibold py-2.5 hover:bg-neutral-200 transition-colors"
              >
                계속 풀기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 상단 진행 상태 */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-lg font-semibold text-white">{currentIndex + 1}</span>
            <span className="text-neutral-600">/ {questions.length}</span>
            {isReview && (
              <span className="text-[10px] text-amber-400 border border-amber-800/60 rounded px-1.5 py-0.5">
                오답 복습
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-emerald-400 font-medium">{answers.length}개 완료</span>
            {unanswered > 0 && (
              <span className="text-xs text-neutral-600">· {unanswered}개 남음</span>
            )}
            <span className="text-xs text-neutral-500 bg-neutral-900 border border-neutral-800 rounded px-1.5 py-0.5">
              {pct}%
            </span>
          </div>
        </div>
        <ProgressBar answered={answers.length} total={questions.length} />
      </div>

      {/* 문제 카드 */}
      <QuizCard
        questionNumber={currentIndex + 1}
        total={questions.length}
        category={current.category}
        question={current.question}
        options={current.options}
        selectedIndex={selectedIndex}
        onSelect={(idx) => handleSelect(current.id, idx)}
      />

      {/* 하단 고정 영역 */}
      <div className="sticky bottom-0 bg-[#0a0a0a]/95 backdrop-blur border-t border-neutral-800/60 py-3 mt-4">
        {/* Navigator */}
        <div className="mb-3 overflow-x-auto pb-1">
          <Navigator
            total={questions.length}
            currentIndex={currentIndex}
            answeredIndices={answeredIndices}
            onJump={(i) => {
              if (autoAdvanceTimer.current) clearTimeout(autoAdvanceTimer.current);
              setCurrentIndex(i);
            }}
          />
        </div>

        {/* 이전 / 다음 / 제출 */}
        <div className="flex items-center justify-between gap-2">
          <button
            onClick={() => {
              if (autoAdvanceTimer.current) clearTimeout(autoAdvanceTimer.current);
              setCurrentIndex((i) => i - 1);
            }}
            disabled={currentIndex === 0}
            className="rounded-lg border border-neutral-800 text-sm text-neutral-400 px-4 py-2 hover:border-neutral-600 hover:text-white disabled:opacity-25 disabled:cursor-not-allowed transition-colors flex items-center gap-1"
          >
            <svg width={14} height={14} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            이전
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                if (autoAdvanceTimer.current) clearTimeout(autoAdvanceTimer.current);
                setCurrentIndex((i) => i + 1);
              }}
              disabled={currentIndex === questions.length - 1}
              className="rounded-lg border border-neutral-800 text-sm text-neutral-400 px-4 py-2 hover:border-neutral-600 hover:text-white disabled:opacity-25 disabled:cursor-not-allowed transition-colors flex items-center gap-1"
            >
              다음
              <svg width={14} height={14} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
            <button
              onClick={handleSubmit}
              disabled={!allAnswered || isSubmitting}
              className="rounded-lg bg-white text-black text-sm font-semibold px-5 py-2 hover:bg-neutral-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              {isSubmitting ? '제출 중...' : allAnswered ? '제출' : `${unanswered}개 남음`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
