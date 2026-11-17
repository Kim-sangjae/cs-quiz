'use client';

export default function ConfirmDialog({ message, onConfirm, onCancel }: {
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
      <div className="bg-[#111111] border border-neutral-800 rounded-lg p-6 w-full max-w-sm">
        <p className="text-sm text-neutral-200 mb-6 leading-relaxed">{message}</p>
        <div className="flex gap-2 justify-end">
          <button
            onClick={onCancel}
            className="rounded-md border border-neutral-700 text-sm text-neutral-300 px-4 py-2 hover:text-white transition-colors"
          >
            취소
          </button>
          <button
            onClick={onConfirm}
            className="rounded-md bg-white text-black text-sm font-medium px-4 py-2 hover:bg-neutral-200 transition-colors"
          >
            확인
          </button>
        </div>
      </div>
    </div>
  );
}
