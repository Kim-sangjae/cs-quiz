'use client';

const CATEGORY_LABEL: Record<string, string> = {
  ds: '자료구조', algo: '알고리즘', os: '운영체제',
  network: '네트워크', db: '데이터베이스', arch: '컴퓨터 구조', se: '소프트웨어공학',
};
const CATEGORIES = ['ds', 'algo', 'os', 'network', 'db', 'arch', 'se'];

export interface EditState {
  id: string; category: string; question: string;
  options: [string, string, string, string]; answer: number; explanation: string;
}

export default function QuestionEditModal({
  editState, setEditState, onCancel, onSave, saving, requestConfirm,
}: {
  editState: EditState;
  setEditState: (s: EditState) => void;
  onCancel: () => void;
  onSave: () => void;
  saving: boolean;
  requestConfirm: (msg: string, fn: () => void) => void;
}) {
  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
      <div className="bg-[#111111] border border-neutral-800 rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <h2 className="text-base font-semibold text-white mb-5">문제 수정</h2>

        <div className="space-y-4">
          <div>
            <label className="text-xs text-neutral-400 mb-1 block">카테고리</label>
            <select
              value={editState.category}
              onChange={(e) => setEditState({ ...editState, category: e.target.value })}
              className="w-full bg-[#1a1a1a] border border-neutral-700 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:border-neutral-500"
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs text-neutral-400 mb-1 block">문제</label>
            <textarea
              value={editState.question}
              onChange={(e) => setEditState({ ...editState, question: e.target.value })}
              rows={3}
              className="w-full bg-[#1a1a1a] border border-neutral-700 rounded-md px-3 py-2 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-neutral-500 resize-none"
            />
          </div>

          {(['A', 'B', 'C', 'D'] as const).map((label, i) => (
            <div key={label}>
              <label className="text-xs text-neutral-400 mb-1 block">보기 {label}</label>
              <input
                type="text"
                value={editState.options[i]}
                onChange={(e) => {
                  const opts = [...editState.options] as [string, string, string, string];
                  opts[i] = e.target.value;
                  setEditState({ ...editState, options: opts });
                }}
                className="w-full bg-[#1a1a1a] border border-neutral-700 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:border-neutral-500"
              />
            </div>
          ))}

          <div>
            <label className="text-xs text-neutral-400 mb-2 block">정답</label>
            <div className="flex gap-4">
              {(['A', 'B', 'C', 'D'] as const).map((label, i) => (
                <label key={label} className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="answer"
                    checked={editState.answer === i}
                    onChange={() => setEditState({ ...editState, answer: i })}
                    className="accent-white"
                  />
                  <span className="text-sm text-neutral-300">{label}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs text-neutral-400 mb-1 block">해설</label>
            <textarea
              value={editState.explanation}
              onChange={(e) => setEditState({ ...editState, explanation: e.target.value })}
              rows={3}
              className="w-full bg-[#1a1a1a] border border-neutral-700 rounded-md px-3 py-2 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-neutral-500 resize-none"
            />
          </div>
        </div>

        <div className="flex gap-2 mt-6 justify-end">
          <button
            onClick={onCancel}
            className="rounded-md border border-neutral-700 text-sm text-neutral-300 px-5 py-2 hover:text-white transition-colors"
          >
            취소
          </button>
          <button
            onClick={() => requestConfirm('문제를 수정하시겠습니까?', onSave)}
            disabled={saving}
            className="rounded-md bg-white text-black text-sm font-medium px-5 py-2 hover:bg-neutral-200 disabled:opacity-40 transition-colors"
          >
            {saving ? '저장 중...' : '저장'}
          </button>
        </div>
      </div>
    </div>
  );
}
