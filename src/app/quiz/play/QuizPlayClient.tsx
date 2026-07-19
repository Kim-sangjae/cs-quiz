"use client";

import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import type { Question, UserAnswer } from "@/types";
import QuizCard from "@/components/QuizCard";
import Navigator from "@/components/Navigator";
import ProgressBar from "@/components/ProgressBar";

interface Props {
  // 정답 prop 전달 금지(CLAUDE.md) — 채점은 서버(api/quiz/sessions)에서만 함
  questions: Omit<Question, "answer" | "explanation">[];
  category: string;
  mode?: 'normal' | 'review' | 'timed';
  isReview?: boolean;
  isTimed?: boolean;
  initialBookmarks?: Record<string, boolean>;
  initialPoints?: number | null; // null = 비로그인, 0+ = 로그인 포인트
}


export default function QuizPlayClient({ questions, category, mode = 'normal', isReview, isTimed, initialBookmarks = {}, initialPoints = null }: Props) {
  const router = useRouter();
  const [answers, setAnswers] = useState<UserAnswer[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isSubmittingRef = useRef(false);
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);
  const [exitModal, setExitModal] = useState<{ url: string | null; isBack: boolean } | null>(null);
  const autoAdvanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const allowNavRef = useRef(false);
  const guardPushedRef = useRef(false);
  const quizUrlRef = useRef('');

  const [autoAdvance, setAutoAdvance] = useState(true);
  const [bookmarks, setBookmarks] = useState<Record<string, boolean>>(initialBookmarks);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [points, setPoints] = useState(initialPoints ?? 0);
  const [hintPending, setHintPending] = useState(false);
  // questionId -> eliminated option index (original index)
  const [hints, setHints] = useState<Record<string, number>>({});

  // 보기 순서 셔플 (question당 1회, Fisher-Yates on [0,1,2,3])
  // optionOrders[qId][visualPos] = originalIndex
  const optionOrders = useMemo<Record<string, [number, number, number, number]>>(() => {
    const result: Record<string, [number, number, number, number]> = {};
    for (const q of questions) {
      const order: [number, number, number, number] = [0, 1, 2, 3];
      for (let i = 3; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [order[i], order[j]] = [order[j], order[i]];
      }
      result[q.id] = order;
    }
    return result;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [questions.map((q) => q.id).join(',')]);

  // 시각 위치(visual) ↔ 원본 인덱스(original) 변환
  const visualToOrig = useCallback((qId: string, visual: number): 0 | 1 | 2 | 3 => {
    return (optionOrders[qId]?.[visual] ?? visual) as 0 | 1 | 2 | 3;
  }, [optionOrders]);
  const origToVisual = useCallback((qId: string, orig: number): number => {
    return optionOrders[qId]?.indexOf(orig) ?? orig;
  }, [optionOrders]);

  const QUESTION_SECONDS = 15;
  const isDirty = answers.length > 0 && !isSubmitting;

  // handleSubmit ref — interval/timer 내부에서 항상 최신 버전 호출하기 위함
  const handleSubmitRef = useRef<() => Promise<void>>(async () => {});

  // 키보드 단축키
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (showLoginPrompt || exitModal) return;
      if ((e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'TEXTAREA') return;
      // timed 모드: 이전 이동 불가
      if (e.key === 'ArrowLeft' && !isTimed && currentIndex > 0) {
        if (autoAdvanceTimer.current) clearTimeout(autoAdvanceTimer.current);
        setCurrentIndex((i) => i - 1);
      } else if (e.key === 'ArrowRight' && currentIndex < questions.length - 1) {
        if (autoAdvanceTimer.current) clearTimeout(autoAdvanceTimer.current);
        setCurrentIndex((i) => i + 1);
      } else if (['1', '2', '3', '4'].includes(e.key)) {
        const questionId = questions[currentIndex].id;
        const visualIdx = parseInt(e.key) - 1;
        const idx = visualToOrig(questionId, visualIdx);
        setAnswers((prev) => {
          const existing = prev.findIndex((a) => a.questionId === questionId);
          if (existing !== -1) {
            const next = [...prev];
            next[existing] = { questionId, selected: idx };
            return next;
          }
          return [...prev, { questionId, selected: idx }];
        });
        if (autoAdvanceTimer.current) clearTimeout(autoAdvanceTimer.current);
        if (isTimed && currentIndex === questions.length - 1) {
          autoAdvanceTimer.current = setTimeout(() => void handleSubmitRef.current(), 600);
        } else if (autoAdvance && currentIndex < questions.length - 1) {
          autoAdvanceTimer.current = setTimeout(() => setCurrentIndex((i) => i + 1), 500);
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [showLoginPrompt, exitModal, currentIndex, questions, autoAdvance, isTimed, visualToOrig]);

  // 퀴즈 URL 저장
  useEffect(() => {
    quizUrlRef.current = window.location.href;
  }, []);

  // 퀴즈 풀이 중 상태 (친구 패널용) — 비로그인(initialPoints === null)이면 401만 나므로 건너뜀
  useEffect(() => {
    if (initialPoints === null) return;
    void fetch('/api/me/quiz-status', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isPlayingQuiz: true }),
    }).catch(() => {});
    return () => {
      void fetch('/api/me/quiz-status', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isPlayingQuiz: false }),
      }).catch(() => {});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const progressKey = `quiz-progress-${category}-${questions[0]?.id ?? ''}`;

  // 문제별 타이머 (단일 effect — race condition 방지)
  useEffect(() => {
    if (!isTimed) return;

    let remaining = QUESTION_SECONDS;
    setTimeLeft(remaining);

    const id = setInterval(() => {
      remaining--;
      setTimeLeft(remaining);
      if (remaining <= 0) {
        clearInterval(id);
        setCurrentIndex((prev) => {
          if (prev < questions.length - 1) return prev + 1;
          // 마지막 문제 시간 만료 → 자동 제출
          setTimeout(() => void handleSubmitRef.current(), 0);
          return prev;
        });
      }
    }, 1000);

    return () => clearInterval(id);
  }, [currentIndex, isTimed, questions.length]);

  // 자동 이동 설정 복원
  useEffect(() => {
    const saved = localStorage.getItem('quiz-auto-advance');
    if (saved !== null) setAutoAdvance(saved === 'true');
  }, []);

  // 진행 상태 복원
  useEffect(() => {
    // timed 모드에서는 로컬 저장 복원 안 함
    if (isTimed) return;
    const raw = localStorage.getItem(progressKey);
    if (!raw) return;
    try {
      const saved = JSON.parse(raw) as { questionIds: string[]; answers: UserAnswer[]; currentIndex: number };
      const ids = questions.map((q) => q.id).join(',');
      if (saved.questionIds.join(',') !== ids) {
        localStorage.removeItem(progressKey);
        return;
      }
      setAnswers(saved.answers);
      setCurrentIndex(saved.currentIndex);
    } catch {
      localStorage.removeItem(progressKey);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 진행 상태 저장
  useEffect(() => {
    if (isTimed || answers.length === 0) return;
    localStorage.setItem(progressKey, JSON.stringify({
      questionIds: questions.map((q) => q.id),
      answers,
      currentIndex,
    }));
  }, [answers, currentIndex, progressKey, questions, isTimed]);

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

  // 첫 답변 시 guard 엔트리 push
  useEffect(() => {
    if (answers.length === 1 && !guardPushedRef.current) {
      guardPushedRef.current = true;
      history.pushState({ ...history.state, __quizGuard: true }, '', quizUrlRef.current);
    }
  }, [answers.length]);

  // 브라우저 뒤로가기 guard
  useEffect(() => {
    const handlePopState = (e: PopStateEvent) => {
      if (allowNavRef.current) {
        allowNavRef.current = false;
        return;
      }
      if (!isDirty) return;
      if (!(e.state as Record<string, unknown> | null)?.__quizGuard) {
        history.pushState({ ...history.state, __quizGuard: true }, '', quizUrlRef.current);
        setExitModal({ url: null, isBack: true });
      }
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [isDirty]);

  function handleExitConfirm() {
    setExitModal(null);
    if (exitModal?.isBack) {
      allowNavRef.current = true;
      history.go(-2);
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

    if (isTimed && currentIndex === questions.length - 1) {
      // 마지막 문제 선택 → 600ms 후 자동 제출
      autoAdvanceTimer.current = setTimeout(() => void handleSubmitRef.current(), 600);
    } else if (autoAdvance && currentIndex < questions.length - 1) {
      autoAdvanceTimer.current = setTimeout(() => {
        setCurrentIndex((i) => i + 1);
      }, 500);
    }
  }

  async function applyHint(questionId: string): Promise<void> {
    if (points < 20 || hints[questionId] !== undefined || hintPending) return;
    setHintPending(true);
    try {
      const res = await fetch('/api/quiz/hint', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questionId }),
      });
      if (!res.ok) return;
      const { eliminateIndex, newPoints } = await res.json() as { eliminateIndex: number; newPoints: number };
      setHints((h) => ({ ...h, [questionId]: eliminateIndex }));
      setPoints(newPoints);
    } finally {
      setHintPending(false);
    }
  }

  async function toggleBookmark(questionId: string): Promise<void> {
    const prev = bookmarks[questionId] ?? false;
    setBookmarks((b) => ({ ...b, [questionId]: !prev }));
    try {
      const res = await fetch(`/api/questions/${questionId}/like`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json() as { liked: boolean };
        setBookmarks((b) => ({ ...b, [questionId]: data.liked }));
      } else {
        setBookmarks((b) => ({ ...b, [questionId]: prev }));
      }
    } catch {
      setBookmarks((b) => ({ ...b, [questionId]: prev }));
    }
  }

  async function handleSubmit(): Promise<void> {
    if (isSubmittingRef.current || isSubmitting) return;
    isSubmittingRef.current = true;
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/quiz/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category,
          questionIds: questions.map((q) => q.id),
          answers,
          mode,
        }),
      });
      if (res.status === 401) {
        setShowLoginPrompt(true);
        setIsSubmitting(false);
        return;
      }
      if (res.status === 429) {
        toast.error("퀴즈 제출이 너무 잦습니다. 잠시 후 다시 시도하세요.");
        setIsSubmitting(false);
        return;
      }
      if (!res.ok) {
        router.replace("/");
        return;
      }
      const { sessionId, pointsEarned, xpEarned } = await res.json() as { sessionId: string; pointsEarned?: number; xpEarned?: number };
      localStorage.removeItem(progressKey);
      if (pointsEarned) {
        sessionStorage.setItem(`points-earned-${sessionId}`, String(pointsEarned));
      }
      if (xpEarned) {
        sessionStorage.setItem(`xp-earned-${sessionId}`, String(xpEarned));
      }
      router.push(`/result/${sessionId}`);
    } catch (e) {
      console.error("[QuizPlay] submit failed:", e);
      router.replace("/");
    } finally {
      isSubmittingRef.current = false;
      setIsSubmitting(false);
    }
  }

  // ref 항상 최신으로 유지
  handleSubmitRef.current = handleSubmit;

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

  const timerColor =
    timeLeft === null ? '' :
    timeLeft <= 5 ? 'text-red-400 border-red-800/60 bg-red-950/20 animate-pulse' :
    timeLeft <= 8 ? 'text-yellow-400 border-yellow-800/60 bg-yellow-950/20' :
    'text-neutral-400 border-neutral-800';

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
            {!isTimed && (
              <button
                onClick={() => {
                  const next = !autoAdvance;
                  setAutoAdvance(next);
                  localStorage.setItem('quiz-auto-advance', String(next));
                }}
                title={autoAdvance ? '자동 이동 켜짐 (클릭하면 끔)' : '자동 이동 꺼짐 (클릭하면 켬)'}
                className={`text-[10px] border rounded px-1.5 py-0.5 transition-colors ${
                  autoAdvance
                    ? 'border-emerald-800/60 text-emerald-500 bg-emerald-950/30'
                    : 'border-neutral-800 text-neutral-600 hover:border-neutral-600 hover:text-neutral-400'
                }`}
              >
                자동이동
              </button>
            )}
            {isTimed && timeLeft !== null && (
              <span className={`text-[10px] border rounded px-1.5 py-0.5 font-mono tabular-nums min-w-[42px] text-center ${timerColor}`}>
                ⏱ {timeLeft}s
              </span>
            )}
          </div>
        </div>
        <ProgressBar answered={answers.length} total={questions.length} />
      </div>

      {/* 문제 카드 — 보기 순서는 optionOrders에 따라 셔플 */}
      <QuizCard
        questionNumber={currentIndex + 1}
        total={questions.length}
        category={current.category}
        question={current.question}
        options={(optionOrders[current.id] ?? [0, 1, 2, 3]).map((i) => current.options[i]) as [string, string, string, string]}
        selectedIndex={selectedIndex === null ? null : origToVisual(current.id, selectedIndex)}
        onSelect={(visualIdx) => handleSelect(current.id, visualToOrig(current.id, visualIdx))}
        questionId={current.id}
        authorNickname={current.authorNickname}
        eliminatedIndex={hints[current.id] !== undefined ? origToVisual(current.id, hints[current.id]) : null}
      />

      {/* 북마크 + 힌트 버튼 */}
      <div className="flex items-center justify-between mt-2 mb-1">
        <button
          onClick={() => toggleBookmark(current.id)}
          className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md border transition-colors ${
            bookmarks[current.id]
              ? 'border-yellow-500/50 bg-yellow-500/10 text-yellow-400'
              : 'border-neutral-800 text-neutral-500 hover:border-neutral-600 hover:text-neutral-300'
          }`}
        >
          <svg width={13} height={13} viewBox="0 0 24 24" fill={bookmarks[current.id] ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0z" />
          </svg>
          {bookmarks[current.id] ? '북마크됨' : '북마크'}
        </button>
        {initialPoints !== null && (
          hints[current.id] !== undefined ? (
            <span className="text-[10px] text-amber-500/70 border border-amber-900/40 rounded px-2 py-0.5">
              힌트 사용됨 · {points}P 남음
            </span>
          ) : (
            <button
              onClick={() => void applyHint(current.id)}
              disabled={points < 20 || hintPending}
              title={points < 20 ? `포인트 부족 (${points}P)` : '오답 1개를 제거합니다 (-20P)'}
              className="flex items-center gap-1 text-[10px] border border-neutral-800 text-neutral-500 rounded px-2 py-0.5 hover:border-neutral-600 hover:text-amber-400 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              💡 힌트 (-20P) · {points}P
            </button>
          )
        )}
      </div>

      {/* 하단 고정 영역 */}
      <div className="sticky bottom-0 bg-[#0a0a0a]/95 backdrop-blur border-t border-neutral-800/60 py-3 mt-4">
        {/* Navigator */}
        <div className="mb-3 overflow-x-auto pb-1">
          <Navigator
            total={questions.length}
            currentIndex={currentIndex}
            answeredIndices={answeredIndices}
            lockedBefore={isTimed ? currentIndex : 0}
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
            disabled={currentIndex === 0 || isTimed}
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
            {!isTimed && (
              <button
                onClick={handleSubmit}
                disabled={!allAnswered || isSubmitting}
                className="rounded-lg bg-white text-black text-sm font-semibold px-5 py-2 hover:bg-neutral-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                {isSubmitting ? '제출 중...' : allAnswered ? '제출' : `${unanswered}개 남음`}
              </button>
            )}
            {isTimed && (
              <button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="rounded-lg bg-white text-black text-sm font-semibold px-5 py-2 hover:bg-neutral-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                {isSubmitting ? '제출 중...' : '지금 제출'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
