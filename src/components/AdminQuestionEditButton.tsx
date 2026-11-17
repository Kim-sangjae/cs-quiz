'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { toast } from 'sonner';
import QuestionEditModal, { type EditState } from './QuestionEditModal';
import ConfirmDialog from './ConfirmDialog';

interface Props {
  question: { id: string; category: string; question: string; options: string[]; answer: number; explanation: string };
  onSaved?: () => void;
}

export default function AdminQuestionEditButton({ question, onSaved }: Props) {
  const router = useRouter();
  const { data: session } = useSession();
  const [editState, setEditState] = useState<EditState | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirm, setConfirm] = useState<{ message: string; onConfirm: () => void } | null>(null);

  if (session?.user?.role !== 'ADMIN') return null;

  function openEdit() {
    setEditState({
      id: question.id,
      category: question.category,
      question: question.question,
      options: [question.options[0] ?? '', question.options[1] ?? '', question.options[2] ?? '', question.options[3] ?? ''],
      answer: question.answer,
      explanation: question.explanation,
    });
  }

  async function saveEdit() {
    if (!editState) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/questions/${editState.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'edit', editData: editState }),
      });
      if (res.ok) {
        toast.success('문제가 수정되었습니다.');
        setEditState(null);
        if (onSaved) onSaved(); else router.refresh();
      } else {
        toast.error('수정에 실패했습니다.');
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <button
        onClick={openEdit}
        className="text-xs text-neutral-500 hover:text-white border border-neutral-800 hover:border-neutral-600 rounded px-2 py-1 transition-colors"
      >
        관리자 수정
      </button>
      {editState && (
        <QuestionEditModal
          editState={editState}
          setEditState={setEditState}
          onCancel={() => setEditState(null)}
          onSave={saveEdit}
          saving={saving}
          requestConfirm={(message, onConfirm) => setConfirm({ message, onConfirm })}
        />
      )}
      {confirm && (
        <ConfirmDialog
          message={confirm.message}
          onConfirm={() => { confirm.onConfirm(); setConfirm(null); }}
          onCancel={() => setConfirm(null)}
        />
      )}
    </>
  );
}
