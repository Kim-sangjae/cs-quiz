"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import confetti from "canvas-confetti";
import type { Question, UserAnswer } from "@/types";
import ResultCard from "@/components/ResultCard";

declare global {
  interface Window {
    Kakao: {
      init: (key: string) => void;
      isInitialized: () => boolean;
      Share: {
        sendDefault: (options: Record<string, unknown>) => void;
      };
    };
  }
}

const CATEGORY_LABEL: Record<string, string> = {
  ds: '자료구조', algo: '알고리즘', os: '운영체제',
  network: '네트워크', db: '데이터베이스', arch: '컴퓨터 구조', se: '소프트웨어공학',
};

interface SessionData {
  session: { score: number; submittedAt: string };
  questions: Question[];
  answers: UserAnswer[];
}

export default function ResultClient({ sessionId }: { sessionId: string }) {
  const router = useRouter();
  const [data, setData] = useState<SessionData | null>(null);
  const [wrongIdx, setWrongIdx] = useState(0);
  const [reviewTab, setReviewTab] = useState<'wrong' | 'all'>('wrong');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [copyLabel, setCopyLabel] = useState('링크 복사');
  const [shareModal, setShareModal] = useState<string | null>(null);
  const [bookmarkedIds, setBookmarkedIds] = useState<Set<string>>(new Set());
  const [pointsEarned, setPointsEarned] = useState<number | null>(null);

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
    const earned = sessionStorage.getItem(`points-earned-${sessionId}`);
    if (earned) {
      setPointsEarned(Number(earned));
      sessionStorage.removeItem(`points-earned-${sessionId}`);
    }
  }, [sessionId, router]);

  useEffect(() => {
    const KAKAO_KEY = process.env.NEXT_PUBLIC_KAKAO_APP_KEY;
    if (!KAKAO_KEY) return;
    if (window.Kakao) {
      if (!window.Kakao.isInitialized()) window.Kakao.init(KAKAO_KEY);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://t1.kakaocdn.net/kakao_js_sdk/2.7.2/kakao.min.js';
    script.crossOrigin = 'anonymous';
    script.onload = () => {
      if (window.Kakao && !window.Kakao.isInitialized()) window.Kakao.init(KAKAO_KEY);
    };
    document.head.appendChild(script);
  }, []);

  useEffect(() => {
    fetch('/api/mypage/liked-questions')
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { questions: { id: string }[] } | null) => {
        if (d?.questions) setBookmarkedIds(new Set(d.questions.map((q) => q.id)));
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!data || data.session.score < data.questions.length) return;
    const end = Date.now() + 2500;
    const frame = () => {
      confetti({ particleCount: 6, angle: 60, spread: 55, origin: { x: 0 }, colors: ['#10b981', '#ffffff', '#6ee7b7'] });
      confetti({ particleCount: 6, angle: 120, spread: 55, origin: { x: 1 }, colors: ['#10b981', '#ffffff', '#6ee7b7'] });
      if (Date.now() < end) requestAnimationFrame(frame);
    };
    frame();
  }, [data]);

  if (!data) return (
    <div className="flex items-center justify-center min-h-[40vh]">
      <div className="w-6 h-6 border-2 border-neutral-600 border-t-white rounded-full animate-spin" />
    </div>
  );

  const { session, questions, answers } = data;
  const total = questions.length;

  const ShareModal = shareModal !== null ? (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center px-4" onClick={() => setShareModal(null)}>
      <div className="bg-[#111] border border-neutral-800 rounded-xl p-6 max-w-xs w-full" onClick={(e) => e.stopPropagation()}>
        <p className="text-sm font-semibold text-white mb-4">공유하기</p>
        <div className="flex flex-col gap-2">
          {process.env.NEXT_PUBLIC_KAKAO_APP_KEY && (
            <button
              onClick={() => {
                const pct = Math.round((session.score / total) * 100);
                const catSummaryText = catEntries.map(([cat, { correct, total: t }]) =>
                  `${CATEGORY_LABEL[cat] ?? cat} ${correct}/${t}`
                ).join(' · ');
                setShareModal(null);
                if (!window.Kakao?.isInitialized()) return;
                const resultUrl = window.location.href;
                window.Kakao.Share.sendDefault({
                  objectType: 'feed',
                  content: {
                    title: `CSORA 결과 — ${session.score}/${total}점 (${pct}%)`,
                    description: `${catSummaryText} | 나도 도전해보기!`,
                    imageUrl: `${window.location.origin}/og-image-dark.png`,
                    link: { mobileWebUrl: resultUrl, webUrl: resultUrl },
                  },
                  buttons: [
                    { title: '결과 보기', link: { mobileWebUrl: resultUrl, webUrl: resultUrl } },
                  ],
                });
              }}
              className="w-full rounded-md bg-[#FEE500] text-[#3A1D1D] text-sm font-semibold py-3 hover:bg-[#F5DC00] transition-colors flex items-center justify-center gap-2"
            >
              <svg width={16} height={16} viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 3C6.477 3 2 6.582 2 11c0 2.731 1.534 5.124 3.88 6.638-.17.592-.63 2.158-.722 2.496-.112.414.152.408.32.297.132-.088 2.099-1.426 2.948-2.003.5.07 1.013.106 1.574.106 5.523 0 10-3.582 10-8s-4.477-8-10-8z"/>
              </svg>
              카카오톡으로 공유
            </button>
          )}
          {typeof navigator !== 'undefined' && 'share' in navigator && (
            <button
              onClick={() => {
                const catSummary = catEntries.map(([cat, { correct, total: t }]) =>
                  `${CATEGORY_LABEL[cat] ?? cat} ${correct}/${t}`
                ).join(' · ');
                const pct = Math.round((session.score / total) * 100);
                setShareModal(null);
                navigator.share({
                  title: `CSORA — ${session.score}/${total}점`,
                  text: `📊 CSORA 결과 — ${session.score}/${total}점 (${pct}%)\n\n${catSummary}\n\n지금 도전해보기 👉`,
                  url: window.location.href,
                }).catch(() => {});
              }}
              className="w-full rounded-md border border-neutral-700 text-sm text-neutral-300 py-3 hover:border-neutral-500 hover:text-white transition-colors flex items-center justify-center gap-2"
            >
              <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z" />
              </svg>
              다른 앱으로 공유
            </button>
          )}
          <button
            onClick={() => {
              const quizUrl = `${window.location.origin}/quiz/play?sharedFrom=${sessionId}`;
              navigator.clipboard.writeText(quizUrl).then(() => {
                setCopyLabel('복사됨!');
                setTimeout(() => { setCopyLabel('링크 복사'); setShareModal(null); }, 1200);
              });
            }}
            className="w-full rounded-md border border-neutral-700 text-sm text-neutral-300 py-3 hover:border-neutral-500 hover:text-white transition-colors flex items-center justify-center gap-2"
          >
            <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
            </svg>
            같은 문제 공유 (링크 복사)
          </button>
          <button
            onClick={() => {
              navigator.clipboard.writeText(window.location.href).then(() => {
                setCopyLabel('복사됨!');
                setTimeout(() => { setCopyLabel('링크 복사'); setShareModal(null); }, 1200);
              });
            }}
            className="w-full rounded-md border border-neutral-700 text-sm text-neutral-300 py-3 hover:border-neutral-500 hover:text-white transition-colors"
          >
            {copyLabel}
          </button>
          <button
            onClick={() => setShareModal(null)}
            className="w-full rounded-md text-xs text-neutral-600 py-2 hover:text-neutral-400 transition-colors"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  ) : null;

  const pctScore = total > 0 ? session.score / total : 0;
  const scoreColor =
    pctScore >= 0.85
      ? "text-green-400"
      : pctScore >= 0.70
      ? "text-yellow-400"
      : "text-red-400";

  const message =
    pctScore >= 0.85
      ? "우수 — CS 기초가 탄탄합니다"
      : pctScore >= 0.70
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
      {ShareModal}
      {pointsEarned !== null && (
        <div className="flex items-center gap-2 bg-amber-950/30 border border-amber-800/40 rounded-lg px-4 py-2.5 mb-4">
          <span className="text-amber-400 text-sm font-semibold">+{pointsEarned}P</span>
          <span className="text-amber-500/80 text-xs">퀴즈 완료 보상이 지급되었습니다</span>
        </div>
      )}
      <div className="text-center mb-8">
        <div className="mb-2">
          <span className={`text-4xl font-bold ${scoreColor}`}>
            {session.score}
          </span>
          <span className="text-4xl text-neutral-500"> / {total}</span>
        </div>
        <p className={`text-sm ${scoreColor} mb-1`}>{message}</p>
        <p className="text-sm text-neutral-400">
          정답 {session.score}개 · 오답 {total - session.score}개
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
                userSelected={wrongItems[wrongIdx].userAnswer?.selected ?? null}
                questionId={wrongItems[wrongIdx].question.id}
                initialBookmarked={bookmarkedIds.has(wrongItems[wrongIdx].question.id)}
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
                      <ResultCard
                        questionNumber={i + 1}
                        question={q}
                        userSelected={ua != null ? (ua.selected as 0 | 1 | 2 | 3) : null}
                        questionId={q.id}
                        initialBookmarked={bookmarkedIds.has(q.id)}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="mt-8 space-y-3">
        {/* 공유 버튼 */}
        <div className="flex justify-center">
          <button
            onClick={() => setShareModal('open')}
            className="rounded-md border border-neutral-700 text-sm text-neutral-300 px-5 py-2.5 hover:border-neutral-500 hover:text-white transition-colors flex items-center gap-2"
          >
            <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z" />
            </svg>
            공유하기
          </button>
        </div>

        {/* 액션 버튼 그룹 */}
        <div className="flex gap-2 justify-center flex-wrap">
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
    </div>
  );
}
