'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { toast } from 'sonner';

interface NoteButtonProps {
  questionId: string;
  className?: string;
}

export default function NoteButton({ questionId, className = '' }: NoteButtonProps) {
  const { data: session } = useSession();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!session || loaded) return;
    fetch(`/api/questions/${questionId}/note`)
      .then((r) => r.ok ? r.json() : null)
      .then((d: { note: { content: string } | null } | null) => {
        setNote(d?.note?.content ?? null);
        setInput(d?.note?.content ?? '');
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, [session, questionId, loaded]);

  if (!session) return null;

  async function handleSave() {
    if (!input.trim() || saving) return;
    setSaving(true);
    try {
      const r = await fetch(`/api/questions/${questionId}/note`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: input }),
      });
      if (!r.ok) { toast.error('저장 실패'); return; }
      setNote(input.trim());
      setOpen(false);
      toast.success('메모가 저장되었습니다.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    setSaving(true);
    try {
      await fetch(`/api/questions/${questionId}/note`, { method: 'DELETE' });
      setNote(null);
      setInput('');
      setOpen(false);
      toast.success('메모가 삭제되었습니다.');
    } finally {
      setSaving(false);
    }
  }

  function handleOpen() {
    setInput(note ?? '');
    setOpen(true);
  }

  return (
    <div className={`inline-block ${className}`}>
      <button
        onClick={handleOpen}
        title={note ? '메모 편집' : '메모 추가'}
        className={`flex items-center gap-1 text-xs px-2.5 py-1 rounded-md border transition-colors ${
          note
            ? 'border-amber-500/40 bg-amber-500/10 text-amber-400 hover:border-amber-400/60'
            : 'border-neutral-800 text-neutral-500 hover:border-neutral-600 hover:text-neutral-300'
        }`}
      >
        <svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round"
            d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
        </svg>
        {note ? '메모 있음' : '메모'}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60" onClick={() => setOpen(false)}>
          <div
            className="w-full max-w-md bg-[#111111] border border-neutral-700 rounded-xl p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-sm font-semibold text-white mb-1">오답 메모</h3>
            <p className="text-xs text-neutral-500 mb-3">왜 틀렸는지, 핵심 개념을 메모해두세요.</p>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="메모를 입력하세요..."
              rows={4}
              maxLength={1000}
              autoFocus
              className="w-full rounded-lg border border-neutral-700 bg-[#1a1a1a] px-3 py-2.5 text-sm text-neutral-200 placeholder-neutral-600 focus:border-neutral-500 focus:outline-none resize-none transition-colors"
            />
            <div className="flex items-center justify-between mt-1 mb-3">
              <span className={`text-[11px] ${input.length > 900 ? 'text-amber-400' : 'text-neutral-600'}`}>
                {input.length} / 1000
              </span>
              {note && (
                <button onClick={() => void handleDelete()} disabled={saving}
                  className="text-[11px] text-neutral-600 hover:text-red-400 transition-colors">
                  메모 삭제
                </button>
              )}
            </div>
            <div className="flex gap-2">
              <button onClick={() => setOpen(false)}
                className="flex-1 rounded-lg border border-neutral-700 text-neutral-400 text-sm py-2 hover:border-neutral-500 hover:text-white transition-colors">
                취소
              </button>
              <button onClick={() => void handleSave()} disabled={!input.trim() || saving}
                className="flex-1 rounded-lg bg-white text-black text-sm font-medium py-2 hover:bg-neutral-200 disabled:opacity-40 transition-colors">
                {saving ? '저장 중...' : '저장'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
