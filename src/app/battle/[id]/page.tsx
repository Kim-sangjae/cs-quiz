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
const TIMEOUT_SECS = 15;

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
  quitRequestBy?: string | null;
  question?: { id: string; question: string; options: string[] };
  questions?: { question: string; options: string[]; answer: number; explanation: string }[];
  hostAnswers?: number[];
  guestAnswers?: number[];
}

export default function BattleRoomPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { status } = useSession();
  const router = useRouter();
  const queryClient = useQueryClient();

  const hadWaiting = useRef(false);
  const [wasRejected, setWasRejected] = useState(false);
  const hasAutoSubmittedRef = useRef(false);

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
  const lastCurrentQ = useRef<number | null>(null);

  const { data: room, isLoading, isError } = useQuery<RoomState>({
    queryKey: ['battle', id],
    queryFn: () => fetch(`/api/battle/rooms/${id}`).then(async (r) => {
      if (!r.ok) throw new Error('Not found');
      return r.json() as Promise<RoomState>;
    }),
    enabled: status === 'authenticated',
    refetchInterval: (q) => (q.state.data?.status === 'FINISHED' ? false : 3000),
    retry: false,
  });

  useEffect(() => {
    if (room?.status === 'WAITING' && room.myRole === 'host') hadWaiting.current = true;
  }, [room?.status, room?.myRole]);

  useEffect(() => {
    if (isError && hadWaiting.current) {
      setWasRejected(true);
      fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'BATTLE_REJECTED' }),
      }).then(() => queryClient.invalidateQueries({ queryKey: ['notifications'] })).catch(() => {});
    }
  }, [isError, queryClient]);

  // question 변경 시 타이머 + 자동제출 플래그 리셋
  useEffect(() => {
    if (room?.status !== 'PLAYING') return;
    if (lastCurrentQ.current !== room.currentQ) {
      lastCurrentQ.current = room.currentQ ?? null;
      hasAutoSubmittedRef.current = false;
      setTimeLeft(TIMEOUT_SECS);
    }
  }, [room?.currentQ, room?.status]);

  const myAnswered = room?.myRole === 'host' ? room?.hostAnswered : room?.guestAnswered;

  // 카운트다운
  useEffect(() => {
    if (room?.status !== 'PLAYING' || myAnswered) return;
    if (timeLeft <= 0) return; // submitAnswer.mutate(-1) 아래 effect에서 처리
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
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['battle', id] }),
    onError: (e: Error) => toast.error(e.message),
  });

  // 시간 초과 자동 제출 (ref로 중복 방지)
  useEffect(() => {
    if (room?.status !== 'PLAYING' || myAnswered || timeLeft > 0 || hasAutoSubmittedRef.current) return;
    hasAutoSubmittedRef.current = true;
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

  const timerColor =
    timeLeft <= 3 ? 'text-red-400' : timeLeft <= 7 ? 'text-yellow-400' : 'text-emerald-400';

  return (
    <main className="max-w-2xl mx-auto px-4 sm:px-6 py-10">
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => router.back()}
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
            <>
              <p className="text-sm text-neutral-400 mb-2">{oppNickname}님을 기다리는 중...</p>
              <p className="text-xs text-neutral-600 mb-4">상대방이 알림에서 대전을 수락하면 시작됩니다</p>
              <div className="flex justify-center gap-1">
                {[0, 1, 2].map((i) => (
                  <span key={i} className="w-1.5 h-1.5 rounded-full bg-neutral-600 animate-pulse" style={{ animationDelay: `${i * 150}ms` }} />
                ))}
              </div>
            </>
          ) : (
            <>
              <p className="text-sm text-white mb-1">{room.host.nickname}님의 대전 신청</p>
              <p className="text-xs text-neutral-500 mb-5">카테고리: {CATEGORY_LABEL[room.category] ?? room.category}</p>
              <button
                onClick={() => joinRoom.mutate()}
                disabled={joinRoom.isPending}
                className="rounded-md bg-white text-black text-sm font-medium px-6 py-2.5 hover:bg-neutral-200 transition-colors disabled:opacity-50"
              >
                {joinRoom.isPending ? '수락 중...' : '대전 수락하기'}
              </button>
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
              {myAnswered ? (
                <p className="text-xs text-neutral-600">대기 중</p>
              ) : (
                <p className={`text-lg font-bold tabular-nums ${timerColor}`}>{timeLeft}</p>
              )}
            </div>
            <div className="text-center">
              <p className="text-xs text-neutral-500 mb-0.5">{oppNickname}</p>
              <p className="text-2xl font-bold text-white">{oppScore}</p>
            </div>
          </div>

          {/* 문제 */}
          <div className="bg-[#111111] border border-neutral-800 rounded-xl p-5">
            <p className="text-sm text-white leading-relaxed mb-4">{room.question.question}</p>
            <div className="space-y-2">
              {(room.question.options as string[]).map((opt, i) => {
                let cls = 'w-full text-left rounded-md border px-4 py-2.5 text-sm flex items-start gap-3 transition-colors ';
                if (myAnswered) {
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
                    onClick={() => !myAnswered && !submitAnswer.isPending && submitAnswer.mutate(i)}
                    disabled={!!myAnswered || submitAnswer.isPending}
                  >
                    <span className="text-xs font-mono opacity-70 flex-shrink-0 mt-0.5">{LABELS[i]}.</span>
                    <span>{opt}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {myAnswered && room.question && (
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
              {myAnswered ? (
                <p className="text-xs text-neutral-500">
                  {(room.myRole === 'host' ? room.guestAnswered : room.hostAnswered)
                    ? '다음 문제로 이동 중...'
                    : `${oppNickname}님 답변 대기 중...`}
                </p>
              ) : (
                <p className="text-xs text-neutral-600">답변을 선택하세요 (제한 시간 {TIMEOUT_SECS}초)</p>
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
