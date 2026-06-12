"use client";

interface QuizCardProps {
  questionNumber: number;
  total: number;
  category: string;
  question: string;
  options: [string, string, string, string];
  selectedIndex: number | null;
  onSelect: (index: 0 | 1 | 2 | 3) => void;
}

const LABELS = ['A', 'B', 'C', 'D'] as const;

const CATEGORY_LABEL: Record<string, string> = {
  ds: '자료구조', algo: '알고리즘', os: '운영체제',
  network: '네트워크', db: '데이터베이스', arch: '컴퓨터 구조',
};

export default function QuizCard({
  questionNumber,
  total,
  category,
  question,
  options,
  selectedIndex,
  onSelect,
}: QuizCardProps) {
  return (
    <div className="bg-[#111111] border border-neutral-800 rounded-xl p-6">
      <div className="flex items-center gap-2 mb-5">
        <span className="text-xs font-medium text-neutral-400 border border-neutral-700 rounded-full px-2.5 py-0.5">
          {CATEGORY_LABEL[category] ?? category}
        </span>
        <span className="text-xs text-neutral-600">Q.{questionNumber} / {total}</span>
      </div>

      <p className="text-[15px] font-medium text-white leading-relaxed mb-7">
        {question}
      </p>

      <div className="space-y-2.5">
        {options.map((option, i) => {
          const idx = i as 0 | 1 | 2 | 3;
          const isSelected = selectedIndex === idx;
          return (
            <button
              key={idx}
              onClick={() => onSelect(idx)}
              className={[
                'w-full text-left rounded-lg border px-4 py-3 text-sm transition-all duration-150 flex items-center gap-3',
                isSelected
                  ? 'border-blue-500 bg-blue-500/15 text-white shadow-[0_0_0_1px_rgba(59,130,246,0.3)]'
                  : 'border-neutral-800 bg-[#1a1a1a] text-neutral-300 hover:border-neutral-600 hover:bg-[#202020] hover:text-white',
              ].join(' ')}
            >
              <span className={`w-6 h-6 rounded-full border flex-shrink-0 flex items-center justify-center text-[11px] font-bold transition-colors ${
                isSelected
                  ? 'border-blue-500 bg-blue-500 text-white'
                  : 'border-neutral-700 text-neutral-500'
              }`}>
                {LABELS[i]}
              </span>
              <span className="flex-1">{option}</span>
              {isSelected && (
                <svg className="flex-shrink-0 text-blue-400" width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4.5 12.75l6 6 9-13.5" />
                </svg>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
