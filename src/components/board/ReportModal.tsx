'use client';

import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';

const REASON_LABELS = {
  INAPPROPRIATE: '부적절한 내용',
  ERROR: '오류 있음',
  DUPLICATE: '중복 문제',
  OTHER: '기타',
} as const;

type ReportReason = keyof typeof REASON_LABELS;

interface ReportModalProps {
  questionId: string;
  initialReported: boolean;
}

export default function ReportModal({ questionId, initialReported }: ReportModalProps) {
  const [open, setOpen] = useState(false);
  const [reported, setReported] = useState(initialReported);
  const [reason, setReason] = useState<ReportReason>('INAPPROPRIATE');
  const [description, setDescription] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/questions/${questionId}/report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason, description: description.trim() || undefined }),
      });
      if (res.status === 409) throw new Error('이미 신고한 문제입니다');
      if (!res.ok) throw new Error('신고 처리 중 오류가 발생했습니다');
    },
    onError: (err: Error) => {
      setErrorMsg(err.message);
    },
    onSuccess: () => {
      setReported(true);
      setOpen(false);
      setErrorMsg('');
    },
  });

  if (reported) {
    return (
      <span className="text-xs text-neutral-500 border border-neutral-800 rounded px-3 py-1.5">
        신고 완료
      </span>
    );
  }

  return (
    <>
      <button
        onClick={() => { setOpen(true); setErrorMsg(''); }}
        className="text-xs text-neutral-500 border border-neutral-800 rounded px-3 py-1.5 hover:border-neutral-600 hover:text-neutral-300 transition-colors"
      >
        신고
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-[#111111] border border-neutral-800 rounded-lg p-6 w-full max-w-sm mx-4">
            <h2 className="text-white font-medium mb-4">문제 신고</h2>

            <div className="space-y-2 mb-4">
              {(Object.keys(REASON_LABELS) as ReportReason[]).map((r) => (
                <label key={r} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="reason"
                    value={r}
                    checked={reason === r}
                    onChange={() => setReason(r)}
                    className="accent-white"
                  />
                  <span className="text-sm text-neutral-200">{REASON_LABELS[r]}</span>
                </label>
              ))}
            </div>

            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={200}
              placeholder="추가 설명 (선택, 최대 200자)"
              className="w-full bg-[#1a1a1a] border border-neutral-800 rounded-md px-3 py-2 text-sm text-neutral-200 placeholder-neutral-600 resize-none h-20 focus:outline-none focus:border-neutral-600 mb-1"
            />
            <p className="text-xs text-neutral-600 text-right mb-3">{description.length} / 200</p>

            {errorMsg && (
              <p className="text-xs text-red-400 mb-3">{errorMsg}</p>
            )}

            <div className="flex justify-end gap-2">
              <button
                onClick={() => { setOpen(false); setErrorMsg(''); }}
                className="rounded-md border border-neutral-700 text-sm text-neutral-300 px-4 py-2 hover:border-neutral-500 hover:text-white transition-colors"
              >
                취소
              </button>
              <button
                onClick={() => mutation.mutate()}
                disabled={mutation.isPending}
                className="rounded-md bg-white text-black text-sm font-medium px-4 py-2 hover:bg-neutral-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {mutation.isPending ? '제출 중...' : '신고하기'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
