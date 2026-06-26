'use client';

import { useRef, useState, useEffect, Suspense } from 'react';
import { useSession, signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

const CATEGORIES = [
  { value: 'ds', label: '자료구조' },
  { value: 'algo', label: '알고리즘' },
  { value: 'os', label: '운영체제' },
  { value: 'network', label: '네트워크' },
  { value: 'db', label: '데이터베이스' },
  { value: 'arch', label: '컴퓨터구조' },
] as const;

const OPTION_LABELS = ['A', 'B', 'C', 'D'] as const;

const CATEGORY_LABEL: Record<string, string> = {
  ds: '자료구조', algo: '알고리즘', os: '운영체제',
  network: '네트워크', db: '데이터베이스', arch: '컴퓨터구조',
};

interface SimilarQuestion {
  id: string;
  question: string;
  category: string;
  sim: number;
}

function SubmitContent() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const resubmitId = searchParams.get('resubmit');
  const isResubmit = !!resubmitId;

  const [category, setCategory] = useState('');
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(['', '', '', '']);
  const [answer, setAnswer] = useState<number | null>(null);
  const [explanation, setExplanation] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const [similarQuestions, setSimilarQuestions] = useState<SimilarQuestion[]>([]);
  const similarTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [generating, setGenerating] = useState(false);

  // 재요청 모드: 기존 문제 데이터 프리필
  useEffect(() => {
    if (!resubmitId) return;
    fetch(`/api/questions/${resubmitId}`)
      .then((r) => r.json())
      .then((data) => {
        setCategory(data.category ?? '');
        setQuestion(data.question ?? '');
        setOptions(Array.isArray(data.options) ? data.options : ['', '', '', '']);
        setAnswer(typeof data.answer === 'number' ? data.answer : null);
        setExplanation(data.explanation ?? '');
      })
      .catch(() => {});
  }, [resubmitId]);

  const isComplete =
    category !== '' &&
    question.length > 0 &&
    question.length <= 500 &&
    options.every((o) => o.length > 0 && o.length <= 200) &&
    answer !== null &&
    explanation.length > 0 &&
    explanation.length <= 500;

  function handleQuestionChange(value: string) {
    setQuestion(value);
    if (similarTimer.current) clearTimeout(similarTimer.current);
    if (value.trim().length < 5) {
      setSimilarQuestions([]);
      return;
    }
    similarTimer.current = setTimeout(async () => {
      try {
        const r = await fetch(`/api/questions/similar?q=${encodeURIComponent(value)}`);
        if (r.ok) setSimilarQuestions(await r.json() as SimilarQuestion[]);
      } catch {
        // 네트워크 오류 시 조용히 무시
      }
    }, 600);
  }

  async function handleGenerateOptions() {
    if (!question.trim() || !options[answer ?? -1]?.trim()) return;
    setGenerating(true);
    try {
      const correctAnswer = options[answer!];
      const r = await fetch('/api/questions/generate-options', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question, answer: correctAnswer }),
      });
      if (!r.ok) return;
      const data = await r.json() as { distractors: string[]; explanation: string };
      const { distractors, explanation: generatedExplanation } = data;
      const next = ['', '', '', ''];
      next[answer!] = correctAnswer;
      let di = 0;
      for (let i = 0; i < 4; i++) {
        if (i !== answer!) next[i] = distractors[di++] ?? '';
      }
      setOptions(next);
      if (generatedExplanation) setExplanation(generatedExplanation);
    } finally {
      setGenerating(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isComplete || submitting) return;
    setSubmitting(true);
    setError('');
    try {
      const payload = { category, question, options, answer, explanation };
      const url = isResubmit ? `/api/questions/${resubmitId}` : '/api/questions';
      const method = isResubmit ? 'PATCH' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json() as { error?: string };
        setError(data.error ?? '처리에 실패했습니다.');
        return;
      }
      router.push(isResubmit ? '/mypage' : '/board');
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
        <Link href="/board" className="text-xs text-neutral-600 hover:text-neutral-400 transition-colors mb-4 inline-block">← 게시판</Link>
        <h1 className="text-2xl font-semibold text-white mb-1">
          {isResubmit ? '문제 수정' : '문제 등록'}
        </h1>
        <p className="text-sm text-neutral-500">
          {isResubmit
            ? '내용을 수정하면 다시 검토 후 게시판에 노출됩니다.'
            : 'AI가 오답 보기와 해설을 자동으로 생성해줍니다.'}
        </p>
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
            onChange={(e) => handleQuestionChange(e.target.value)}
            placeholder="문제를 입력하세요"
            rows={4}
            className="w-full rounded-md border border-neutral-800 bg-[#1a1a1a] px-3 py-2.5 text-sm text-neutral-200 placeholder-neutral-600 focus:outline-none focus:border-neutral-600 resize-none"
          />
          {similarQuestions.length > 0 && (
            <div className="mt-2 rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
              <p className="text-xs text-amber-400 mb-2 font-medium">비슷한 문제가 이미 있습니다</p>
              <ul className="space-y-1.5">
                {similarQuestions.map((sq) => (
                  <li key={sq.id} className="flex items-start gap-2">
                    <span className="text-xs text-neutral-600 border border-neutral-800 rounded px-1.5 py-0.5 flex-shrink-0">
                      {CATEGORY_LABEL[sq.category] ?? sq.category}
                    </span>
                    <a
                      href={`/board/${sq.id}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-neutral-400 hover:text-white transition-colors leading-relaxed"
                    >
                      {sq.question.length > 80 ? sq.question.slice(0, 80) + '…' : sq.question}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* 보기 A~D */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm text-neutral-400">보기</label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleGenerateOptions}
                disabled={generating || !question.trim() || answer === null || !options[answer]?.trim()}
                className="text-xs text-neutral-400 border border-neutral-700 rounded-md px-3 py-1.5 hover:text-white hover:border-neutral-500 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                {generating ? '생성 중...' : '✦ 보기 + 해설 자동 생성'}
              </button>
              <div className="relative group">
                <span className="flex items-center justify-center w-4 h-4 rounded-full border border-neutral-700 text-neutral-500 text-[10px] cursor-help hover:border-neutral-500 hover:text-neutral-300 transition-colors select-none">
                  ?
                </span>
                <div className="absolute bottom-full right-0 mb-2 w-64 bg-[#0a0a0a] border border-neutral-700 rounded-lg p-3 shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                  <p className="text-xs font-medium text-white mb-1.5">AI 자동 생성</p>
                  <p className="text-xs text-neutral-400 leading-relaxed">문제와 정답 보기를 입력하면 AI가 오답 3개와 해설을 자동으로 작성해줍니다.</p>
                  <div className="mt-2 pt-2 border-t border-neutral-800 space-y-0.5 text-[11px] text-neutral-600">
                    <p>1. 문제 입력</p>
                    <p>2. 정답 라디오 선택</p>
                    <p>3. 정답 보기 텍스트 입력</p>
                    <p>→ 버튼 활성화</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
          {answer !== null && !options[answer]?.trim() && question.trim() && (
            <p className="text-xs text-neutral-600 mb-2">정답 보기를 먼저 입력하면 나머지 오답을 자동으로 생성합니다.</p>
          )}
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
          {submitting ? '처리 중...' : isResubmit ? '재요청하기' : '등록하기'}
        </button>
      </form>
    </main>
  );
}

export default function BoardSubmitPage() {
  return (
    <Suspense fallback={<main className="max-w-2xl mx-auto px-4 sm:px-6 py-8" />}>
      <SubmitContent />
    </Suspense>
  );
}
