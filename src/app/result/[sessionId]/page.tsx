"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Question, UserAnswer } from "@/types";
import ResultCard from "@/components/ResultCard";

interface SessionData {
  session: { score: number; submittedAt: string };
  questions: Question[];
  answers: UserAnswer[];
}

export default function ResultPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = use(params);
  const router = useRouter();
  const [data, setData] = useState<SessionData | null>(null);

  useEffect(() => {
    fetch(`/api/quiz/sessions/${sessionId}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((d: SessionData | null) => {
        if (!d) {
          router.replace("/quiz");
          return;
        }
        setData(d);
      })
      .catch(() => router.replace("/quiz"));
  }, [sessionId, router]);

  if (!data) return null;

  const { session, questions, answers } = data;

  const scoreColor =
    session.score >= 27
      ? "text-green-400"
      : session.score >= 21
      ? "text-yellow-400"
      : "text-red-400";

  const message =
    session.score >= 27
      ? "우수 — CS 기초가 탄탄합니다"
      : session.score >= 21
      ? "양호 — 취약 부분을 확인하세요"
      : "분발 — 오답 해설을 꼼꼼히 읽어보세요";

  const wrongItems = questions
    .map((q, i) => ({
      question: q,
      questionNumber: i + 1,
      userAnswer: answers.find((a) => a.questionId === q.id),
    }))
    .filter(
      ({ question, userAnswer }) =>
        !userAnswer || userAnswer.selected !== question.answer
    );

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="text-center mb-10">
        <div className="mb-2">
          <span className={`text-4xl font-bold ${scoreColor}`}>
            {session.score}
          </span>
          <span className="text-4xl text-neutral-500"> / 30</span>
        </div>
        <p className={`text-sm ${scoreColor} mb-1`}>{message}</p>
        <p className="text-sm text-neutral-400">
          정답 {session.score}개 · 오답 {30 - session.score}개
        </p>
      </div>

      <div>
        {wrongItems.length === 0 ? (
          <p className="text-green-400 text-center text-base font-medium py-8">
            모든 문제를 맞혔습니다! 🎉
          </p>
        ) : (
          <div className="space-y-4">
            {wrongItems.map((item) => (
              <ResultCard
                key={item.question.id}
                questionNumber={item.questionNumber}
                question={item.question}
                userSelected={item.userAnswer!.selected}
              />
            ))}
          </div>
        )}
      </div>

      <div className="flex gap-3 justify-center mt-8">
        <button
          onClick={() => router.push("/quiz")}
          className="rounded-md bg-white text-black text-sm font-medium px-6 py-2.5 hover:bg-neutral-200 transition-colors"
        >
          다시 풀기
        </button>
        <button
          onClick={() => router.push("/")}
          className="rounded-md border border-neutral-700 text-sm text-neutral-300 px-5 py-2.5 hover:border-neutral-500 hover:text-white transition-colors"
        >
          홈으로
        </button>
      </div>
    </div>
  );
}
