"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import type { Question, UserAnswer } from "@/types";
import QuizCard from "@/components/QuizCard";
import Navigator from "@/components/Navigator";
import ProgressBar from "@/components/ProgressBar";

interface Props {
  questions: Question[];
  category: string;
}

export default function QuizPlayClient({ questions, category }: Props) {
  const router = useRouter();
  const [answers, setAnswers] = useState<UserAnswer[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const autoAdvanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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
      {/* 상단 진행 상태 */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-lg font-semibold text-white">{currentIndex + 1}</span>
            <span className="text-neutral-600">/ {questions.length}</span>
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
