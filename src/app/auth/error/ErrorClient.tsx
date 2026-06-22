'use client';

import { useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';

export default function ErrorClient({ error, email }: { error: string; email: string }) {
  const isDeactivated = error === 'AccessDenied';

  if (!isDeactivated) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center space-y-4">
          <p className="text-neutral-400 text-sm">로그인 중 오류가 발생했습니다.</p>
          <Link href="/" className="text-xs text-neutral-500 hover:text-white transition-colors underline">
            홈으로
          </Link>
        </div>
      </div>
    );
  }

  return <DeactivatedView email={email} />;
}

function DeactivatedView({ email }: { email: string }) {
  const [showForm, setShowForm] = useState(false);
  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!content.trim()) {
      toast.error('문의 내용을 입력해주세요.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/inquiries/public', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, content: content.trim() }),
      });
      if (!res.ok) {
        const data = await res.json() as { error?: string };
        toast.error(data.error ?? '등록에 실패했습니다.');
        return;
      }
      setSubmitted(true);
    } catch {
      toast.error('오류가 발생했습니다. 다시 시도해주세요.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-6">
        {/* 아이콘 + 메시지 */}
        <div className="text-center space-y-3">
          <div className="mx-auto w-12 h-12 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center">
            <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="text-red-400">
              <circle cx="12" cy="12" r="10" />
              <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
            </svg>
          </div>
          <div>
            <h1 className="text-lg font-semibold text-white">비활성화된 계정입니다</h1>
            <p className="text-sm text-neutral-500 mt-1 leading-relaxed">
              관리자에 의해 계정이 비활성화되었습니다.<br />
              문제가 있다고 생각되시면 관리자에게 문의해주세요.
            </p>
            {email && (
              <p className="text-xs text-neutral-600 mt-2">{email}</p>
            )}
          </div>
        </div>

        {/* 버튼 */}
        {!showForm && !submitted && (
          <div className="flex flex-col gap-2.5">
            <button
              onClick={() => setShowForm(true)}
              className="w-full rounded-lg bg-white text-black text-sm font-semibold py-2.5 hover:bg-neutral-200 transition-colors"
            >
              관리자에게 문의하기
            </button>
            <Link
              href="/"
              className="w-full rounded-lg border border-neutral-700 text-neutral-300 text-sm font-medium py-2.5 hover:text-white hover:border-neutral-500 transition-colors text-center"
            >
              홈으로
            </Link>
          </div>
        )}

        {/* 문의 완료 */}
        {submitted && (
          <div className="space-y-3">
            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-4 py-3 text-center">
              <p className="text-sm text-emerald-400">문의가 등록되었습니다.</p>
              <p className="text-xs text-neutral-500 mt-1">관리자가 확인 후 조치하겠습니다.</p>
            </div>
            <Link
              href="/"
              className="block w-full rounded-lg border border-neutral-700 text-neutral-300 text-sm font-medium py-2.5 hover:text-white hover:border-neutral-500 transition-colors text-center"
            >
              홈으로
            </Link>
          </div>
        )}

        {/* 문의 폼 */}
        {showForm && !submitted && (
          <form onSubmit={handleSubmit} className="space-y-3">
            {email && (
              <div className="bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-2.5">
                <p className="text-[11px] text-neutral-500 mb-0.5">계정 이메일</p>
                <p className="text-sm text-neutral-300">{email}</p>
              </div>
            )}
            <div>
              <label className="text-xs text-neutral-400 mb-1.5 block">문의 내용</label>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={5}
                placeholder="계정 비활성화 관련 문의 내용을 작성해주세요."
                className="w-full bg-[#111111] border border-neutral-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-neutral-600 focus:outline-none focus:border-neutral-500 resize-none"
              />
            </div>
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="flex-1 rounded-lg border border-neutral-700 text-sm text-neutral-400 py-2.5 hover:text-white transition-colors"
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
        )}
      </div>
    </div>
  );
}
