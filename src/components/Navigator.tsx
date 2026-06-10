"use client";

interface NavigatorProps {
  total: number;
  currentIndex: number;
  answeredIndices: number[];
  onJump: (index: number) => void;
}

export default function Navigator({
  total,
  currentIndex,
  answeredIndices,
  onJump,
}: NavigatorProps) {
  const answeredSet = new Set(answeredIndices);

  return (
    <div className="grid grid-cols-10 gap-1 sm:grid-cols-[repeat(15,minmax(0,1fr))]">
      {Array.from({ length: total }, (_, i) => {
        const isCurrent = i === currentIndex;
        const isAnswered = answeredSet.has(i);

        let cls =
          'w-8 h-8 rounded text-xs font-medium transition-colors ';
        if (isCurrent) {
          cls += 'bg-white text-black';
        } else if (isAnswered) {
          cls += 'bg-neutral-700 text-white';
        } else {
          cls += 'bg-neutral-900 text-neutral-500 hover:bg-neutral-800';
        }

        return (
          <button key={i} onClick={() => onJump(i)} className={cls}>
            {i + 1}
          </button>
        );
      })}
    </div>
  );
}
