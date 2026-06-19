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
    <div className="flex flex-wrap gap-1">
      {Array.from({ length: total }, (_, i) => {
        const isCurrent = i === currentIndex;
        const isAnswered = answeredSet.has(i);

        let cls = 'w-8 h-8 rounded text-[11px] font-medium transition-colors ';
        if (isCurrent) {
          cls += 'bg-white text-black ring-2 ring-white/30';
        } else if (isAnswered) {
          cls += 'bg-emerald-600 text-white hover:bg-emerald-500';
        } else {
          cls += 'bg-neutral-900 text-neutral-500 border border-neutral-800 hover:bg-neutral-800 hover:text-neutral-300';
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
