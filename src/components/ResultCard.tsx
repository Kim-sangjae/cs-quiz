import type { Question } from '@/types';

interface ResultCardProps {
  questionNumber: number;
  question: Question;
  userSelected: 0 | 1 | 2 | 3;
}

const LABELS = ['A', 'B', 'C', 'D'] as const;

export default function ResultCard({
  questionNumber,
  question,
  userSelected,
}: ResultCardProps) {
  return (
    <div className="bg-[#111111] border border-neutral-800 rounded-lg p-6">
      <div className="flex items-center gap-3 mb-4">
        <span className="text-xs text-neutral-500 border border-neutral-800 rounded px-2 py-0.5">
          {question.category}
        </span>
        <span className="text-sm text-neutral-500">Q.{questionNumber}</span>
      </div>

      <p className="text-base font-medium text-white leading-relaxed mb-6">
        {question.question}
      </p>

      <div className="space-y-3">
        {question.options.map((option, i) => {
          const idx = i as 0 | 1 | 2 | 3;
          const isCorrect = idx === question.answer;
          const isUserWrong = idx === userSelected && !isCorrect;

          let cls =
            'w-full text-left rounded-md border px-4 py-3 text-sm flex items-start cursor-default ';
          if (isCorrect) {
            cls += 'border-green-500 bg-green-500/10 text-green-400';
          } else if (isUserWrong) {
            cls += 'border-red-500 bg-red-500/10 text-red-400';
          } else {
            cls += 'border-neutral-800 bg-[#1a1a1a] text-neutral-600 opacity-40';
          }

          return (
            <div key={idx} className={cls}>
              <span className="text-xs font-mono mr-3 flex-shrink-0 mt-0.5 opacity-70">
                {LABELS[i]}.
              </span>
              <span className="flex-1">{option}</span>
              {isCorrect && (
                <svg
                  className="ml-2 flex-shrink-0 mt-0.5"
                  width={16}
                  height={16}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
              )}
              {isUserWrong && (
                <svg
                  className="ml-2 flex-shrink-0 mt-0.5"
                  width={16}
                  height={16}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              )}
            </div>
          );
        })}
      </div>

      <div className="border-t border-neutral-800 mt-4 pt-4 text-sm text-neutral-300 leading-relaxed">
        {question.explanation}
      </div>
    </div>
  );
}
