"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import confetti from "canvas-confetti";
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
  const [reviewTab, setReviewTab] = useState<'wrong' | 'all'>('wrong');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [shareLabel, setShareLabel] = useState('결과 공유');

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

  useEffect(() => {
    if (!data || data.session.score < 30) return;
    const end = Date.now() + 2500;
    const frame = () => {
      confetti({ particleCount: 6, angle: 60, spread: 55, origin: { x: 0 }, colors: ['#10b981', '#ffffff', '#6ee7b7'] });
      confetti({ particleCount: 6, angle: 120, spread: 55, origin: { x: 1 }, colors: ['#10b981', '#ffffff', '#6ee7b7'] });
      if (Date.now() < end) requestAnimationFrame(frame);
    };
    frame();
  }, [data]);

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

  const catStats: Record<string, { total: number; correct: number }> = {};
  for (const q of questions) {
    const cat = q.category;
    if (!catStats[cat]) catStats[cat] = { total: 0, correct: 0 };
    catStats[cat].total++;
    const ua = answers.find((a) => a.questionId === q.id);
    if (ua && ua.selected === q.answer) catStats[cat].correct++;
  }
  const catEntries = Object.entries(catStats).sort((a, b) => b[1].total - a[1].total);

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="text-center mb-8">
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

      {/* 카테고리별 분석 */}
      {catEntries.length > 0 && (
        <div className="bg-[#111111] border border-neutral-800 rounded-xl p-5 mb-8">
          <p className="text-xs text-neutral-500 mb-4">카테고리별 결과</p>
          <div className="space-y-3">
            {catEntries.map(([cat, { total, correct }]) => {
              const pct = Math.round((correct / total) * 100);
              const barColor = pct >= 80 ? 'bg-emerald-500' : pct >= 60 ? 'bg-yellow-500' : 'bg-red-500';
              const textColor = pct >= 80 ? 'text-emerald-400' : pct >= 60 ? 'text-yellow-400' : 'text-red-400';
              return (
                <div key={cat}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-neutral-300">{CATEGORY_LABEL[cat] ?? cat}</span>
                    <span className={`text-xs font-medium ${textColor}`}>{correct}/{total} ({pct}%)</span>
                  </div>
                  <div className="h-1.5 bg-neutral-800 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${barColor}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div>
        {/* 탭 */}
        <div className="flex gap-1 mb-4 border-b border-neutral-800 pb-0">
          <button
            onClick={() => setReviewTab('wrong')}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
              reviewTab === 'wrong'
                ? 'border-white text-white'
                : 'border-transparent text-neutral-500 hover:text-neutral-300'
            }`}
          >
            오답 {wrongItems.length > 0 && <span className="ml-1 text-xs text-red-400">{wrongItems.length}</span>}
          </button>
          <button
            onClick={() => setReviewTab('all')}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
              reviewTab === 'all'
                ? 'border-white text-white'
                : 'border-transparent text-neutral-500 hover:text-neutral-300'
            }`}
          >
            전체 {questions.length}문제
          </button>
        </div>

        {reviewTab === 'wrong' && (
          wrongItems.length === 0 ? (
            <p className="text-green-400 text-center text-base font-medium py-8">
              모든 문제를 맞혔습니다! 🎉
            </p>
          ) : (
            <>
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm text-neutral-400">
                  오답 <span className="text-white font-medium">{wrongIdx + 1}</span> / {wrongItems.length}
                </p>
                <div className="flex gap-1 flex-wrap justify-end">
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
                questionId={wrongItems[wrongIdx].question.id}
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
          )
        )}

        {reviewTab === 'all' && (
          <div className="space-y-2">
            {questions.map((q, i) => {
              const ua = answers.find((a) => a.questionId === q.id);
              const isCorrect = ua && ua.selected === q.answer;
              const isExpanded = expandedId === q.id;
              return (
                <div key={q.id} className="border border-neutral-800 rounded-lg overflow-hidden">
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : q.id)}
                    className="w-full text-left px-4 py-3 hover:bg-[#1a1a1a] transition-colors flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-xs text-neutral-600 flex-shrink-0">{i + 1}.</span>
                      <span className={`text-[10px] flex-shrink-0 border rounded px-1.5 py-0.5 ${
                        isCorrect
                          ? 'text-emerald-400 border-emerald-900/50'
                          : 'text-red-400 border-red-900/50'
                      }`}>
                        {isCorrect ? '정답' : '오답'}
                      </span>
                      <span className="text-sm text-neutral-300 truncate">{q.question}</span>
                    </div>
                    <svg
                      width={14} height={14} viewBox="0 0 24 24" fill="none"
                      stroke="currentColor" strokeWidth={2}
                      className={`text-neutral-600 flex-shrink-0 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  {isExpanded && (
                    <div className="border-t border-neutral-800">
                      {ua != null && (
                      <ResultCard
                        questionNumber={i + 1}
                        question={q}
                        userSelected={ua.selected as 0 | 1 | 2 | 3}
                        questionId={q.id}
                      />
                    )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
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
          onClick={() => {
            const catSummary = catEntries.map(([cat, { correct, total }]) =>
              `${CATEGORY_LABEL[cat] ?? cat} ${correct}/${total}`
            ).join(' · ');
            const shareText = `CS Quiz 결과: ${session.score}/30점\n${catSummary}`;
            const shareUrl = `${window.location.origin}/quiz`;
            if (navigator.share) {
              navigator.share({ title: 'CS Quiz 결과', text: shareText, url: shareUrl }).catch(() => {});
            } else {
              navigator.clipboard.writeText(`${shareText}\n${shareUrl}`).then(() => {
                setShareLabel('복사됨!');
                setTimeout(() => setShareLabel('결과 공유'), 2000);
              });
            }
          }}
          className="rounded-md border border-neutral-700 text-sm text-neutral-300 px-5 py-2.5 hover:border-neutral-500 hover:text-white transition-colors"
        >
          {shareLabel}
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
