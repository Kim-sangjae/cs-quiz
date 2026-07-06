'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { toast } from 'sonner';
import UserProfileModal from '@/components/UserProfileModal';

interface Comment {
  id: string;
  content: string;
  createdAt: string;
  userId: string;
  user: { nickname: string | null };
}

const COMMENT_REPORT_REASONS = [
  { value: 'INAPPROPRIATE', label: '부적절한 내용' },
  { value: 'SPAM', label: '스팸/광고' },
  { value: 'HARASSMENT', label: '욕설/비방' },
  { value: 'OTHER', label: '기타' },
] as const;

function relativeTime(iso: string) {
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.floor(ms / 60_000);
  if (m < 1) return '방금 전';
  if (m < 60) return `${m}분 전`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}시간 전`;
  return `${Math.floor(h / 24)}일 전`;
}

interface ReportModalState {
  commentId: string;
  reason: string;
  description: string;
  submitting: boolean;
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
  const [profileModal, setProfileModal] = useState<{ userId: string; nickname: string } | null>(null);
  const [reportModal, setReportModal] = useState<ReportModalState | null>(null);
  const [adminPending, setAdminPending] = useState<string | null>(null);

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

  async function handleAdminBlind(commentId: string) {
    setAdminPending(commentId);
    try {
      const r = await fetch('/api/admin/comment-reports', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ commentId, action: 'blind' }),
      });
      if (!r.ok) { toast.error('처리 실패'); return; }
      await fetchComments(page);
      toast.success('블라인드 처리되었습니다.');
    } finally {
      setAdminPending(null);
    }
  }

  async function handleReport(e: React.FormEvent) {
    e.preventDefault();
    if (!reportModal || reportModal.submitting) return;
    setReportModal((prev) => prev ? { ...prev, submitting: true } : null);
    try {
      const r = await fetch(
        `/api/questions/${questionId}/comments/${reportModal.commentId}/report`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reason: reportModal.reason, description: reportModal.description }),
        },
      );
      if (r.status === 409) { toast.error('이미 신고한 댓글입니다.'); setReportModal(null); return; }
      if (!r.ok) { toast.error('신고 실패'); return; }
      toast.success('신고가 접수되었습니다.');
      setReportModal(null);
    } finally {
      setReportModal((prev) => prev ? { ...prev, submitting: false } : null);
    }
  }

  const isAdmin = session?.user?.role === 'ADMIN';

  return (
    <div className="mt-6 pt-6 border-t border-neutral-800">
      {profileModal && (
        <UserProfileModal
          userId={profileModal.userId}
          nickname={profileModal.nickname}
          isSelf={session?.user?.id === profileModal.userId}
          showActions={session?.user?.id !== profileModal.userId}
          onClose={() => setProfileModal(null)}
        />
      )}

      {/* 댓글 신고 모달 */}
      {reportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70" onClick={() => setReportModal(null)} />
          <div className="relative bg-[#111111] border border-neutral-800 rounded-xl p-6 w-full max-w-sm">
            <h3 className="text-sm font-semibold text-white mb-4">댓글 신고</h3>
            <form onSubmit={(e) => void handleReport(e)} className="space-y-3">
              <div className="space-y-1.5">
                {COMMENT_REPORT_REASONS.map(({ value, label }) => (
                  <label key={value} className="flex items-center gap-2.5 cursor-pointer">
                    <input
                      type="radio"
                      name="reason"
                      value={value}
                      checked={reportModal.reason === value}
                      onChange={() => setReportModal((prev) => prev ? { ...prev, reason: value } : null)}
                      className="accent-white"
                    />
                    <span className="text-sm text-neutral-300">{label}</span>
                  </label>
                ))}
              </div>
              <textarea
                value={reportModal.description}
                onChange={(e) => setReportModal((prev) => prev ? { ...prev, description: e.target.value } : null)}
                placeholder="추가 설명 (선택)"
                rows={2}
                maxLength={200}
                className="w-full rounded-md border border-neutral-800 bg-[#1a1a1a] px-3 py-2 text-sm text-neutral-200 placeholder-neutral-600 focus:border-neutral-600 focus:outline-none resize-none transition-colors"
              />
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={reportModal.submitting}
                  className="flex-1 rounded-md bg-red-500/10 border border-red-500/30 text-red-400 text-sm py-2 hover:bg-red-500/20 transition-colors disabled:opacity-40"
                >
                  {reportModal.submitting ? '신고 중...' : '신고하기'}
                </button>
                <button
                  type="button"
                  onClick={() => setReportModal(null)}
                  className="flex-1 rounded-md border border-neutral-700 text-neutral-400 text-sm py-2 hover:text-white transition-colors"
                >
                  취소
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <h3 className="text-sm font-semibold text-white mb-4">
        댓글
        {total > 0 && <span className="ml-1.5 text-neutral-500 font-normal">{total}</span>}
      </h3>

      {loading ? (
        <div className="py-6 text-center text-sm text-neutral-600">불러오는 중...</div>
      ) : comments.length === 0 ? (
        <p className="text-sm text-neutral-600 py-4">첫 번째 댓글을 남겨보세요.</p>
      ) : (
        <div className="space-y-3 mb-4">
          {comments.map((c) => {
            const isMe = session?.user?.id === c.userId;
            return (
              <div key={c.id} className="flex gap-3 group">
                <div className="w-6 h-6 rounded-full bg-neutral-800 border border-neutral-700 flex items-center justify-center flex-shrink-0 text-[10px] font-bold text-neutral-400">
                  {(c.user.nickname ?? '?').charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <button
                      onClick={() => {
                        if (c.user.nickname) {
                          setProfileModal({ userId: c.userId, nickname: c.user.nickname });
                        }
                      }}
                      className="text-xs font-medium text-neutral-300 hover:text-white transition-colors"
                    >
                      {c.user.nickname ?? '익명'}
                    </button>
                    <span className="text-[11px] text-neutral-600">{relativeTime(c.createdAt)}</span>
                    <div className="ml-auto flex items-center gap-1.5">
                      {/* 신고 버튼: 본인 댓글 아닌 경우, 로그인한 유저 */}
                      {session && !isMe && !isAdmin && (
                        <button
                          onClick={() => setReportModal({ commentId: c.id, reason: 'INAPPROPRIATE', description: '', submitting: false })}
                          className="opacity-0 group-hover:opacity-100 text-[11px] text-neutral-700 hover:text-amber-400 transition-all"
                          title="신고"
                        >
                          <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                            <path d="M12 2v2" /><path d="M5.636 4.636l1.414 1.414" /><path d="M16.95 6.05l1.414-1.414" />
                            <path d="M2 12h2" /><path d="M20 12h2" />
                            <path d="M9 12a3 3 0 1 0 6 0 3 3 0 0 0-6 0z" />
                            <rect x="6" y="15" width="12" height="3" rx="1" />
                          </svg>
                        </button>
                      )}
                      {/* 관리자 블라인드 버튼 */}
                      {isAdmin && (
                        <button
                          onClick={() => void handleAdminBlind(c.id)}
                          disabled={adminPending === c.id}
                          className="opacity-0 group-hover:opacity-100 text-[11px] text-neutral-700 hover:text-orange-400 transition-all disabled:opacity-40"
                          title="블라인드"
                        >
                          블라인드
                        </button>
                      )}
                      {(isMe || isAdmin) && (
                        <button
                          onClick={() => void handleDelete(c.id)}
                          className="text-[11px] text-neutral-700 hover:text-red-400 transition-colors"
                        >
                          삭제
                        </button>
                      )}
                    </div>
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
          <a href="/auth/login" className="text-neutral-400 hover:text-white transition-colors">로그인</a>
          {' '}후 댓글을 남길 수 있습니다.
        </div>
      )}
    </div>
  );
}
