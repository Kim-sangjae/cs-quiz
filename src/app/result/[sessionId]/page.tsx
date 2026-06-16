"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Question, UserAnswer } from "@/types";
import ResultCard from "@/components/ResultCard";

const CATEGORY_LABEL: Record<string, string> = {
  ds: '자료구조', algo: '알고리즘', os: '운영체제',
  network: '네트워크', db: '데이터베이스', arch: '컴퓨터 구조',
};

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
  const [wrongIdx, setWrongIdx] = useState(0);

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
          <>
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-neutral-400">
                오답 <span className="text-white font-medium">{wrongIdx + 1}</span> / {wrongItems.length}
              </p>
              <div className="flex gap-1 flex-wrap justify-end max-w-[60%]">
                {wrongItems.map((item, i) => (
                  <button
                    key={item.question.id}
                    onClick={() => setWrongIdx(i)}
                    title={`Q.${item.questionNumber} ${CATEGORY_LABEL[item.question.category] ?? item.question.category}`}
                    className={`w-6 h-6 rounded text-[10px] transition-colors ${
                      i === wrongIdx
                        ? 'bg-white text-black font-bold'
                        : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700'
                    }`}
                  >
                    {item.questionNumber}
                  </button>
                ))}
              </div>
            </div>

            <ResultCard
              questionNumber={wrongItems[wrongIdx].questionNumber}
              question={wrongItems[wrongIdx].question}
              userSelected={wrongItems[wrongIdx].userAnswer!.selected}
            />

            <div className="flex items-center justify-between mt-4">
              <button
                onClick={() => setWrongIdx((i) => Math.max(0, i - 1))}
                disabled={wrongIdx === 0}
                className="rounded-md border border-neutral-700 text-sm text-neutral-300 px-4 py-2 hover:border-neutral-500 hover:text-white disabled:opacity-30 transition-colors"
              >
                ← 이전
              </button>
              <span className="text-xs text-neutral-600">
                Q.{wrongItems[wrongIdx].questionNumber} · {CATEGORY_LABEL[wrongItems[wrongIdx].question.category] ?? wrongItems[wrongIdx].question.category}
              </span>
              <button
                onClick={() => setWrongIdx((i) => Math.min(wrongItems.length - 1, i + 1))}
                disabled={wrongIdx === wrongItems.length - 1}
                className="rounded-md border border-neutral-700 text-sm text-neutral-300 px-4 py-2 hover:border-neutral-500 hover:text-white disabled:opacity-30 transition-colors"
              >
                다음 →
              </button>
            </div>
          </>
        )}
      </div>

      <div className="flex gap-3 justify-center mt-8 flex-wrap">
        {wrongItems.length > 0 && (
          <button
            onClick={() => {
              const ids = wrongItems.map((i) => i.question.id).join(",");
              router.push(`/quiz/play?category=all&reviewIds=${ids}`);
            }}
            className="rounded-md border border-amber-800/60 text-amber-400 text-sm font-medium px-5 py-2.5 hover:bg-amber-950/30 transition-colors"
          >
            오답 복습 ({wrongItems.length}문제)
          </button>
        )}
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
