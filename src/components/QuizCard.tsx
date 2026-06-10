"use client";

interface QuizCardProps {
  questionNumber: number;
  total: number;
  question: string;
  options: [string, string, string, string];
  selectedIndex: number | null;
  onSelect: (index: 0 | 1 | 2 | 3) => void;
}

const LABELS = ['A', 'B', 'C', 'D'] as const;

export default function QuizCard({
  questionNumber,
  total,
  question,
  options,
  selectedIndex,
  onSelect,
}: QuizCardProps) {
  return (
    <div className="bg-[#111111] border border-neutral-800 rounded-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm text-neutral-400">
          {questionNumber} / {total}
        </span>
      </div>

      <p className="text-base font-medium text-white leading-relaxed mb-6">
        {question}
      </p>

      <div className="space-y-3">
        {options.map((option, i) => {
          const idx = i as 0 | 1 | 2 | 3;
          const isSelected = selectedIndex === idx;
          return (
            <button
              key={idx}
              onClick={() => onSelect(idx)}
              className={[
                'w-full text-left rounded-md border px-4 py-3 text-sm transition-colors flex items-start',
                isSelected
                  ? 'border-blue-500 bg-blue-500/10 text-white'
                  : 'border-neutral-800 bg-[#1a1a1a] text-neutral-200 hover:border-neutral-600 hover:bg-[#222222]',
              ].join(' ')}
            >
              <span className="text-xs font-mono text-neutral-500 mr-3 flex-shrink-0 mt-0.5">
                {LABELS[i]}.
              </span>
              {option}
            </button>
          );
        })}
      </div>
    </div>
  );
}
