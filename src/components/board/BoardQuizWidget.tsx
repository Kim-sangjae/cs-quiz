"use client";

import { useState } from "react";

const OPTION_LABELS = ["A", "B", "C", "D"] as const;

export default function BoardQuizWidget({
  options,
  answer,
  explanation,
}: {
  options: string[];
  answer: number;
  explanation: string;
}) {
  const [selected, setSelected] = useState<number | null>(null);
  const revealed = selected !== null;

  return (
    <>
      <div className="space-y-2 mb-6">
        {options.map((option, idx) => {
          const isAnswer = idx === answer;
          const isSelected = idx === selected;

          let cls =
            "w-full flex items-center gap-3 rounded-md border px-4 py-3 text-sm text-left transition-colors ";
          if (!revealed) {
            cls +=
              "border-neutral-800 bg-[#1a1a1a] text-neutral-300 cursor-pointer hover:border-neutral-600 hover:bg-[#222222]";
          } else if (isAnswer) {
            cls += "border-green-500 bg-green-500/10 text-green-400 cursor-default";
          } else if (isSelected) {
            cls += "border-red-500/60 bg-red-500/10 text-red-400 cursor-default";
          } else {
            cls +=
              "border-neutral-800 bg-[#1a1a1a] text-neutral-500 opacity-40 cursor-default";
          }

          return (
            <button
              key={idx}
              className={cls}
              onClick={() => !revealed && setSelected(idx)}
              disabled={revealed}
            >
              <span className="text-xs font-mono flex-shrink-0">
                {OPTION_LABELS[idx]}
              </span>
              <span>{option}</span>
              {revealed && isAnswer && (
                <svg
                  className="ml-auto flex-shrink-0"
                  width={16}
                  height={16}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M4.5 12.75l6 6 9-13.5"
                  />
                </svg>
              )}
              {revealed && isSelected && !isAnswer && (
                <svg
                  className="ml-auto flex-shrink-0"
                  width={16}
                  height={16}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              )}
            </button>
          );
        })}
      </div>

      <div className="border-t border-neutral-800 pt-4 mb-6">
        {revealed ? (
          <>
            <p
              className={`text-xs font-medium mb-2 ${
                selected === answer ? "text-green-400" : "text-red-400"
              }`}
            >
              {selected === answer ? "정답입니다" : "오답입니다"}
            </p>
            <p className="text-xs text-neutral-500 mb-1">해설</p>
            <p className="text-sm text-neutral-300 leading-relaxed">
              {explanation}
            </p>
          </>
        ) : (
          <p className="text-xs text-neutral-500">
            선택지를 클릭해 정답을 확인하세요
          </p>
        )}
      </div>
    </>
  );
}
