'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { toast } from 'sonner';
import Link from 'next/link';

interface Comment {
  id: string;
  content: string;
  createdAt: string;
  userId: string;
  user: { nickname: string | null };
}

function relativeTime(iso: string) {
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.floor(ms / 60_000);
  if (m < 1) return '방금 전';
  if (m < 60) return `${m}분 전`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}시간 전`;
  return `${Math.floor(h / 24)}일 전`;
}

export default function CommentSection({ questionId }: { questionId: string }) {
  const { data: session } = useSession();
  const [comments, setComments] = useState<Comment[]>([]);
  const [total, setTotal] = useState(0);
  const [pageCount, setPageCount] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchComments = useCallback(async (p: number) => {
    setLoading(true);
    try {
      const r = await fetch(`/api/questions/${questionId}/comments?page=${p}`);
      if (!r.ok) return;
      const data = await r.json() as { comments: Comment[]; total: number; pageCount: number };
      setComments(data.comments);
      setTotal(data.total);
      setPageCount(data.pageCount);
    } finally {
      setLoading(false);
    }
  }, [questionId]);

  useEffect(() => { void fetchComments(page); }, [fetchComments, page]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!content.trim() || submitting) return;
    setSubmitting(true);
    try {
      const r = await fetch(`/api/questions/${questionId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      });
      if (!r.ok) { toast.error('댓글 등록 실패'); return; }
      setContent('');
      await fetchComments(0);
      setPage(0);
      toast.success('댓글이 등록되었습니다.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(commentId: string) {
    const r = await fetch(`/api/questions/${questionId}/comments/${commentId}`, { method: 'DELETE' });
    if (!r.ok) { toast.error('삭제 실패'); return; }
    await fetchComments(page);
    toast.success('삭제되었습니다.');
  }

  const isAdmin = session?.user?.role === 'ADMIN';

  return (
    <div className="mt-6 pt-6 border-t border-neutral-800">
      <h3 className="text-sm font-semibold text-white mb-4">
        댓글
        {total > 0 && <span className="ml-1.5 text-neutral-500 font-normal">{total}</span>}
      </h3>

      {/* 댓글 목록 */}
      {loading ? (
        <div className="py-6 text-center text-sm text-neutral-600">불러오는 중...</div>
      ) : comments.length === 0 ? (
        <p className="text-sm text-neutral-600 py-4">첫 번째 댓글을 남겨보세요.</p>
      ) : (
        <div className="space-y-3 mb-4">
          {comments.map((c) => {
            const isMe = session?.user?.id === c.userId;
            return (
              <div key={c.id} className="flex gap-3">
                <div className="w-6 h-6 rounded-full bg-neutral-800 border border-neutral-700 flex items-center justify-center flex-shrink-0 text-[10px] font-bold text-neutral-400">
                  {(c.user.nickname ?? '?').charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <Link
                      href={`/u/${encodeURIComponent(c.user.nickname ?? '')}`}
                      className="text-xs font-medium text-neutral-300 hover:text-white transition-colors"
                    >
                      {c.user.nickname ?? '익명'}
                    </Link>
                    <span className="text-[11px] text-neutral-600">{relativeTime(c.createdAt)}</span>
                    {(isMe || isAdmin) && (
                      <button
                        onClick={() => void handleDelete(c.id)}
                        className="text-[11px] text-neutral-700 hover:text-red-400 transition-colors ml-auto"
                      >
                        삭제
                      </button>
                    )}
                  </div>
                  <p className="text-sm text-neutral-300 mt-0.5 leading-relaxed whitespace-pre-wrap break-words">
                    {c.content}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 페이지네이션 */}
      {pageCount > 1 && (
        <div className="flex items-center gap-2 mb-4">
          <button
            disabled={page === 0}
            onClick={() => setPage((p) => p - 1)}
            className="text-xs px-2.5 py-1 rounded border border-neutral-800 text-neutral-500 hover:border-neutral-600 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            이전
          </button>
          <span className="text-xs text-neutral-600">{page + 1} / {pageCount}</span>
          <button
            disabled={page >= pageCount - 1}
            onClick={() => setPage((p) => p + 1)}
            className="text-xs px-2.5 py-1 rounded border border-neutral-800 text-neutral-500 hover:border-neutral-600 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            다음
          </button>
          <span className="ml-auto text-[11px] text-neutral-600">총 {total}개</span>
        </div>
      )}

      {/* 댓글 입력 */}
      {session ? (
        <form onSubmit={(e) => void handleSubmit(e)} className="flex flex-col gap-2">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="댓글을 입력하세요 (최대 500자)"
            rows={2}
            maxLength={500}
            className="w-full rounded-md border border-neutral-800 bg-[#1a1a1a] px-3 py-2 text-sm text-neutral-200 placeholder-neutral-600 focus:border-neutral-600 focus:outline-none resize-none transition-colors"
          />
          <div className="flex items-center justify-between">
            <span className={`text-[11px] ${content.length > 480 ? 'text-amber-400' : 'text-neutral-600'}`}>
              {content.length} / 500
            </span>
            <button
              type="submit"
              disabled={!content.trim() || submitting}
              className="rounded-md bg-white text-black text-xs font-medium px-4 py-1.5 hover:bg-neutral-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {submitting ? '등록 중...' : '등록'}
            </button>
          </div>
        </form>
      ) : (
        <div className="text-sm text-neutral-600 border border-neutral-800 rounded-lg px-4 py-3">
          <Link href="/auth/login" className="text-neutral-400 hover:text-white transition-colors">로그인</Link>
          {' '}후 댓글을 남길 수 있습니다.
        </div>
      )}
    </div>
  );
}
