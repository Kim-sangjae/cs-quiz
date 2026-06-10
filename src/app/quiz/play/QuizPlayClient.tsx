"use client";

import { useState } from "react";
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
  }

  async function handleSubmit(): Promise<void> {
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

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm text-neutral-400">
          {currentIndex + 1} / {questions.length}
        </span>
        <span className="text-xs text-neutral-500">
          {answers.length}문제 선택 완료
        </span>
      </div>

      <div className="mb-6">
        <ProgressBar answered={answers.length} total={questions.length} />
      </div>

      <QuizCard
        questionNumber={currentIndex + 1}
        total={questions.length}
        question={current.question}
        options={current.options}
        selectedIndex={selectedIndex}
        onSelect={(idx) => handleSelect(current.id, idx)}
      />

      <div className="sticky bottom-0 bg-[#0a0a0a] border-t border-neutral-800 py-4 mt-6">
        <div className="mb-3">
          <Navigator
            total={questions.length}
            currentIndex={currentIndex}
            answeredIndices={answeredIndices}
            onJump={(i) => setCurrentIndex(i)}
          />
        </div>

        <div className="flex justify-between items-end">
          <button
            onClick={() => setCurrentIndex((i) => i - 1)}
            disabled={currentIndex === 0}
            className="rounded-md border border-neutral-800 text-sm text-neutral-400 px-4 py-2 hover:border-neutral-600 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors flex items-center gap-1"
          >
            <svg width={16} height={16} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            이전
          </button>

          <div className="flex flex-col items-end gap-1">
            {!allAnswered && (
              <span className="text-xs text-neutral-500">{unanswered}문제 미선택</span>
            )}
            <div className="flex gap-2">
              <button
                onClick={() => setCurrentIndex((i) => i + 1)}
                disabled={currentIndex === questions.length - 1}
                className="rounded-md border border-neutral-800 text-sm text-neutral-400 px-4 py-2 hover:border-neutral-600 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors flex items-center gap-1"
              >
                다음
                <svg width={16} height={16} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </button>
              <button
                onClick={handleSubmit}
                disabled={!allAnswered}
                className="rounded-md bg-white text-black text-sm font-medium px-6 py-2.5 hover:bg-neutral-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                제출
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
