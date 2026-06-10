'use client';

import { useState } from 'react';
import { useSession, signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';

const CATEGORIES = [
  { value: 'ds', label: '자료구조' },
  { value: 'algo', label: '알고리즘' },
  { value: 'os', label: '운영체제' },
  { value: 'network', label: '네트워크' },
  { value: 'db', label: '데이터베이스' },
  { value: 'arch', label: '컴퓨터구조' },
] as const;

const OPTION_LABELS = ['A', 'B', 'C', 'D'] as const;

export default function BoardSubmitPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [category, setCategory] = useState('');
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(['', '', '', '']);
  const [answer, setAnswer] = useState<number | null>(null);
  const [explanation, setExplanation] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const isComplete =
    category !== '' &&
    question.length > 0 &&
    question.length <= 500 &&
    options.every((o) => o.length > 0 && o.length <= 200) &&
    answer !== null &&
    explanation.length > 0 &&
    explanation.length <= 500;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isComplete || submitting) return;
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch('/api/questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category, question, options, answer, explanation }),
      });
      if (!res.ok) {
        const data = await res.json() as { error?: string };
        setError(data.error ?? '등록에 실패했습니다.');
        return;
      }
      router.push('/board');
    } catch {
      setError('네트워크 오류가 발생했습니다.');
    } finally {
      setSubmitting(false);
    }
  }

  if (status === 'loading') {
    return <main className="max-w-2xl mx-auto px-4 sm:px-6 py-8" />;
  }

  if (!session) {
    return (
      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
        <div className="bg-[#111111] border border-neutral-800 rounded-lg p-8 text-center">
          <p className="text-neutral-400 mb-4">문제를 등록하려면 로그인이 필요합니다.</p>
          <button
            onClick={() => signIn('google')}
            className="rounded-md bg-white text-black text-sm font-medium px-6 py-2.5 hover:bg-neutral-200 transition-colors"
          >
            Google로 로그인
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-white mb-1">문제 등록</h1>
        <p className="text-sm text-neutral-500">CS 문제를 등록하면 검토 후 게시판에 노출됩니다.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* 카테고리 */}
        <div>
          <label className="block text-sm text-neutral-400 mb-1.5">카테고리</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full rounded-md border border-neutral-800 bg-[#1a1a1a] px-3 py-2.5 text-sm text-neutral-200 focus:outline-none focus:border-neutral-600"
          >
            <option value="">선택하세요</option>
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </div>

        {/* 문제 */}
        <div>
          <div className="flex justify-between items-baseline mb-1.5">
            <label className="text-sm text-neutral-400">문제</label>
            <span className={`text-xs ${question.length > 500 ? 'text-red-400' : 'text-neutral-500'}`}>
              {question.length} / 500
            </span>
          </div>
          <textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="문제를 입력하세요"
            rows={4}
            className="w-full rounded-md border border-neutral-800 bg-[#1a1a1a] px-3 py-2.5 text-sm text-neutral-200 placeholder-neutral-600 focus:outline-none focus:border-neutral-600 resize-none"
          />
        </div>

        {/* 보기 A~D */}
        <div>
          <label className="block text-sm text-neutral-400 mb-2">보기</label>
          <div className="space-y-2">
            {OPTION_LABELS.map((label, i) => (
              <div key={label} className="flex items-center gap-3">
                <span className="text-xs font-mono text-neutral-500 flex-shrink-0 w-4">{label}</span>
                <div className="flex-1 relative">
                  <input
                    type="text"
                    value={options[i]}
                    onChange={(e) => {
                      const next = [...options];
                      next[i] = e.target.value;
                      setOptions(next);
                    }}
                    placeholder={`보기 ${label}`}
                    maxLength={200}
                    className="w-full rounded-md border border-neutral-800 bg-[#1a1a1a] px-3 py-2.5 text-sm text-neutral-200 placeholder-neutral-600 focus:outline-none focus:border-neutral-600"
                  />
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-neutral-600 pointer-events-none">
                    {options[i].length}/200
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 정답 */}
        <div>
          <label className="block text-sm text-neutral-400 mb-2">정답</label>
          <div className="flex gap-4">
            {OPTION_LABELS.map((label, i) => (
              <label key={label} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="answer"
                  value={i}
                  checked={answer === i}
                  onChange={() => setAnswer(i)}
                  className="accent-white"
                />
                <span className="text-sm text-neutral-300">{label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* 해설 */}
        <div>
          <div className="flex justify-between items-baseline mb-1.5">
            <label className="text-sm text-neutral-400">해설</label>
            <span className={`text-xs ${explanation.length > 500 ? 'text-red-400' : 'text-neutral-500'}`}>
              {explanation.length} / 500
            </span>
          </div>
          <textarea
            value={explanation}
            onChange={(e) => setExplanation(e.target.value)}
            placeholder="정답 이유와 핵심 개념을 1~3문장으로 설명하세요"
            rows={3}
            className="w-full rounded-md border border-neutral-800 bg-[#1a1a1a] px-3 py-2.5 text-sm text-neutral-200 placeholder-neutral-600 focus:outline-none focus:border-neutral-600 resize-none"
          />
        </div>

        {error && <p className="text-sm text-red-400">{error}</p>}

        <button
          type="submit"
          disabled={!isComplete || submitting}
          className="rounded-md bg-white text-black text-sm font-medium px-6 py-2.5 hover:bg-neutral-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {submitting ? '등록 중...' : '등록하기'}
        </button>
      </form>
    </main>
  );
}
