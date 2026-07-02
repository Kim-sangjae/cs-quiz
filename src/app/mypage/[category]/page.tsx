'use client';

import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { Question } from '@/types';
import QuestionDrawer from '@/components/QuestionDrawer';
import NoteButton from '@/components/NoteButton';

const CATEGORY_LABELS: Record<string, string> = {
  ds: '자료구조',
  algo: '알고리즘',
  os: '운영체제',
  network: '네트워크',
  db: '데이터베이스',
  arch: '컴퓨터 구조',
  se: '소프트웨어공학',
};

const VALID_CATEGORIES = new Set(['ds', 'algo', 'os', 'network', 'db', 'arch', 'se']);

interface WrongItem {
  question: Question & { id: string };
  selected: number;
  wrongCount: number;
}

export default function CategoryDetailPage({
  params,
}: {
  params: Promise<{ category: string }>;
}) {
  const { category } = use(params);
  const router = useRouter();
  const [items, setItems] = useState<WrongItem[] | null>(null);
  const [drawerItem, setDrawerItem] = useState<{ question: Question & { id: string }; selected: number; number: number } | null>(null);

  useEffect(() => {
    if (!VALID_CATEGORIES.has(category)) {
      router.replace('/mypage');
      return;
    }
    fetch(`/api/mypage/wrong-answers?category=${category}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setItems((d as { items: WrongItem[] } | null)?.items ?? []))
      .catch(() => setItems([]));
  }, [category, router]);

  const label = CATEGORY_LABELS[category] ?? category;

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="flex items-center gap-3 mb-6">
        <Link
          href="/mypage"
          className="text-neutral-400 hover:text-white text-sm transition-colors"
        >
          ← 마이페이지
        </Link>
        <h1 className="text-xl font-semibold text-white">{label} 오답 목록</h1>
      </div>

      {items === null ? (
        <div className="py-16 text-center">
          <p className="text-neutral-500 text-sm">불러오는 중...</p>
        </div>
      ) : items.length === 0 ? (
        <div className="py-16 text-center">
          <p className="text-neutral-500 text-sm mb-2">아직 오답이 없습니다.</p>
          <Link
            href={`/quiz/play?category=${category}`}
            className="text-sm text-white underline underline-offset-2 hover:text-neutral-300 transition-colors"
          >
            {label} 퀴즈 풀기
          </Link>
        </div>
      ) : (
        <>
          <p className="text-xs text-neutral-500 mb-4">틀린 문제 {items.length}개 (문제별 최신 오답 기준)</p>
          <div className="space-y-2">
            {items.map((item, i) => (
              <div
                key={item.question.id}
                className="bg-[#111111] border border-neutral-800 rounded-lg px-4 py-3 hover:bg-[#1a1a1a] transition-colors"
              >
                <div className="flex items-center gap-2">
                  <button
                    className="flex-1 flex items-center gap-2 min-w-0 text-left"
                    onClick={() => setDrawerItem({ question: item.question, selected: item.selected, number: i + 1 })}
                  >
                    <span className="text-xs text-neutral-500 flex-shrink-0">{i + 1}.</span>
                    {item.wrongCount > 1 && (
                      <span className="text-[10px] text-red-400 border border-red-900/50 rounded px-1.5 py-0.5 flex-shrink-0">
                        {item.wrongCount}회 틀림
                      </span>
                    )}
                    <span className="text-sm text-neutral-300 truncate">{item.question.question}</span>
                  </button>
                  <NoteButton questionId={item.question.id} />
                </div>
              </div>
            ))}
          </div>

          <QuestionDrawer
            open={drawerItem !== null}
            questionId={drawerItem?.question.id ?? null}
            prefetched={drawerItem?.question}
            userSelected={drawerItem?.selected}
            questionNumber={drawerItem?.number}
            onClose={() => setDrawerItem(null)}
          />

          <div className="mt-8 flex justify-center">
            <Link
              href={`/quiz/play?category=${category}`}
              className="rounded-md bg-white text-black text-sm font-medium px-6 py-2.5 hover:bg-neutral-200 transition-colors"
            >
              {label} 다시 풀기
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
