"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import ResultCard from "@/components/ResultCard";
import type { Category, Question } from "@/types";

const CATEGORY_LABELS: Record<Category, string> = {
  ds: "자료구조",
  algo: "알고리즘",
  os: "OS",
  network: "네트워크",
  db: "DB",
  arch: "컴퓨터구조",
};

const VALID_CATEGORIES = new Set<string>(["ds", "algo", "os", "network", "db", "arch"]);

interface WrongItem {
  question: { id: string; category: string; question: string; options: unknown; answer: number; explanation: string };
  selected: number;
  wrongCount: number;
}

function wrongCountColor(count: number): string {
  if (count >= 5) return "text-red-600";
  if (count >= 3) return "text-red-900";
  return "text-neutral-300";
}

export default function CategoryWrongNotePage() {
  const params = useParams();
  const router = useRouter();
  const category = params.category as string;

  const [items, setItems] = useState<WrongItem[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!VALID_CATEGORIES.has(category)) {
      router.replace("/mypage");
      return;
    }

    fetch(`/api/mypage/wrong-answers?category=${category}`)
      .then((r) => r.json())
      .then((data) => {
        setItems((data as { items: WrongItem[] }).items ?? []);
        setLoaded(true);
      })
      .catch(() => {
        setItems([]);
        setLoaded(true);
      });
  }, [category, router]);

  if (!loaded) return null;

  const catLabel = CATEGORY_LABELS[category as Category] ?? category;

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="flex items-center gap-4 mb-8">
        <button
          onClick={() => router.push("/mypage")}
          className="text-neutral-400 hover:text-white text-sm transition-colors"
        >
          ← 마이페이지
        </button>
        <h1 className="text-xl font-semibold text-white">{catLabel} 오답 노트</h1>
      </div>

      {items.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-neutral-500 text-sm">틀린 문제가 없습니다.</p>
        </div>
      ) : (
        <>
          <p className="text-xs text-neutral-500 mb-3">오답 {items.length}문제</p>
          <div className="space-y-2">
            {items.map((item, idx) => {
              const isExpanded = expandedId === item.question.id;
              const titleColor = wrongCountColor(item.wrongCount);
              return (
                <div
                  key={item.question.id}
                  className="bg-[#111111] border border-neutral-800 rounded-lg overflow-hidden"
                >
                  <button
                    className="w-full text-left px-4 py-3 hover:bg-[#161616] transition-colors flex items-center justify-between gap-3"
                    onClick={() =>
                      setExpandedId(isExpanded ? null : item.question.id)
                    }
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`text-sm truncate ${titleColor}`}>
                        {item.question.question}
                      </span>
                      {item.wrongCount >= 3 && (
                        <span className="text-[10px] text-neutral-600 flex-shrink-0">
                          ×{item.wrongCount}
                        </span>
                      )}
                    </div>
                    <svg
                      width={12}
                      height={12}
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2}
                      className={`text-neutral-600 flex-shrink-0 transition-transform ${
                        isExpanded ? "rotate-180" : ""
                      }`}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M19 9l-7 7-7-7"
                      />
                    </svg>
                  </button>
                  {isExpanded && (
                    <div className="border-t border-neutral-800 p-4">
                      <ResultCard
                        questionNumber={idx + 1}
                        question={item.question as unknown as Question}
                        userSelected={item.selected as 0 | 1 | 2 | 3}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
