"use client";

interface NavigatorProps {
  total: number;
  currentIndex: number;
  answeredIndices: number[];
  onJump: (index: number) => void;
  lockedBefore?: number; // 이 인덱스 미만은 클릭 불가 + 비활성화 스타일
}

export default function Navigator({
  total,
  currentIndex,
  answeredIndices,
  onJump,
  lockedBefore = 0,
}: NavigatorProps) {
  const answeredSet = new Set(answeredIndices);

  return (
    <div className="flex flex-wrap gap-1">
      {Array.from({ length: total }, (_, i) => {
        const isCurrent = i === currentIndex;
        const isLocked = i < lockedBefore;

        let cls = 'w-8 h-8 rounded text-[11px] font-medium transition-colors ';

        if (isLocked) {
          cls += 'bg-neutral-900/40 text-neutral-700 border border-neutral-800/40 cursor-not-allowed opacity-40';
        } else if (isCurrent) {
          cls += 'bg-white text-black ring-2 ring-white/30';
        } else if (answeredSet.has(i)) {
          cls += 'bg-emerald-600 text-white hover:bg-emerald-500';
        } else {
          cls += 'bg-neutral-900 text-neutral-500 border border-neutral-800 hover:bg-neutral-800 hover:text-neutral-300';
        }

        return (
          <button
            key={i}
            onClick={() => { if (!isLocked) onJump(i); }}
            disabled={isLocked}
            className={cls}
          >
            {i + 1}
          </button>
        );
      })}
    </div>
  );
}
