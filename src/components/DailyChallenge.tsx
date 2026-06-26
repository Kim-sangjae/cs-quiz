'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';

const CATEGORY_LABEL: Record<string, string> = {
  ds: '자료구조', algo: '알고리즘', os: '운영체제',
  network: '네트워크', db: '데이터베이스', arch: '컴퓨터 구조',
};

const LABELS = ['A', 'B', 'C', 'D'] as const;

interface DailyQuestion {
  date: string;
  id: string;
  category: string;
  question: string;
  options: string[];
  attemptCount: number;
  correctRate: number | null;
}

interface DailyResult {
  correct: boolean;
  answer: number;
  explanation: string;
  selected: number;
}

function storageKey(date: string) {
  return `daily-${date}`;
}

interface Participant {
  nickname: string;
  correct: boolean;
}

export default function DailyChallenge() {
  const { status } = useSession();
  const router = useRouter();
  const [q, setQ] = useState<DailyQuestion | null>(null);
  const [result, setResult] = useState<DailyResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showPanel, setShowPanel] = useState(false);
  const [participants, setParticipants] = useState<Participant[] | null>(null);
  const [panelLoading, setPanelLoading] = useState(false);

  const openParticipants = useCallback(async () => {
    if (status !== 'authenticated') { router.push('/auth/login'); return; }
    setShowPanel(true);
    if (participants !== null) return;
    setPanelLoading(true);
    try {
      const r = await fetch('/api/daily/participants');
      if (r.ok) setParticipants((await r.json() as { participants: Participant[] }).participants);
    } catch {}
    setPanelLoading(false);
  }, [status, router, participants]);

  useEffect(() => {
    fetch('/api/daily')
      .then((r) => r.json())
      .then((data: DailyQuestion) => setQ(data))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (status === 'loading' || !q) return;
    if (status === 'authenticated') {
      const saved = localStorage.getItem(storageKey(q.date));
      if (saved) {
        try {
          setResult(JSON.parse(saved) as DailyResult);
        } catch {
          localStorage.removeItem(storageKey(q.date));
        }
      }
    } else {
      setResult(null);
    }
  }, [status, q]);

  async function handleSelect(selected: number) {
    if (!q || result || submitting) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/daily', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ selected }),
      });
      const data = await res.json() as { correct: boolean; answer: number; explanation: string; correctRate: number | null; attemptCount: number };
      const r: DailyResult = { correct: data.correct, answer: data.answer, explanation: data.explanation, selected };
      setResult(r);
      localStorage.setItem(storageKey(q.date), JSON.stringify(r));
      setQ(prev => prev ? { ...prev, correctRate: data.correctRate, attemptCount: data.attemptCount } : prev);
    } finally {
      setSubmitting(false);
    }
  }

  if (!q) return null;

  return (
    <section id="daily-challenge" className="mb-12 border-t border-neutral-800 pt-10">
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <span className="text-sm font-medium text-neutral-400">오늘의 문제</span>
        <span className="text-[10px] text-emerald-400 border border-emerald-800/60 rounded px-1.5 py-0.5">
          {q.date}
        </span>
        {result ? (
          <span className={`text-[10px] border rounded px-1.5 py-0.5 ${
            result.correct
              ? 'text-emerald-400 border-emerald-800/60'
              : 'text-red-400 border-red-900/50'
          }`}>
            {result.correct ? '정답' : '오답'}
          </span>
        ) : null}
        {result ? (
          <span className="text-[10px] text-emerald-500 border border-emerald-800/50 rounded px-1.5 py-0.5">
            ✓ 오늘 출석 완료
          </span>
        ) : status === 'authenticated' ? (
          <span className="text-[10px] text-amber-500 border border-amber-800/50 rounded px-1.5 py-0.5 animate-pulse">
            풀면 출석 인정
          </span>
        ) : null}
      </div>

      <div className="bg-[#111111] border border-neutral-800 rounded-xl p-5">
        <span className="text-xs text-neutral-500 border border-neutral-800 rounded px-2 py-0.5 mb-3 inline-block">
          {CATEGORY_LABEL[q.category] ?? q.category}
        </span>
        <p className="text-sm text-white leading-relaxed mb-4">{q.question}</p>

        <div className="relative">
          <div className="space-y-2">
            {q.options.map((opt, i) => {
              let cls = 'w-full text-left rounded-md border px-4 py-2.5 text-sm flex items-start gap-3 transition-colors ';
              if (result) {
                if (i === result.answer) {
                  cls += 'border-green-500 bg-green-500/10 text-green-400';
                } else if (i === result.selected && !result.correct) {
                  cls += 'border-red-500 bg-red-500/10 text-red-400';
                } else {
                  cls += 'border-neutral-800 text-neutral-600 opacity-40 cursor-default';
                }
              } else {
                cls += 'border-neutral-800 text-neutral-300 hover:border-neutral-600 hover:text-white cursor-pointer';
              }
              return (
                <button key={i} className={cls} onClick={() => handleSelect(i)} disabled={!!result || submitting}>
                  <span className="text-xs font-mono opacity-70 flex-shrink-0 mt-0.5">{LABELS[i]}.</span>
                  <span>{opt}</span>
                </button>
              );
            })}
          </div>

          {status === 'unauthenticated' && !result && (
            <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-[#111111]/80 backdrop-blur-[2px]">
              <button
                onClick={() => router.push('/auth/login')}
                className="rounded-md bg-white text-black text-sm font-medium px-5 py-2.5 hover:bg-neutral-200 transition-colors"
              >
                로그인 후 도전하기
              </button>
            </div>
          )}
        </div>

        <div className="mt-4 pt-3 border-t border-neutral-800 flex items-center justify-between">
          <button
            onClick={openParticipants}
            className="text-[11px] text-neutral-400 hover:text-neutral-200 transition-colors text-left"
          >
            {q.attemptCount > 0
              ? `${q.attemptCount.toLocaleString()}명 도전 →`
              : result
                ? '1명 도전 →'
                : '첫 번째 도전자가 되어보세요'}
          </button>
          {q.correctRate !== null ? (
            <span className="text-[11px] text-neutral-400">
              정답률{' '}
              <span className={`font-semibold ${q.correctRate >= 60 ? 'text-neutral-300' : 'text-amber-500'}`}>
                {q.correctRate}%
              </span>
            </span>
          ) : !result ? (
            <span className="text-[11px] text-neutral-500">정답률 집계 중</span>
          ) : null}
        </div>

        {result && (
          <div className="mt-3 pt-3 border-t border-neutral-800">
            <p className="text-xs text-neutral-400 leading-relaxed">{result.explanation}</p>
          </div>
        )}
      </div>

      {/* 도전자 슬라이드 패널 */}
      <div
        className={`fixed inset-0 z-[200] transition-opacity duration-200 ${showPanel ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
        style={{ background: 'rgba(0,0,0,0.55)' }}
        onClick={() => setShowPanel(false)}
      />
      <div className={`fixed top-0 right-0 h-full z-[201] w-72 bg-[#0d0d0d] border-l border-neutral-800 shadow-2xl flex flex-col transition-transform duration-200 ${showPanel ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-800">
          <p className="text-sm font-semibold text-white">
            오늘 도전자 ({participants?.length ?? q.attemptCount}명)
          </p>
          <button onClick={() => setShowPanel(false)} className="text-neutral-500 hover:text-white text-lg leading-none transition-colors">✕</button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {panelLoading ? (
            <div className="space-y-3 pt-2">
              {[1, 2, 3].map((i) => <div key={i} className="h-10 bg-neutral-800 rounded-lg animate-pulse" />)}
            </div>
          ) : participants === null ? (
            <p className="text-xs text-neutral-600 py-4 text-center">불러오는 중...</p>
          ) : participants.length === 0 ? (
            <p className="text-xs text-neutral-600 py-4 text-center">아직 도전자 없음</p>
          ) : (
            <div className="space-y-1">
              {participants.map((p, i) => (
                <div key={i} className="flex items-center gap-3 py-2.5 border-b border-neutral-800/50 last:border-0">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${p.correct ? 'bg-emerald-500/20 border border-emerald-500/30' : 'bg-neutral-800'}`}>
                    <span className={`text-xs font-semibold ${p.correct ? 'text-emerald-400' : 'text-neutral-400'}`}>
                      {(p.nickname[0] ?? '?').toUpperCase()}
                    </span>
                  </div>
                  <span className="text-sm text-neutral-200 flex-1 truncate">{p.nickname}</span>
                  <span className={`text-[10px] rounded px-1.5 py-0.5 border ${p.correct ? 'text-emerald-400 border-emerald-500/30' : 'text-red-400 border-red-500/30'}`}>
                    {p.correct ? '정답' : '오답'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
