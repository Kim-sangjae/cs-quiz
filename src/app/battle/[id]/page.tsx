'use client';

import { use, useEffect, useRef, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

const CATEGORY_LABEL: Record<string, string> = {
  all: '전체', ds: '자료구조', algo: '알고리즘', os: '운영체제',
  network: '네트워크', db: '데이터베이스', arch: '컴퓨터 구조',
};

const LABELS = ['A', 'B', 'C', 'D'] as const;
const TIMEOUT_SECS = 20;

interface RoomState {
  id: string;
  status: 'WAITING' | 'PLAYING' | 'FINISHED';
  category: string;
  myRole: 'host' | 'guest';
  host: { id: string; nickname: string | null };
  guest: { id: string; nickname: string | null } | null;
  currentQ?: number;
  totalQ?: number;
  hostScore?: number;
  guestScore?: number;
  hostAnswered?: boolean;
  guestAnswered?: boolean;
  mySelected?: number | null;
  myPrevAnswers?: number[];
  quitRequestBy?: string | null;
  question?: { id: string; question: string; options: string[] };
  questions?: { question: string; options: string[]; answer: number; explanation: string }[];
  hostAnswers?: number[];
  guestAnswers?: number[];
  createdAt?: string;
  questionStartedAt?: string | null;
  consecutiveAllSkip?: number;
  isVoid?: boolean;
}

export default function BattleRoomPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { status } = useSession();
  const router = useRouter();
  const queryClient = useQueryClient();

  const hadWaiting = useRef(false);
  const [wasRejected, setWasRejected] = useState(false);
  const [waitTimedOut, setWaitTimedOut] = useState(false);
  const [waitCountdown, setWaitCountdown] = useState(20);
  const [isAutoMode, setIsAutoMode] = useState(false);
  const hasAutoSubmittedRef = useRef(false);
  const waitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoModeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastQuestionStartedAt = useRef<string | null>(null);
  // 유저가 직접 dismiss했을 때 auto-mode 재진입 방지
  const manualDismissedAutoModeRef = useRef(false);
  // 재진입 시 auto-mode 복원은 최초 1회만
  const hasRestoredAutoModeRef = useRef(false);

  const [bookmarks, setBookmarks] = useState<Record<string, boolean>>({});

  async function toggleBookmark(questionId: string) {
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

  // 15초 카운트다운
  const [timeLeft, setTimeLeft] = useState(TIMEOUT_SECS);

  const { data: room, isLoading, isError, error } = useQuery<RoomState>({
    queryKey: ['battle', id],
    queryFn: () => fetch(`/api/battle/rooms/${id}`).then(async (r) => {
      if (!r.ok) {
        const body = await r.json().catch(() => ({})) as { error?: string };
        throw new Error(body.error ?? 'Not found');
      }
      return r.json() as Promise<RoomState>;
    }),
    enabled: status === 'authenticated',
    refetchInterval: (q) => (q.state.data?.status === 'FINISHED' ? false : 1500),
    retry: false,
  });

  useEffect(() => {
    if (room?.status === 'WAITING' && room.myRole === 'host') hadWaiting.current = true;
  }, [room?.status, room?.myRole]);

  // WAITING 카운트다운 (createdAt 기준, 양쪽 모두)
  const waitCreatedAt = room?.status === 'WAITING' ? room.createdAt : undefined;
  useEffect(() => {
    if (!waitCreatedAt) return;
    function tick() {
      const elapsed = Math.floor((Date.now() - new Date(waitCreatedAt!).getTime()) / 1000);
      setWaitCountdown(Math.max(0, 20 - elapsed));
    }
    tick();
    const tid = setInterval(tick, 1000);
    return () => clearInterval(tid);
  }, [waitCreatedAt]);

  // 20초 대기 타임아웃 (host만) — cancel API 호출
  useEffect(() => {
    if (room?.status !== 'WAITING' || room?.myRole !== 'host') return;
    waitTimerRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/battle/rooms/${id}/cancel`, { method: 'POST' });
        if (res.ok) setWaitTimedOut(true);
      } catch { /* ignore */ }
    }, 20000);
    return () => { if (waitTimerRef.current) clearTimeout(waitTimerRef.current); };
  }, [id, room?.status, room?.myRole]);

  // PLAYING 중 이탈방지 (beforeunload)
  useEffect(() => {
    if (room?.status !== 'PLAYING') return;
    function handleBeforeUnload(e: BeforeUnloadEvent) {
      e.preventDefault();
    }
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [room?.status]);

  // PLAYING 중 브라우저 뒤로가기(popstate) 차단
  const isPlaying = room?.status === 'PLAYING';
  useEffect(() => {
    if (!isPlaying) return;
    window.history.pushState(null, '', window.location.href);
    function handlePopState() {
      window.history.pushState(null, '', window.location.href);
      if (confirm('대결이 진행 중입니다. 정말 나가시겠습니까?')) {
        router.back();
      }
    }
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [isPlaying, router]);

  // PLAYING 중 헤더/탭 링크 클릭 이탈방지
  useEffect(() => {
    if (!isPlaying) return;
    function handleNavClick(e: MouseEvent) {
      const target = e.target as HTMLElement;
      const anchor = target.closest('a[href]');
      if (!anchor) return;
      const href = anchor.getAttribute('href') ?? '';
      if (!href || href.startsWith('#') || href === window.location.pathname) return;
      e.preventDefault();
      e.stopPropagation();
      if (confirm('대결이 진행 중입니다. 정말 나가시겠습니까?')) {
        window.location.assign(href);
      }
    }
    document.addEventListener('click', handleNavClick, true);
    return () => document.removeEventListener('click', handleNavClick, true);
  }, [isPlaying]);

  useEffect(() => {
    if (!isError || !hadWaiting.current) return;
    const msg = (error as Error | null)?.message ?? '';
    if (msg === 'waiting_timeout') {
      setWaitTimedOut(true);
    } else {
      setWasRejected(true);
      fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'BATTLE_REJECTED' }),
      }).then(() => queryClient.invalidateQueries({ queryKey: ['notifications'] })).catch(() => {});
    }
  }, [isError, error, queryClient]);

  // 이 문제의 유효 타임아웃: 이전 턴이 쌍방 스킵이면 5초, 아니면 15초
  const effectiveTimeoutSecs = (room?.consecutiveAllSkip ?? 0) >= 1 ? 5 : TIMEOUT_SECS;

  // questionStartedAt 또는 consecutiveAllSkip 변경 시 타이머 재동기화
  // consecutiveAllSkip만 바뀌어도(첫 폴링 지연으로 stale한 경우) 5s로 재설정
  useEffect(() => {
    if (room?.status !== 'PLAYING') return;
    const qsa = room.questionStartedAt;
    if (!qsa) return;
    const isNewQuestion = qsa !== lastQuestionStartedAt.current;
    if (isNewQuestion) {
      lastQuestionStartedAt.current = qsa;
      hasAutoSubmittedRef.current = false;
      if (autoModeTimerRef.current) clearTimeout(autoModeTimerRef.current);
    }
    const effectiveSecs = (room.consecutiveAllSkip ?? 0) >= 1 ? 5 : TIMEOUT_SECS;
    const serverElapsed = Math.floor((Date.now() - new Date(qsa).getTime()) / 1000);
    setTimeLeft(Math.max(0, effectiveSecs - serverElapsed));
  }, [room?.questionStartedAt, room?.status, room?.consecutiveAllSkip]);

  const myAnswered = room?.myRole === 'host' ? room?.hostAnswered : room?.guestAnswered;
  const isAutoSubmitted = myAnswered && room?.mySelected === -1;

  // 자동응답 발생 시 자동모드 진입 (유저가 dismiss하지 않은 경우만)
  useEffect(() => {
    if (isAutoSubmitted && !isAutoMode && !manualDismissedAutoModeRef.current) setIsAutoMode(true);
  }, [isAutoSubmitted, isAutoMode]);

  // 5초 모드(consecutiveAllSkip>=1)에서는 답변 이력 무관하게 양쪽 모두 즉시 auto-mode 진입
  // questionStartedAt/consecutiveAllSkip 변경 시에만 발동 → 유저 dismiss는 현재 문제 내에서 유지됨
  useEffect(() => {
    if (room?.status !== 'PLAYING' || myAnswered) return;
    if ((room.consecutiveAllSkip ?? 0) >= 1) setIsAutoMode(true);
  }, [room?.questionStartedAt, room?.consecutiveAllSkip, room?.status, myAnswered]); // eslint-disable-line react-hooks/exhaustive-deps

  // 재진입 시 자동모드 복원 — 마운트 후 room 첫 도착 시 1회만
  // deps를 room 전체로 두고 hasRestoredAutoModeRef로 1회 실행 보장
  // (myPrevAnswers 단독 deps는 isAutoMode 체크 때문에 ref를 못 세팅해 매 문제 재진입)
  useEffect(() => {
    if (hasRestoredAutoModeRef.current) return;
    if (!room || room.status !== 'PLAYING') return;
    hasRestoredAutoModeRef.current = true; // isAutoMode 상태와 무관하게 항상 세팅
    if ((room.myPrevAnswers?.includes(-1) ?? false) || room.mySelected === -1) {
      setIsAutoMode(true);
    }
  }, [room]); // eslint-disable-line react-hooks/exhaustive-deps

  // 자동모드: questionStartedAt 기준 절대 시각으로 양쪽 동시 자동제출
  // 일반(20s): +3s 기준 / 5초 모드: +5s (서버 타임아웃과 동일) → 폴링 타이밍 무관하게 동시 발동
  useEffect(() => {
    if (!isAutoMode || room?.status !== 'PLAYING' || myAnswered) return;
    const questionId = room.question?.id;
    const qsa = room.questionStartedAt;
    if (!questionId || !qsa) return;
    const isSkipMode = (room.consecutiveAllSkip ?? 0) >= 1;
    const targetTime = new Date(qsa).getTime() + (isSkipMode ? 5000 : 3000);
    const delayMs = Math.max(isSkipMode ? 50 : 2000, targetTime - Date.now());
    autoModeTimerRef.current = setTimeout(() => {
      if (!hasAutoSubmittedRef.current) {
        hasAutoSubmittedRef.current = true;
        submitAnswer.mutate(-1);
      }
    }, delayMs);
    return () => { if (autoModeTimerRef.current) clearTimeout(autoModeTimerRef.current); };
  }, [isAutoMode, room?.question?.id, myAnswered, room?.status, room?.questionStartedAt, room?.consecutiveAllSkip]); // eslint-disable-line react-hooks/exhaustive-deps

  // 카운트다운 (자동응답 상태면 중지)
  useEffect(() => {
    if (room?.status !== 'PLAYING' || myAnswered) return;
    if (timeLeft <= 0) return;
    const tid = setTimeout(() => setTimeLeft((t) => t - 1), 1000);
    return () => clearTimeout(tid);
  }, [timeLeft, room?.status, myAnswered]);

  const submitAnswer = useMutation({
    mutationFn: (selected: number) =>
      fetch(`/api/battle/rooms/${id}/answer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ selected }),
      }).then(async (r) => {
        const data = await r.json() as { correct?: boolean; error?: string };
        if (!r.ok && data.error !== '이미 답변했습니다') throw new Error(data.error ?? '오류가 발생했습니다');
        return data;
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['battle', id] });
      // 첫 refetch가 stale할 수 있어(상대방 answer 미처리) 다단계 재폴링
      for (const ms of [300, 700, 1200]) {
        setTimeout(() => void queryClient.invalidateQueries({ queryKey: ['battle', id] }), ms);
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // 시간 초과 클라이언트 자동제출 — 동시에 자동모드 즉시 진입 (blur 즉시 표시)
  useEffect(() => {
    if (room?.status !== 'PLAYING' || myAnswered || timeLeft > 0 || hasAutoSubmittedRef.current) return;
    hasAutoSubmittedRef.current = true;
    if (!manualDismissedAutoModeRef.current) setIsAutoMode(true);
    submitAnswer.mutate(-1);
  }, [timeLeft, room?.status, myAnswered]); // eslint-disable-line react-hooks/exhaustive-deps

  const quitAction = useMutation({
    mutationFn: (action: 'request' | 'accept' | 'reject') =>
      fetch(`/api/battle/rooms/${id}/quit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      }).then((r) => r.json()),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['battle', id] }),
    onError: () => toast.error('오류가 발생했습니다'),
  });

  const joinRoom = useMutation({
    mutationFn: () =>
      fetch(`/api/battle/rooms/${id}/join`, { method: 'POST' }).then(async (r) => {
        if (!r.ok) throw new Error('오류가 발생했습니다');
        return r.json();
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['battle', id] }),
    onError: () => toast.error('오류가 발생했습니다'),
  });

  if (status === 'loading' || isLoading) return null;

  if (wasRejected) {
    return (
      <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" />
        <div className="relative w-full max-w-xs bg-[#111111] border border-neutral-700 rounded-2xl shadow-2xl overflow-hidden">
          <div className="flex flex-col items-center pt-7 pb-5 px-6 text-center">
            <div className="w-12 h-12 rounded-full bg-neutral-800 border border-neutral-700 flex items-center justify-center mb-3">
              <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="text-neutral-400">
                <circle cx="12" cy="12" r="10" /><path d="M15 9l-6 6M9 9l6 6" />
              </svg>
            </div>
            <p className="text-sm font-semibold text-white mb-1">대전 거절됨</p>
            <p className="text-sm text-neutral-400">상대방이 대전 신청을<br />거절하였습니다</p>
          </div>
          <div className="border-t border-neutral-800">
            <button
              onClick={() => router.back()}
              className="w-full py-3.5 text-sm font-semibold text-white hover:bg-neutral-800/50 transition-colors"
            >
              확인
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (waitTimedOut && !room) {
    return (
      <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" />
        <div className="relative w-full max-w-xs bg-[#111111] border border-neutral-700 rounded-2xl shadow-2xl overflow-hidden">
          <div className="flex flex-col items-center pt-7 pb-5 px-6 text-center">
            <div className="w-12 h-12 rounded-full bg-neutral-800 border border-neutral-700 flex items-center justify-center mb-3">
              <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="text-neutral-400">
                <circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" />
              </svg>
            </div>
            <p className="text-sm font-semibold text-white mb-1">응답 없음</p>
            <p className="text-sm text-neutral-400">상대방이 시간 내에 응답하지 않아<br />대전이 자동으로 취소되었습니다</p>
          </div>
          <div className="border-t border-neutral-800">
            <button
              onClick={() => router.back()}
              className="w-full py-3.5 text-sm font-semibold text-white hover:bg-neutral-800/50 transition-colors"
            >
              확인
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!room) {
    return (
      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-12">
        <p className="text-sm text-neutral-500">대전을 찾을 수 없습니다.</p>
      </main>
    );
  }

  const myScore = room.myRole === 'host' ? (room.hostScore ?? 0) : (room.guestScore ?? 0);
  const oppScore = room.myRole === 'host' ? (room.guestScore ?? 0) : (room.hostScore ?? 0);
  const oppNickname = room.myRole === 'host' ? (room.guest?.nickname ?? '?') : (room.host.nickname ?? '?');
  const myAnswers = room.myRole === 'host' ? (room.hostAnswers ?? []) : (room.guestAnswers ?? []);
  const oppAnswers = room.myRole === 'host' ? (room.guestAnswers ?? []) : (room.hostAnswers ?? []);

  const isVoid = room.status === 'FINISHED' && !!room.isVoid;

  const timerColor =
    timeLeft <= (effectiveTimeoutSecs <= 5 ? 2 : 3)
      ? 'text-red-400'
      : timeLeft <= (effectiveTimeoutSecs <= 5 ? 3 : 7)
        ? 'text-yellow-400'
        : 'text-emerald-400';

  return (
    <main className="max-w-2xl mx-auto px-4 sm:px-6 py-10">
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => {
            if (room?.status === 'PLAYING') {
              if (!confirm('대결이 진행 중입니다. 정말 나가시겠습니까?')) return;
            }
            router.back();
          }}
          className="text-xs text-neutral-500 hover:text-neutral-300 transition-colors"
        >
          ← 뒤로
        </button>
        <span className="text-xs text-neutral-600 border border-neutral-800 rounded px-2 py-0.5">
          {CATEGORY_LABEL[room.category] ?? room.category}
        </span>
      </div>

      {/* WAITING */}
      {room.status === 'WAITING' && (
        <div className="bg-[#111111] border border-neutral-800 rounded-xl p-6 text-center">
          {room.myRole === 'host' ? (
            waitTimedOut ? (
              <>
                <p className="text-sm text-white mb-1">상대방의 응답이 없습니다</p>
                <p className="text-xs text-neutral-500 mb-4">대전 요청이 자동으로 취소되었습니다</p>
                <button
                  onClick={() => router.back()}
                  className="rounded-md border border-neutral-700 text-xs text-neutral-400 px-4 py-2 hover:border-neutral-500 hover:text-white transition-colors"
                >
                  확인
                </button>
              </>
            ) : (
              <>
                <p className="text-sm text-neutral-400 mb-2">{oppNickname}님을 기다리는 중...</p>
                <p className={`text-sm font-semibold tabular-nums mb-4 ${waitCountdown <= 5 ? 'text-red-400' : 'text-neutral-400'}`}>
                  {waitCountdown}초 후 자동 취소
                </p>
                <div className="flex justify-center gap-1">
                  {[0, 1, 2].map((i) => (
                    <span key={i} className="w-1.5 h-1.5 rounded-full bg-neutral-600 animate-pulse" style={{ animationDelay: `${i * 150}ms` }} />
                  ))}
                </div>
              </>
            )
          ) : (
            <>
              <p className="text-sm text-white mb-1">{room.host.nickname}님의 대전 신청</p>
              <p className="text-xs text-neutral-500 mb-4">카테고리: {CATEGORY_LABEL[room.category] ?? room.category}</p>
              <button
                onClick={() => joinRoom.mutate()}
                disabled={joinRoom.isPending}
                className="rounded-md bg-white text-black text-sm font-medium px-6 py-2.5 hover:bg-neutral-200 transition-colors disabled:opacity-50"
              >
                {joinRoom.isPending ? '수락 중...' : '대전 수락하기'}
              </button>
              <p className={`text-sm font-semibold tabular-nums mt-3 ${waitCountdown <= 5 ? 'text-red-400' : 'text-neutral-400'}`}>
                {waitCountdown}초 후 요청이 취소됩니다
              </p>
            </>
          )}
        </div>
      )}

      {/* PLAYING */}
      {room.status === 'PLAYING' && room.question && (
        <>
          {/* 상대방이 중단 요청 → 동의 모달 */}
          {room.quitRequestBy && room.quitRequestBy !== room.myRole && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px]" />
              <div className="relative w-full max-w-xs bg-[#111111] border border-neutral-700 rounded-2xl shadow-2xl overflow-hidden">
                <div className="px-6 pt-6 pb-4 text-center">
                  <p className="text-sm font-semibold text-white mb-1">대결 중단 요청</p>
                  <p className="text-sm text-neutral-400">{oppNickname}님이 대결 중단을 요청했습니다.<br />동의하시겠습니까?</p>
                </div>
                <div className="border-t border-neutral-800 flex">
                  <button
                    onClick={() => quitAction.mutate('reject')}
                    disabled={quitAction.isPending}
                    className="flex-1 py-3.5 text-sm text-neutral-400 hover:bg-neutral-800/50 transition-colors border-r border-neutral-800"
                  >
                    거절
                  </button>
                  <button
                    onClick={() => quitAction.mutate('accept')}
                    disabled={quitAction.isPending}
                    className="flex-1 py-3.5 text-sm font-semibold text-red-400 hover:bg-neutral-800/50 transition-colors"
                  >
                    동의
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 자동응답 배너 */}
          {isAutoSubmitted && !isAutoMode && (
            <div className="flex items-center gap-2 mb-3 px-3 py-2 bg-amber-500/10 border border-amber-500/20 rounded-lg">
              <span className="text-amber-400 text-xs">⚡</span>
              <p className="text-xs text-amber-400">자동응답됨 — 직접 선택하여 변경할 수 있습니다</p>
            </div>
          )}

          {/* 점수판 + 타이머 */}
          <div className="flex items-center justify-between mb-5 bg-[#111111] border border-neutral-800 rounded-xl px-5 py-3">
            <div className="text-center">
              <p className="text-xs text-neutral-500 mb-0.5">나</p>
              <p className="text-2xl font-bold text-white">{myScore}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-neutral-500 mb-0.5">
                {room.currentQ! + 1} / {room.totalQ}
              </p>
              {myAnswered && !isAutoSubmitted ? (
                <p className="text-xs text-neutral-600">대기 중</p>
              ) : isAutoSubmitted ? (
                <p className="text-xs text-amber-500">자동진행 중</p>
              ) : (
                <p className={`text-lg font-bold tabular-nums ${timerColor}`}>{timeLeft}</p>
              )}
            </div>
            <div className="text-center">
              <p className="text-xs text-neutral-500 mb-0.5">{oppNickname}</p>
              <p className="text-2xl font-bold text-white">{oppScore}</p>
            </div>
          </div>

          {/* 문제 (자동모드 시 블러 + 오버레이) */}
          <div className="relative">
            <div className={`bg-[#111111] border border-neutral-800 rounded-xl p-5${isAutoMode ? ' blur-sm pointer-events-none select-none' : ''}`}>
              <p className="text-sm text-white leading-relaxed mb-4">{room.question.question}</p>
              <div className="space-y-2">
                {(room.question.options as string[]).map((opt, i) => {
                  let cls = 'w-full text-left rounded-md border px-4 py-2.5 text-sm flex items-start gap-3 transition-colors ';
                  if (myAnswered && !isAutoSubmitted) {
                    cls += i === room.mySelected
                      ? 'border-neutral-500 bg-neutral-800/50 text-neutral-300 cursor-default'
                      : 'border-neutral-800 text-neutral-600 opacity-40 cursor-default';
                  } else {
                    cls += 'border-neutral-800 text-neutral-300 hover:border-neutral-600 hover:text-white cursor-pointer';
                  }
                  return (
                    <button
                      key={i}
                      className={cls}
                      onClick={() => {
                        if ((myAnswered && !isAutoSubmitted) || submitAnswer.isPending) return;
                        // 수동 답변 시 auto-mode dismiss 해제 (다음 문제부터 정상 타이머)
                        manualDismissedAutoModeRef.current = false;
                        setIsAutoMode(false);
                        if (autoModeTimerRef.current) clearTimeout(autoModeTimerRef.current);
                        submitAnswer.mutate(i);
                      }}
                      disabled={(myAnswered && !isAutoSubmitted) || submitAnswer.isPending}
                    >
                      <span className="text-xs font-mono opacity-70 flex-shrink-0 mt-0.5">{LABELS[i]}.</span>
                      <span>{opt}</span>
                    </button>
                  );
                })}
              </div>
            </div>
            {isAutoMode && (
              <button
                type="button"
                className="absolute inset-0 z-10 flex items-center justify-center rounded-xl w-full"
                onClick={() => {
                  setIsAutoMode(false);
                  manualDismissedAutoModeRef.current = true;
                  if (autoModeTimerRef.current) clearTimeout(autoModeTimerRef.current);
                  if (!myAnswered) hasAutoSubmittedRef.current = false;
                }}
              >
                <div className="bg-black/75 backdrop-blur-sm px-5 py-4 rounded-xl text-center border border-amber-500/30">
                  {myAnswered ? (
                    <>
                      <p className="text-sm font-semibold text-amber-400 mb-1">자동응답됨</p>
                      <p className="text-xs text-neutral-400">클릭하여 직접 변경하기</p>
                    </>
                  ) : (
                    <>
                      <p className="text-sm font-semibold text-amber-400 mb-1">자동진행 중</p>
                      <p className="text-xs text-neutral-400">클릭하여 직접 답변하기</p>
                    </>
                  )}
                </div>
              </button>
            )}
          </div>

          {myAnswered && !isAutoSubmitted && room.question && (
            <div className="flex justify-end mt-2">
              <button
                onClick={() => toggleBookmark(room.question!.id)}
                className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md border transition-colors ${
                  bookmarks[room.question.id]
                    ? 'border-yellow-500/50 bg-yellow-500/10 text-yellow-400'
                    : 'border-neutral-800 text-neutral-500 hover:border-neutral-600 hover:text-neutral-300'
                }`}
              >
                <svg width={13} height={13} viewBox="0 0 24 24" fill={bookmarks[room.question.id] ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0z" />
                </svg>
                {bookmarks[room.question.id] ? '북마크됨' : '북마크'}
              </button>
            </div>
          )}

          <div className="mt-3 flex items-center justify-between">
            <div className="text-center flex-1">
              {myAnswered && !isAutoSubmitted ? (
                <p className="text-xs text-neutral-500">
                  {(room.myRole === 'host' ? room.guestAnswered : room.hostAnswered)
                    ? '다음 문제로 이동 중...'
                    : `${oppNickname}님 답변 대기 중...`}
                </p>
              ) : isAutoSubmitted ? (
                <p className="text-xs text-amber-500/70">자동응답 — 답변을 선택하여 변경 가능</p>
              ) : (
                <p className="text-xs text-neutral-600">답변을 선택하세요 (제한 시간 {effectiveTimeoutSecs}초)</p>
              )}
            </div>
            <button
              onClick={() => quitAction.mutate('request')}
              disabled={quitAction.isPending}
              className="text-xs text-neutral-700 hover:text-red-400 border border-neutral-800 hover:border-red-500/30 rounded px-2.5 py-1 transition-colors"
            >
              {room.quitRequestBy === room.myRole ? '중단 요청 취소' : '대결 중단'}
            </button>
          </div>
        </>
      )}

      {/* FINISHED */}
      {room.status === 'FINISHED' && room.questions && (
        <>
          <div className="bg-[#111111] border border-neutral-800 rounded-xl p-6 text-center mb-6">
            {isVoid ? (
              <>
                <p className="text-xs text-neutral-500 mb-2">대결 결과</p>
                <p className="text-sm font-semibold text-neutral-400 mb-1">무효 처리</p>
                <p className="text-xs text-neutral-600">양측 모두 응답하지 않아 전적에 반영되지 않습니다</p>
              </>
            ) : (
              <>
                <p className="text-xs text-neutral-500 mb-2">최종 결과</p>
                <div className="flex items-center justify-center gap-6 mb-3">
                  <div>
                    <p className="text-xs text-neutral-500">나</p>
                    <p className="text-3xl font-bold text-white">{myScore}</p>
                  </div>
                  <p className="text-xl text-neutral-600">vs</p>
                  <div>
                    <p className="text-xs text-neutral-500">{oppNickname}</p>
                    <p className="text-3xl font-bold text-white">{oppScore}</p>
                  </div>
                </div>
                <p className={`text-sm font-medium ${
                  myScore > oppScore ? 'text-emerald-400' : myScore < oppScore ? 'text-red-400' : 'text-neutral-400'
                }`}>
                  {myScore > oppScore ? '승리!' : myScore < oppScore ? '패배' : '무승부'}
                </p>
              </>
            )}
          </div>

          <div className="space-y-3">
            {room.questions.map((q, qi) => {
              const myAns = myAnswers[qi];
              const oppAns = oppAnswers[qi];
              const isMyCorrect = myAns === q.answer;
              const isOppCorrect = oppAns === q.answer;
              return (
                <div key={qi} className="bg-[#111111] border border-neutral-800 rounded-xl p-4">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <p className="text-xs text-neutral-500">문제 {qi + 1}</p>
                    <div className="flex gap-2 text-xs">
                      <span className={isMyCorrect ? 'text-emerald-400' : 'text-red-400'}>
                        나: {myAns >= 0 ? LABELS[myAns] : '시간초과'} {isMyCorrect ? '✓' : '✗'}
                      </span>
                      <span className={isOppCorrect ? 'text-emerald-400' : 'text-red-400'}>
                        상대: {oppAns >= 0 ? LABELS[oppAns] : '시간초과'} {isOppCorrect ? '✓' : '✗'}
                      </span>
                    </div>
                  </div>
                  <p className="text-sm text-neutral-300 mb-1">{q.question}</p>
                  <p className="text-xs text-neutral-500">정답: {LABELS[q.answer]}</p>
                  <p className="text-xs text-neutral-500 mt-1 leading-relaxed">{q.explanation}</p>
                </div>
              );
            })}
          </div>

          <div className="mt-6">
            <button
              onClick={() => router.back()}
              className="w-full rounded-md border border-neutral-700 text-sm text-neutral-400 py-2.5 hover:border-neutral-500 hover:text-white transition-colors"
            >
              뒤로
            </button>
          </div>
        </>
      )}
    </main>
  );
}
