'use client';

import { useEffect, useState } from 'react';
import { useSession, signIn } from 'next-auth/react';

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

export default function DailyChallenge() {
  const { status } = useSession();
  const [q, setQ] = useState<DailyQuestion | null>(null);
  const [result, setResult] = useState<DailyResult | null>(null);
  const [submitting, setSubmitting] = useState(false);

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
                onClick={() => signIn('google')}
                className="rounded-md bg-white text-black text-sm font-medium px-5 py-2.5 hover:bg-neutral-200 transition-colors"
              >
                로그인 후 도전하기
              </button>
            </div>
          )}
        </div>

        <div className="mt-4 pt-3 border-t border-neutral-800 flex items-center justify-between">
          <span className="text-[11px] text-neutral-400">
            {q.attemptCount > 0
              ? `${q.attemptCount.toLocaleString()}명 도전`
              : result
                ? '1명 도전'
                : '첫 번째 도전자가 되어보세요'}
          </span>
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
    </section>
  );
}
