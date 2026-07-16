'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

const TYPES = [
  { value: 'BUG_REPORT', label: '버그 신고' },
  { value: 'ACCOUNT_ISSUE', label: '계정 문제' },
  { value: 'CONTENT_ISSUE', label: '콘텐츠/문제 오류' },
  { value: 'SUGGESTION', label: '기능 제안' },
  { value: 'OTHER', label: '기타' },
];

export default function NewInquiryPage() {
  const router = useRouter();
  const [type, setType] = useState('BUG_REPORT');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !content.trim()) {
      toast.error('제목과 내용을 모두 입력해주세요.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/inquiries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, title, content }),
      });
      if (!res.ok) throw new Error();
      toast.success('문의가 등록되었습니다.');
      router.push('/inquiry');
    } catch {
      toast.error('등록에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="flex items-center gap-3 mb-8">
        <button
          onClick={() => router.back()}
          className="text-neutral-500 hover:text-white transition-colors"
        >
          <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-xl font-semibold text-white">새 문의 작성</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="text-xs text-neutral-400 mb-1.5 block">문의 유형</label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="w-full bg-[#111111] border border-neutral-700 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-neutral-500"
          >
            {TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-xs text-neutral-400 mb-1.5 block">제목</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={100}
            placeholder="문의 제목을 입력해주세요"
            className="w-full bg-[#111111] border border-neutral-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-neutral-500"
          />
        </div>

        <div>
          <label className="text-xs text-neutral-400 mb-1.5 block">내용</label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={8}
            maxLength={1000}
            placeholder="문의 내용을 자세히 작성해주세요"
            className="w-full bg-[#111111] border border-neutral-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-neutral-500 resize-none"
          />
        </div>

        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={() => router.back()}
            className="flex-1 rounded-lg border border-neutral-700 text-sm text-neutral-300 py-2.5 hover:text-white transition-colors"
          >
            취소
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="flex-1 rounded-lg bg-white text-black text-sm font-semibold py-2.5 hover:bg-neutral-200 disabled:opacity-40 transition-colors"
          >
            {submitting ? '등록 중...' : '문의 등록'}
          </button>
        </div>
      </form>
    </div>
  );
}
