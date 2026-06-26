'use client';

import { useState, useRef, useEffect } from 'react';
import { useRealtime } from '@/contexts/RealtimeContext';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

type Tab = 'questions' | 'board' | 'reports' | 'users' | 'inquiries' | 'logs' | 'analytics' | 'errors';

const CATEGORY_LABEL: Record<string, string> = {
  ds: '자료구조', algo: '알고리즘', os: '운영체제',
  network: '네트워크', db: '데이터베이스', arch: '컴퓨터 구조',
};
const CATEGORIES = ['ds', 'algo', 'os', 'network', 'db', 'arch'];
const REASON_LABEL: Record<string, string> = {
  INAPPROPRIATE: '부적절한 내용', ERROR: '오류 있음',
  DUPLICATE: '중복 문제', OTHER: '기타',
};
const STATUS_LABEL: Record<string, string> = {
  OFFICIAL: '기본', PENDING: '대기중', APPROVED: '승인됨',
  REJECTED: '거절됨', BLINDED: '블라인드',
};
const STATUS_CLASS: Record<string, string> = {
  OFFICIAL: 'text-blue-400 border-blue-500/30',
  PENDING: 'text-amber-400 border-amber-500/30',
  APPROVED: 'text-green-400 border-green-500/30',
  REJECTED: 'text-red-400 border-red-500/30',
  BLINDED: 'text-orange-400 border-orange-500/30',
};

interface PendingQuestion {
  id: string; category: string; question: string; createdAt: string;
  options: string[]; answer: number; explanation: string | null;
  author: { nickname: string | null; email: string } | null;
}
interface SimilarQuestion {
  id: string; question: string; category: string; sim: number;
}
interface ReportItem {
  id: string; reason: string; description: string | null;
  reporter: { nickname: string | null };
}
interface ReportGroup {
  question: { id: string; category: string; question: string; status: string };
  reportCount: number; latestReportAt: string; dismissed: boolean; reports: ReportItem[];
}
interface BoardQuestion {
  id: string; category: string; question: string;
  options: string[]; answer: number; explanation: string;
  status: string; createdAt: string;
  author: { nickname: string | null; email: string } | null;
}
interface BoardResponse {
  questions: BoardQuestion[]; totalCount: number; pageCount: number;
}
interface AdminUser {
  id: string; email: string; nickname: string | null;
  role: string; deletedAt: string | null; createdAt: string;
  _count: { quizSessions: number };
}
interface EditState {
  id: string; category: string; question: string;
  options: [string, string, string, string]; answer: number; explanation: string;
}

interface ConfirmState {
  message: string;
  onConfirm: () => void;
}

export default function AdminPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<Tab>('analytics');
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);
  const [prevSeenAt, setPrevSeenAt] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const { data: badge } = useQuery<{ questions: number; reports: number; inquiries: number }>({
    queryKey: ['admin', 'badge'],
    queryFn: () => fetch('/api/admin/badge').then((r) => r.json()),
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  // 관리자 패널 진입 시 seen 처리 — 헤더 배지 초기화 + 이전 seenAt 캡처
  useEffect(() => {
    fetch('/api/admin/badge/seen', { method: 'POST' })
      .then((r) => r.json())
      .then(({ prevSeenAt: prev }: { prevSeenAt: string | null }) => {
        setPrevSeenAt(prev);
        queryClient.invalidateQueries({ queryKey: ['admin', 'badge'] });
      })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function requestConfirm(message: string, onConfirm: () => void) {
    setConfirm({ message, onConfirm });
  }

  async function handleRefresh() {
    setRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: ['admin'] });
    setRefreshing(false);
  }

  if (status === 'loading') return null;
  if (!session || session.user?.role !== 'ADMIN') {
    router.replace('/');
    return null;
  }

  const tabs: { key: Tab; label: string; count?: number }[] = [
    { key: 'analytics', label: '애널리틱스' },
    { key: 'questions', label: '승인 대기', count: badge?.questions },
    { key: 'board', label: '게시판 관리' },
    { key: 'reports', label: '신고 접수', count: badge?.reports },
    { key: 'users', label: '유저 관리' },
    { key: 'inquiries', label: '문의 관리', count: badge?.inquiries },
    { key: 'logs', label: '감사 로그' },
    { key: 'errors', label: '오류 로그' },
  ];

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-white">관리자 패널</h1>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="flex items-center gap-1.5 text-xs text-neutral-500 hover:text-white border border-neutral-800 hover:border-neutral-600 rounded-lg px-3 py-1.5 transition-colors disabled:opacity-40"
          title="새로고침"
        >
          <svg
            width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
            className={refreshing ? 'animate-spin' : ''}
          >
            <polyline points="23 4 23 10 17 10" />
            <polyline points="1 20 1 14 7 14" />
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
          </svg>
          {refreshing ? '새로고침 중...' : '새로고침'}
        </button>
      </div>
      <div className="flex gap-1 mb-6 border-b border-neutral-800 overflow-x-auto">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={`relative px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors ${
              activeTab === t.key
                ? 'text-white border-b-2 border-white'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            {t.label}
            {!!t.count && (
              <span className="ml-1.5 inline-flex items-center justify-center min-w-[18px] h-[18px] rounded-full bg-red-500 text-[10px] font-bold text-white px-1">
                {t.count > 9 ? '9+' : t.count}
              </span>
            )}
          </button>
        ))}
      </div>
      {activeTab === 'analytics' && <AnalyticsTab />}
      {activeTab === 'questions' && <QuestionsTab prevSeenAt={prevSeenAt} />}
      {activeTab === 'board' && <BoardTab requestConfirm={requestConfirm} />}
      {activeTab === 'reports' && <ReportsTab prevSeenAt={prevSeenAt} />}
      {activeTab === 'users' && <UsersTab currentUserId={session.user?.id ?? ''} requestConfirm={requestConfirm} />}
      {activeTab === 'inquiries' && <InquiriesTab prevSeenAt={prevSeenAt} />}
      {activeTab === 'logs' && <LogsTab />}
      {activeTab === 'errors' && <ErrorLogsTab />}
      {confirm && (
        <ConfirmDialog
          message={confirm.message}
          onConfirm={() => { confirm.onConfirm(); setConfirm(null); }}
          onCancel={() => setConfirm(null)}
        />
      )}
    </div>
  );
}

interface QuestionPreviewData {
  id: string; category: string; question: string;
  options: string[]; answer: number; explanation: string | null;
  createdAt: string;
  author: { nickname: string | null; email?: string } | null;
}

function QuestionPreviewModal({ id, prefilled, onClose }: {
  id: string;
  prefilled?: QuestionPreviewData;
  onClose: () => void;
}) {
  const [q, setQ] = useState<QuestionPreviewData | null>(prefilled ?? null);
  const [loading, setLoading] = useState(!prefilled);

  useEffect(() => {
    if (prefilled) return;
    fetch(`/api/questions/${id}`)
      .then((r) => r.json())
      .then((data) => { setQ(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [id, prefilled]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const OPTION_LABELS = ['A', 'B', 'C', 'D'];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-[#111111] border border-neutral-700 rounded-xl w-full max-w-lg max-h-[85vh] overflow-y-auto shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-800 sticky top-0 bg-[#111111]">
          <div className="flex items-center gap-2">
            {q && (
              <span className="text-xs text-neutral-500 border border-neutral-800 rounded px-2 py-0.5">
                {CATEGORY_LABEL[q.category] ?? q.category}
              </span>
            )}
            <span className="text-sm font-medium text-white">문제 상세</span>
          </div>
          <button onClick={onClose} className="text-neutral-500 hover:text-white transition-colors text-lg leading-none">✕</button>
        </div>

        {loading && <p className="text-neutral-500 text-sm text-center py-10">불러오는 중...</p>}
        {!loading && !q && <p className="text-neutral-500 text-sm text-center py-10">문제를 찾을 수 없습니다.</p>}
        {q && (
          <div className="px-5 py-5 space-y-5">
            <p className="text-sm text-neutral-100 leading-relaxed">{q.question}</p>

            <div className="space-y-2">
              {(q.options as string[]).map((opt, i) => (
                <div
                  key={i}
                  className={`flex items-start gap-3 px-3 py-2.5 rounded-lg border text-sm transition-colors ${
                    i === q.answer
                      ? 'border-green-500/40 bg-green-500/10 text-green-300'
                      : 'border-neutral-800 text-neutral-400'
                  }`}
                >
                  <span className="font-mono text-xs flex-shrink-0 mt-0.5 font-bold">
                    {OPTION_LABELS[i]}
                  </span>
                  <span className="leading-relaxed">{opt}</span>
                  {i === q.answer && (
                    <span className="ml-auto text-xs text-green-400 flex-shrink-0">정답</span>
                  )}
                </div>
              ))}
            </div>

            {q.explanation && (
              <div className="bg-neutral-900 rounded-lg px-4 py-3">
                <p className="text-xs text-neutral-500 mb-1">해설</p>
                <p className="text-sm text-neutral-300 leading-relaxed">{q.explanation}</p>
              </div>
            )}

            <div className="text-xs text-neutral-600 flex items-center gap-3 pt-1 border-t border-neutral-800">
              <span>{q.author?.nickname ?? q.author?.email ?? '(알 수 없음)'}</span>
              <span>{new Date(q.createdAt).toLocaleDateString('ko-KR')}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function SimilarQuestionsPanel({ questionText }: { questionText: string }) {
  const [previewId, setPreviewId] = useState<string | null>(null);

  const { data: similar = [], isFetching } = useQuery<SimilarQuestion[]>({
    queryKey: ['similar', questionText],
    queryFn: async () => {
      const r = await fetch(`/api/questions/similar?q=${encodeURIComponent(questionText)}`);
      if (!r.ok) return [];
      return r.json();
    },
    staleTime: 60_000,
  });

  if (isFetching) {
    return <p className="text-xs text-neutral-600 mt-3">유사 문제 검색 중...</p>;
  }
  if (similar.length === 0) {
    return <p className="text-xs text-neutral-600 mt-3">유사한 문제가 없습니다.</p>;
  }
  return (
    <>
      <div className="mt-3 rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
        <p className="text-xs text-amber-400 mb-2 font-medium">유사 문제 {similar.length}건</p>
        <ul className="space-y-1.5">
          {similar.map((sq) => (
            <li key={sq.id} className="flex items-start gap-2">
              <span className="text-xs text-neutral-600 border border-neutral-800 rounded px-1.5 py-0.5 flex-shrink-0">
                {CATEGORY_LABEL[sq.category] ?? sq.category}
              </span>
              <button
                onClick={() => setPreviewId(sq.id)}
                className="text-xs text-neutral-400 hover:text-white transition-colors leading-relaxed text-left"
              >
                {sq.question.length > 80 ? sq.question.slice(0, 80) + '…' : sq.question}
              </button>
              <span className="text-xs text-neutral-700 flex-shrink-0">
                {Math.round(sq.sim * 100)}%
              </span>
            </li>
          ))}
        </ul>
      </div>
      {previewId && (
        <QuestionPreviewModal id={previewId} onClose={() => setPreviewId(null)} />
      )}
    </>
  );
}

function QuestionsTab({ prevSeenAt }: { prevSeenAt: string | null }) {
  const queryClient = useQueryClient();
  const REJECTION_REASONS = [
    '이미 등록된 문제와 유사합니다.',
    '문제 또는 보기가 불명확합니다.',
    '출제 범위에 맞지 않는 주제입니다.',
  ];

  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState(REJECTION_REASONS[0]);
  const [showSimilarId, setShowSimilarId] = useState<string | null>(null);
  const [previewQuestion, setPreviewQuestion] = useState<PendingQuestion | null>(null);

  const { data: questions = [] } = useQuery<PendingQuestion[]>({
    queryKey: ['admin', 'questions'],
    queryFn: async () => {
      const r = await fetch('/api/admin/questions');
      if (!r.ok) return [];
      return r.json();
    },
  });

  const mutation = useMutation({
    mutationFn: ({ id, action, reason }: { id: string; action: 'approve' | 'reject'; reason?: string }) =>
      fetch(`/api/admin/questions/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, rejectionReason: reason }),
      }).then((r) => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'questions'] });
      setRejectingId(null);
      setRejectionReason(REJECTION_REASONS[0]);
    },
  });

  if (questions.length === 0) {
    return <p className="text-neutral-500 text-sm text-center py-8">대기 중인 문제가 없습니다.</p>;
  }

  return (
    <div className="space-y-4">
      {questions.map((q) => (
        <div key={q.id} className="bg-[#111111] border border-neutral-800 rounded-lg p-5">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xs text-neutral-500 border border-neutral-800 rounded px-2 py-0.5">
              {CATEGORY_LABEL[q.category] ?? q.category}
            </span>
            <span className="text-xs text-neutral-500">
              {q.author?.nickname ?? q.author?.email ?? '(알 수 없음)'}
            </span>
            <span className="text-xs text-neutral-600">
              {new Date(q.createdAt).toLocaleDateString('ko-KR')}
            </span>
            {prevSeenAt && new Date(q.createdAt) > new Date(prevSeenAt) && (
              <span className="text-[10px] font-bold text-amber-400 border border-amber-500/40 rounded px-1.5 py-0.5">NEW</span>
            )}
          </div>
          <p className="text-sm text-neutral-200 mb-4 leading-relaxed">
            {q.question.length > 120 ? q.question.slice(0, 120) + '…' : q.question}
          </p>
          {showSimilarId === q.id && <SimilarQuestionsPanel questionText={q.question} />}
          {rejectingId === q.id ? (
            <div className="space-y-3 mt-4 bg-[#1a1a1a] border border-neutral-800 rounded-lg p-4">
              <p className="text-xs text-neutral-400 font-medium">거절 사유 선택</p>
              <div className="space-y-2">
                {REJECTION_REASONS.map((reason) => (
                  <label key={reason} className="flex items-center gap-2 cursor-pointer group">
                    <input
                      type="radio"
                      name={`rejection-${q.id}`}
                      value={reason}
                      checked={rejectionReason === reason}
                      onChange={() => setRejectionReason(reason)}
                      className="accent-red-400"
                    />
                    <span className="text-xs text-neutral-300 group-hover:text-white transition-colors">
                      {reason}
                    </span>
                  </label>
                ))}
              </div>
              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => mutation.mutate({ id: q.id, action: 'reject', reason: rejectionReason })}
                  disabled={mutation.isPending}
                  className="rounded-md bg-red-500/10 border border-red-500/30 text-red-400 text-xs px-3 py-1.5 hover:bg-red-500/20 transition-colors disabled:opacity-40"
                >
                  거절 확인
                </button>
                <button
                  onClick={() => { setRejectingId(null); setRejectionReason(REJECTION_REASONS[0]); }}
                  className="rounded-md border border-neutral-700 text-neutral-400 text-xs px-3 py-1.5 hover:text-white transition-colors"
                >
                  취소
                </button>
              </div>
            </div>
          ) : (
            <div className="flex gap-2 mt-4">
              <button
                onClick={() => mutation.mutate({ id: q.id, action: 'approve' })}
                disabled={mutation.isPending}
                className="rounded-md bg-green-500/10 border border-green-500/30 text-green-400 text-xs px-3 py-1.5 hover:bg-green-500/20 transition-colors disabled:opacity-40"
              >
                승인
              </button>
              <button
                onClick={() => setRejectingId(q.id)}
                className="rounded-md bg-[#1a1a1a] border border-neutral-700 text-neutral-400 text-xs px-3 py-1.5 hover:text-white transition-colors"
              >
                거절
              </button>
              <button
                onClick={() => setShowSimilarId(showSimilarId === q.id ? null : q.id)}
                className={`rounded-md border text-xs px-3 py-1.5 transition-colors ${
                  showSimilarId === q.id
                    ? 'border-amber-500/40 text-amber-400 hover:border-amber-500'
                    : 'border-neutral-800 text-neutral-500 hover:text-white'
                }`}
              >
                유사 문제
              </button>
              <button
                onClick={() => setPreviewQuestion(q)}
                className="rounded-md border border-neutral-800 text-neutral-500 text-xs px-3 py-1.5 hover:text-white transition-colors"
              >
                상세 보기
              </button>
            </div>
          )}
        </div>
      ))}
      {previewQuestion && (
        <QuestionPreviewModal
          id={previewQuestion.id}
          prefilled={previewQuestion}
          onClose={() => setPreviewQuestion(null)}
        />
      )}
    </div>
  );
}

type BoardSort = 'newest' | 'oldest' | 'attempts' | 'likes';

const SORT_OPTIONS: { v: BoardSort; l: string }[] = [
  { v: 'newest', l: '최신순' },
  { v: 'oldest', l: '오래된순' },
  { v: 'attempts', l: '시도 많은순' },
  { v: 'likes', l: '좋아요순' },
];

function BoardTab({ requestConfirm }: { requestConfirm: (msg: string, fn: () => void) => void }) {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState('all');
  const [catFilter, setCatFilter] = useState('all');
  const [sort, setSort] = useState<BoardSort>('newest');
  const [searchInput, setSearchInput] = useState('');
  const [searchQ, setSearchQ] = useState('');
  const [page, setPage] = useState(1);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [editState, setEditState] = useState<EditState | null>(null);
  const [editSaving, setEditSaving] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkPending, setBulkPending] = useState(false);

  const { data, isLoading } = useQuery<BoardResponse>({
    queryKey: ['admin', 'board', statusFilter, catFilter, sort, searchQ, page],
    queryFn: () => {
      const params = new URLSearchParams({ status: statusFilter, cat: catFilter, sort, page: String(page), q: searchQ });
      return fetch(`/api/admin/board?${params}`).then((r) => r.json());
    },
  });

  const questions = data?.questions ?? [];
  const pageCount = data?.pageCount ?? 1;
  const totalCount = data?.totalCount ?? 0;

  async function handleAction(id: string, action: 'blind' | 'unblind' | 'delete') {
    setActionLoading(id + ':' + action);
    try {
      await fetch(`/api/admin/questions/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      queryClient.invalidateQueries({ queryKey: ['admin', 'board'] });
      setSelectedIds((prev) => { const n = new Set(prev); n.delete(id); return n; });
    } finally {
      setActionLoading(null);
    }
  }

  function toggleSelectBoard(id: string) {
    setSelectedIds((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  }
  function toggleAllBoard() {
    const pageIds = questions.map((q) => q.id);
    const allSel = pageIds.every((id) => selectedIds.has(id));
    setSelectedIds(allSel ? new Set() : new Set(pageIds));
  }
  async function handleBulkBoard(action: 'blind' | 'delete') {
    if (selectedIds.size === 0 || bulkPending) return;
    const label = action === 'blind' ? '블라인드' : '삭제';
    requestConfirm(`선택된 ${selectedIds.size}개 문제를 ${label} 처리하시겠습니까?${action === 'delete' ? ' 이 작업은 되돌릴 수 없습니다.' : ''}`, async () => {
      setBulkPending(true);
      try {
        await fetch('/api/admin/questions/bulk', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids: [...selectedIds], action }) });
        queryClient.invalidateQueries({ queryKey: ['admin', 'board'] });
        queryClient.invalidateQueries({ queryKey: ['admin', 'badge'] });
        setSelectedIds(new Set());
        toast.success(`일괄 ${label} 완료`);
      } finally { setBulkPending(false); }
    });
  }

  function openEdit(q: BoardQuestion) {
    setEditState({
      id: q.id,
      category: q.category,
      question: q.question,
      options: [q.options[0] ?? '', q.options[1] ?? '', q.options[2] ?? '', q.options[3] ?? ''],
      answer: q.answer,
      explanation: q.explanation,
    });
  }

  async function saveEdit() {
    if (!editState) return;
    setEditSaving(true);
    try {
      const res = await fetch(`/api/admin/questions/${editState.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'edit', editData: editState }),
      });
      if (res.ok) {
        toast.success('문제가 수정되었습니다.');
        queryClient.invalidateQueries({ queryKey: ['admin', 'board'] });
        setEditState(null);
      } else {
        toast.error('수정에 실패했습니다.');
      }
    } finally {
      setEditSaving(false);
    }
  }

  const STATUS_FILTERS = [
    { v: 'all', l: '전체' },
    { v: 'official', l: '기본' },
    { v: 'pending', l: '대기중' },
    { v: 'approved', l: '승인됨' },
    { v: 'rejected', l: '거절됨' },
    { v: 'blinded', l: '블라인드' },
  ];

  return (
    <>
      <div>
        <div className="flex flex-wrap gap-2 mb-4">
          <div className="flex w-full gap-2 mb-1">
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { setSearchQ(searchInput); setPage(1); } }}
              placeholder="문제 내용 검색..."
              className="flex-1 bg-[#1a1a1a] border border-neutral-700 rounded-md px-3 py-1.5 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-neutral-500"
            />
            <button
              onClick={() => { setSearchQ(searchInput); setPage(1); }}
              className="rounded-md border border-neutral-700 text-neutral-300 text-xs px-3 py-1.5 hover:text-white transition-colors"
            >
              검색
            </button>
            {searchQ && (
              <button
                onClick={() => { setSearchInput(''); setSearchQ(''); setPage(1); }}
                className="rounded-md border border-neutral-800 text-neutral-500 text-xs px-3 py-1.5 hover:text-white transition-colors"
              >
                초기화
              </button>
            )}
            <select
              value={sort}
              onChange={(e) => { setSort(e.target.value as BoardSort); setPage(1); }}
              className="bg-[#1a1a1a] border border-neutral-700 rounded-md px-3 py-1.5 text-xs text-neutral-300 focus:outline-none focus:border-neutral-500"
            >
              {SORT_OPTIONS.map(({ v, l }) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {STATUS_FILTERS.map(({ v, l }) => (
              <button
                key={v}
                onClick={() => { setStatusFilter(v); setPage(1); }}
                className={`rounded px-3 py-1 text-xs transition-colors ${
                  statusFilter === v
                    ? 'border border-neutral-500 text-white'
                    : 'border border-neutral-800 text-neutral-500 hover:border-neutral-600 hover:text-neutral-300'
                }`}
              >
                {l}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {['all', ...CATEGORIES].map((c) => (
              <button
                key={c}
                onClick={() => { setCatFilter(c); setPage(1); }}
                className={`rounded px-3 py-1 text-xs transition-colors ${
                  catFilter === c
                    ? 'bg-white text-black'
                    : 'bg-neutral-900 text-neutral-400 hover:bg-neutral-800 border border-neutral-800'
                }`}
              >
                {c === 'all' ? '전체' : CATEGORY_LABEL[c]}
              </button>
            ))}
          </div>
        </div>

        {isLoading ? (
          <p className="text-neutral-500 text-sm text-center py-8">로딩 중...</p>
        ) : questions.length === 0 ? (
          <p className="text-neutral-500 text-sm text-center py-8">문제가 없습니다.</p>
        ) : (
          <>
            <div className="flex items-center gap-2 mb-3">
              <p className="text-xs text-neutral-500">총 {totalCount}개</p>
            </div>

            {selectedIds.size > 0 && (
              <div className="flex items-center gap-3 bg-neutral-900 border border-neutral-700 rounded-lg px-4 py-2.5 mb-3">
                <span className="text-xs text-neutral-300">{selectedIds.size}개 선택됨</span>
                <button onClick={() => handleBulkBoard('blind')} disabled={bulkPending}
                  className="rounded-md bg-orange-500/10 border border-orange-500/30 text-orange-400 text-xs px-3 py-1.5 hover:bg-orange-500/20 transition-colors disabled:opacity-40">
                  일괄 블라인드
                </button>
                <button onClick={() => handleBulkBoard('delete')} disabled={bulkPending}
                  className="rounded-md bg-red-500/10 border border-red-500/30 text-red-400 text-xs px-3 py-1.5 hover:bg-red-500/20 transition-colors disabled:opacity-40">
                  일괄 삭제
                </button>
                <button onClick={() => setSelectedIds(new Set())} className="ml-auto text-xs text-neutral-600 hover:text-neutral-400 transition-colors">선택 해제</button>
              </div>
            )}

            <div className="flex items-center gap-2 px-1 mb-2">
              <input type="checkbox"
                checked={questions.length > 0 && questions.every((q) => selectedIds.has(q.id))}
                onChange={toggleAllBoard}
                className="w-3.5 h-3.5 rounded accent-white cursor-pointer" />
              <span className="text-xs text-neutral-600">현재 페이지 전체 선택</span>
            </div>

            <div className="space-y-3">
              {questions.map((q) => (
                <div key={q.id} className="bg-[#111111] border border-neutral-800 rounded-lg p-4">
                  <div className="flex items-start gap-3 mb-2">
                    <input type="checkbox" checked={selectedIds.has(q.id)} onChange={() => toggleSelectBoard(q.id)}
                      className="w-3.5 h-3.5 rounded accent-white cursor-pointer mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs text-neutral-500 border border-neutral-800 rounded px-2 py-0.5">
                          {CATEGORY_LABEL[q.category] ?? q.category}
                        </span>
                        <span className={`text-xs border rounded px-2 py-0.5 ${STATUS_CLASS[q.status] ?? 'text-neutral-400 border-neutral-700'}`}>
                          {STATUS_LABEL[q.status] ?? q.status}
                        </span>
                        <span className="text-xs text-neutral-600 ml-auto">
                          {q.author?.nickname ?? q.author?.email ?? '익명'}
                          {' · '}
                          {new Date(q.createdAt).toLocaleDateString('ko-KR')}
                        </span>
                      </div>
                      <p className="text-sm text-neutral-200 mb-3 leading-relaxed">
                        {q.question.length > 100 ? q.question.slice(0, 100) + '…' : q.question}
                      </p>
                      <div className="flex gap-2 flex-wrap">
                        <button onClick={() => openEdit(q)}
                          className="rounded-md bg-[#1a1a1a] border border-neutral-700 text-neutral-300 text-xs px-3 py-1.5 hover:text-white transition-colors">
                          수정
                        </button>
                        {q.status !== 'BLINDED' ? (
                          <button
                            onClick={() => requestConfirm('이 문제를 블라인드 처리하시겠습니까?', () => handleAction(q.id, 'blind'))}
                            disabled={actionLoading === q.id + ':blind' || q.status === 'OFFICIAL'}
                            className="rounded-md bg-[#1a1a1a] border border-neutral-700 text-neutral-400 text-xs px-3 py-1.5 hover:text-white transition-colors disabled:opacity-30">
                            블라인드
                          </button>
                        ) : (
                          <button
                            onClick={() => requestConfirm('이 문제를 공개 처리하시겠습니까?', () => handleAction(q.id, 'unblind'))}
                            disabled={actionLoading === q.id + ':unblind'}
                            className="rounded-md bg-green-500/10 border border-green-500/30 text-green-400 text-xs px-3 py-1.5 hover:bg-green-500/20 transition-colors disabled:opacity-40">
                            공개
                          </button>
                        )}
                        <button
                          onClick={() => requestConfirm('이 문제를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.', () => handleAction(q.id, 'delete'))}
                          disabled={actionLoading === q.id + ':delete'}
                          className="rounded-md bg-red-500/10 border border-red-500/30 text-red-400 text-xs px-3 py-1.5 hover:bg-red-500/20 transition-colors disabled:opacity-40">
                          삭제
                        </button>
                        <a href={`/board/${q.id}`} target="_blank" rel="noreferrer"
                          className="rounded-md border border-neutral-800 text-neutral-500 text-xs px-3 py-1.5 hover:text-white transition-colors">
                          보기
                        </a>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            {pageCount > 1 && (
              <div className="flex gap-2 mt-4 justify-center items-center">
                <button onClick={() => { setPage((p) => Math.max(1, p - 1)); setSelectedIds(new Set()); }} disabled={page === 1}
                  className="rounded-md border border-neutral-800 text-neutral-400 text-xs px-3 py-1.5 hover:text-white disabled:opacity-30 transition-colors">
                  이전
                </button>
                <span className="text-xs text-neutral-500">{page} / {pageCount}</span>
                <button onClick={() => { setPage((p) => Math.min(pageCount, p + 1)); setSelectedIds(new Set()); }} disabled={page >= pageCount}
                  className="rounded-md border border-neutral-800 text-neutral-400 text-xs px-3 py-1.5 hover:text-white disabled:opacity-30 transition-colors">
                  다음
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {editState && (
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
                onClick={() => setEditState(null)}
                className="rounded-md border border-neutral-700 text-sm text-neutral-300 px-5 py-2 hover:text-white transition-colors"
              >
                취소
              </button>
              <button
                onClick={() => requestConfirm('문제를 수정하시겠습니까?', saveEdit)}
                disabled={editSaving}
                className="rounded-md bg-white text-black text-sm font-medium px-5 py-2 hover:bg-neutral-200 disabled:opacity-40 transition-colors"
              >
                {editSaving ? '저장 중...' : '저장'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

const REPORTS_PAGE_SIZE = 10;

function ReportsTab({ prevSeenAt }: { prevSeenAt: string | null }) {
  const queryClient = useQueryClient();
  const [reasonFilter, setReasonFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'pending' | 'dismissed' | 'all'>('pending');
  const [sortOrder, setSortOrder] = useState<'count' | 'asc'>('count');
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkPending, setBulkPending] = useState(false);

  const { data: reportGroups = [] } = useQuery<ReportGroup[]>({
    queryKey: ['admin', 'reports'],
    queryFn: async () => { const r = await fetch('/api/admin/reports'); if (!r.ok) return []; return r.json(); },
  });

  const mutation = useMutation({
    mutationFn: ({ questionId, action }: { questionId: string; action: 'blind' | 'dismiss' }) =>
      fetch(`/api/admin/reports/${questionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      }).then((r) => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'reports'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'badge'] });
      setSelectedIds(new Set());
    },
  });

  const filtered = reportGroups
    .filter((g) => {
      if (statusFilter === 'pending' && g.dismissed) return false;
      if (statusFilter === 'dismissed' && !g.dismissed) return false;
      return !reasonFilter || g.reports.some((r) => r.reason === reasonFilter);
    })
    .sort((a, b) => sortOrder === 'count' ? b.reportCount - a.reportCount : a.reportCount - b.reportCount);

  const pageCount = Math.max(1, Math.ceil(filtered.length / REPORTS_PAGE_SIZE));
  const paged = filtered.slice((page - 1) * REPORTS_PAGE_SIZE, page * REPORTS_PAGE_SIZE);
  const pendingCount = reportGroups.filter((g) => !g.dismissed).length;
  const dismissedCount = reportGroups.filter((g) => g.dismissed).length;

  function toggleSelect(id: string) {
    setSelectedIds((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  }
  function toggleAll() {
    const pageIds = paged.filter((g) => !g.dismissed).map((g) => g.question.id);
    const allSel = pageIds.every((id) => selectedIds.has(id));
    setSelectedIds(allSel ? new Set() : new Set(pageIds));
  }
  async function handleBulk(action: 'blind' | 'dismiss') {
    if (selectedIds.size === 0 || bulkPending) return;
    setBulkPending(true);
    try {
      await fetch('/api/admin/reports/bulk', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ questionIds: [...selectedIds], action }) });
      queryClient.invalidateQueries({ queryKey: ['admin', 'reports'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'badge'] });
      setSelectedIds(new Set());
    } finally { setBulkPending(false); }
  }

  const pageSelectableIds = paged.filter((g) => !g.dismissed).map((g) => g.question.id);
  const allPageSelected = pageSelectableIds.length > 0 && pageSelectableIds.every((id) => selectedIds.has(id));

  return (
    <div className="space-y-4">
      <div className="flex gap-1">
        {([
          { key: 'pending', label: `대기 중 ${pendingCount}` },
          { key: 'dismissed', label: `무시됨 ${dismissedCount}` },
          { key: 'all', label: '전체' },
        ] as const).map(({ key, label }) => (
          <button key={key} onClick={() => { setStatusFilter(key); setPage(1); setSelectedIds(new Set()); }}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${statusFilter === key ? 'bg-white text-black' : 'text-neutral-400 hover:text-white border border-neutral-800 hover:border-neutral-600'}`}>
            {label}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <select value={reasonFilter} onChange={(e) => { setReasonFilter(e.target.value); setPage(1); setSelectedIds(new Set()); }}
          className="bg-[#1a1a1a] border border-neutral-700 rounded-md px-3 py-1.5 text-sm text-white focus:outline-none focus:border-neutral-500">
          <option value="">전체 사유</option>
          {Object.entries(REASON_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <select value={sortOrder} onChange={(e) => { setSortOrder(e.target.value as 'count' | 'asc'); setPage(1); setSelectedIds(new Set()); }}
          className="bg-[#1a1a1a] border border-neutral-700 rounded-md px-3 py-1.5 text-sm text-white focus:outline-none focus:border-neutral-500">
          <option value="count">신고 많은 순</option>
          <option value="asc">신고 적은 순</option>
        </select>
        <span className="text-xs text-neutral-500">{filtered.length}건</span>
      </div>

      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 bg-neutral-900 border border-neutral-700 rounded-lg px-4 py-2.5">
          <span className="text-xs text-neutral-300">{selectedIds.size}개 선택됨</span>
          <button onClick={() => handleBulk('blind')} disabled={bulkPending}
            className="rounded-md bg-red-500/10 border border-red-500/30 text-red-400 text-xs px-3 py-1.5 hover:bg-red-500/20 transition-colors disabled:opacity-40">
            일괄 블라인드
          </button>
          <button onClick={() => handleBulk('dismiss')} disabled={bulkPending}
            className="rounded-md bg-[#1a1a1a] border border-neutral-700 text-neutral-400 text-xs px-3 py-1.5 hover:text-white transition-colors disabled:opacity-40">
            일괄 무시
          </button>
          <button onClick={() => setSelectedIds(new Set())} className="ml-auto text-xs text-neutral-600 hover:text-neutral-400 transition-colors">선택 해제</button>
        </div>
      )}

      {filtered.length === 0 ? (
        <p className="text-neutral-500 text-sm text-center py-8">
          {statusFilter === 'dismissed' ? '무시 처리된 신고가 없습니다.' : '처리할 신고가 없습니다.'}
        </p>
      ) : (
        <>
          {statusFilter !== 'dismissed' && pageSelectableIds.length > 0 && (
            <div className="flex items-center gap-2 px-1">
              <input type="checkbox" checked={allPageSelected} onChange={toggleAll} className="w-3.5 h-3.5 rounded accent-white cursor-pointer" />
              <span className="text-xs text-neutral-600">현재 페이지 전체 선택</span>
            </div>
          )}
          {paged.map((group) => (
            <div key={group.question.id}
              className={`border rounded-lg p-5 ${group.dismissed ? 'bg-neutral-900/50 border-neutral-800/50 opacity-70' : 'bg-[#111111] border-neutral-800'}`}>
              <div className="flex items-start gap-3 mb-3">
                {!group.dismissed && (
                  <input type="checkbox" checked={selectedIds.has(group.question.id)} onChange={() => toggleSelect(group.question.id)}
                    className="w-3.5 h-3.5 rounded accent-white cursor-pointer mt-1 flex-shrink-0" />
                )}
                <div className="flex items-start justify-between gap-4 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs text-neutral-500 border border-neutral-800 rounded px-2 py-0.5">
                      {CATEGORY_LABEL[group.question.category] ?? group.question.category}
                    </span>
                    <span className="text-xs text-neutral-500">신고 {group.reportCount}건</span>
                    {group.dismissed && <span className="text-xs text-neutral-500 border border-neutral-700 rounded px-1.5 py-0.5">무시됨</span>}
                    {group.question.status === 'BLINDED' && <span className="text-xs text-red-400 border border-red-500/30 rounded px-1.5 py-0.5">블라인드됨</span>}
                    {!group.dismissed && prevSeenAt && new Date(group.latestReportAt) > new Date(prevSeenAt) && (
                      <span className="text-[10px] font-bold text-amber-400 border border-amber-500/40 rounded px-1.5 py-0.5">NEW</span>
                    )}
                  </div>
                  <a href={`/board/${group.question.id}`} target="_blank" rel="noreferrer"
                    className="text-xs text-neutral-500 hover:text-white transition-colors underline flex-shrink-0">
                    문제 보기
                  </a>
                </div>
              </div>
              <p className="text-sm text-neutral-200 mb-3 leading-relaxed">
                {group.question.question.length > 80 ? group.question.question.slice(0, 80) + '…' : group.question.question}
              </p>
              <div className="mb-4 space-y-1">
                {group.reports.map((r) => (
                  <div key={r.id} className="text-xs text-neutral-500 flex gap-2">
                    <span className="text-neutral-600">{r.reporter.nickname ?? '(탈퇴)'}</span>
                    <span>{REASON_LABEL[r.reason] ?? r.reason}</span>
                    {r.description && <span className="text-neutral-600">— {r.description}</span>}
                  </div>
                ))}
              </div>
              {!group.dismissed && (
                <div className="flex gap-2">
                  <button onClick={() => mutation.mutate({ questionId: group.question.id, action: 'blind' })}
                    disabled={mutation.isPending || group.question.status === 'BLINDED'}
                    className="rounded-md bg-red-500/10 border border-red-500/30 text-red-400 text-xs px-3 py-1.5 hover:bg-red-500/20 transition-colors disabled:opacity-40">
                    블라인드
                  </button>
                  <button onClick={() => mutation.mutate({ questionId: group.question.id, action: 'dismiss' })}
                    disabled={mutation.isPending}
                    className="rounded-md bg-[#1a1a1a] border border-neutral-700 text-neutral-400 text-xs px-3 py-1.5 hover:text-white transition-colors disabled:opacity-40">
                    무시
                  </button>
                </div>
              )}
            </div>
          ))}
          {pageCount > 1 && (
            <div className="flex gap-2 mt-4 justify-center items-center">
              <button onClick={() => { setPage((p) => Math.max(1, p - 1)); setSelectedIds(new Set()); }} disabled={page === 1}
                className="rounded-md border border-neutral-800 text-neutral-400 text-xs px-3 py-1.5 hover:text-white disabled:opacity-30 transition-colors">
                이전
              </button>
              <span className="text-xs text-neutral-500">{page} / {pageCount}</span>
              <button onClick={() => { setPage((p) => Math.min(pageCount, p + 1)); setSelectedIds(new Set()); }} disabled={page >= pageCount}
                className="rounded-md border border-neutral-800 text-neutral-400 text-xs px-3 py-1.5 hover:text-white disabled:opacity-30 transition-colors">
                다음
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

const USERS_PAGE_SIZE = 20;

function UsersTab({ currentUserId, requestConfirm }: { currentUserId: string; requestConfirm: (msg: string, fn: () => void) => void }) {
  const queryClient = useQueryClient();
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'ADMIN' | 'USER'>('all');
  const [statusFilter, setUserStatusFilter] = useState<'all' | 'active' | 'deactivated'>('all');
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkPending, setBulkPending] = useState(false);

  const { data: users = [] } = useQuery<AdminUser[]>({
    queryKey: ['admin', 'users'],
    queryFn: async () => { const r = await fetch('/api/admin/users'); if (!r.ok) return []; return r.json(); },
  });

  const filteredUsers = users.filter((u) => {
    const q = search.trim().toLowerCase();
    if (q && !u.nickname?.toLowerCase().includes(q) && !u.email.toLowerCase().includes(q)) return false;
    if (roleFilter !== 'all' && u.role !== roleFilter) return false;
    if (statusFilter === 'active' && u.deletedAt !== null) return false;
    if (statusFilter === 'deactivated' && u.deletedAt === null) return false;
    return true;
  });

  const pageCount = Math.max(1, Math.ceil(filteredUsers.length / USERS_PAGE_SIZE));
  const pagedUsers = filteredUsers.slice((page - 1) * USERS_PAGE_SIZE, page * USERS_PAGE_SIZE);

  async function doAction(userId: string, action: 'set-admin' | 'set-user' | 'deactivate' | 'reactivate') {
    setActionLoading(userId + ':' + action);
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      if (res.ok) {
        if (action === 'set-admin' || action === 'set-user') {
          toast.success('권한이 변경되었습니다.');
        } else if (action === 'deactivate') {
          toast.success('탈퇴 처리되었습니다.');
        } else {
          toast.success('계정이 복구되었습니다.');
        }
        queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
        setSelectedIds(new Set());
      } else {
        const data = await res.json() as { error?: string };
        toast.error(data.error ?? '처리에 실패했습니다.');
      }
    } finally {
      setActionLoading(null);
    }
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  }
  function toggleAll() {
    const pageIds = pagedUsers.filter((u) => u.id !== currentUserId).map((u) => u.id);
    const allSel = pageIds.every((id) => selectedIds.has(id));
    setSelectedIds(allSel ? new Set() : new Set(pageIds));
  }
  async function handleBulk(action: 'deactivate' | 'reactivate') {
    if (selectedIds.size === 0 || bulkPending) return;
    const label = action === 'deactivate' ? '탈퇴 처리' : '복구';
    requestConfirm(`선택된 ${selectedIds.size}명을 ${label}하시겠습니까?`, async () => {
      setBulkPending(true);
      try {
        await fetch('/api/admin/users/bulk', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids: [...selectedIds], action }) });
        queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
        setSelectedIds(new Set());
        toast.success(`${label} 완료`);
      } finally { setBulkPending(false); }
    });
  }

  const pageSelectableIds = pagedUsers.filter((u) => u.id !== currentUserId).map((u) => u.id);
  const allPageSelected = pageSelectableIds.length > 0 && pageSelectableIds.every((id) => selectedIds.has(id));

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-4">
        <input type="text" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); setSelectedIds(new Set()); }}
          placeholder="닉네임 또는 이메일 검색..."
          className="flex-1 min-w-40 bg-[#1a1a1a] border border-neutral-700 rounded-md px-3 py-1.5 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-neutral-500"
        />
        <div className="flex gap-1.5">
          {(['all', 'ADMIN', 'USER'] as const).map((r) => (
            <button key={r} onClick={() => { setRoleFilter(r); setPage(1); setSelectedIds(new Set()); }}
              className={`rounded px-3 py-1.5 text-xs transition-colors ${roleFilter === r ? 'border border-neutral-500 text-white' : 'border border-neutral-800 text-neutral-500 hover:text-neutral-300'}`}>
              {r === 'all' ? '전체 역할' : r}
            </button>
          ))}
        </div>
        <div className="flex gap-1.5">
          {([['all', '전체'], ['active', '활성'], ['deactivated', '탈퇴']] as const).map(([v, l]) => (
            <button key={v} onClick={() => { setUserStatusFilter(v); setPage(1); setSelectedIds(new Set()); }}
              className={`rounded px-3 py-1.5 text-xs transition-colors ${statusFilter === v ? 'border border-neutral-500 text-white' : 'border border-neutral-800 text-neutral-500 hover:text-neutral-300'}`}>
              {l}
            </button>
          ))}
        </div>
      </div>

      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 bg-neutral-900 border border-neutral-700 rounded-lg px-4 py-2.5 mb-3">
          <span className="text-xs text-neutral-300">{selectedIds.size}명 선택됨</span>
          <button onClick={() => handleBulk('deactivate')} disabled={bulkPending}
            className="rounded-md bg-red-500/10 border border-red-500/30 text-red-400 text-xs px-3 py-1.5 hover:bg-red-500/20 transition-colors disabled:opacity-40">
            일괄 탈퇴처리
          </button>
          <button onClick={() => handleBulk('reactivate')} disabled={bulkPending}
            className="rounded-md bg-green-500/10 border border-green-500/30 text-green-400 text-xs px-3 py-1.5 hover:bg-green-500/20 transition-colors disabled:opacity-40">
            일괄 복구
          </button>
          <button onClick={() => setSelectedIds(new Set())} className="ml-auto text-xs text-neutral-600 hover:text-neutral-400 transition-colors">선택 해제</button>
        </div>
      )}

      {filteredUsers.length === 0 ? (
        <p className="text-neutral-500 text-sm text-center py-8">
          {users.length === 0 ? '유저가 없습니다.' : '검색 결과가 없습니다.'}
        </p>
      ) : (
        <>
          <div className="flex items-center gap-2 px-1 mb-2">
            <input type="checkbox" checked={allPageSelected} onChange={toggleAll} className="w-3.5 h-3.5 rounded accent-white cursor-pointer" />
            <span className="text-xs text-neutral-600">현재 페이지 전체 선택</span>
            <span className="ml-auto text-xs text-neutral-600">{filteredUsers.length}명</span>
          </div>
          <div className="space-y-3">
            {pagedUsers.map((u) => {
              const isDeactivated = u.deletedAt !== null;
              const isSelf = u.id === currentUserId;
              return (
                <div key={u.id}
                  className={`bg-[#111111] border rounded-lg p-4 ${isDeactivated ? 'border-neutral-800/50 opacity-60' : 'border-neutral-800'}`}>
                  <div className="flex items-center gap-3">
                    <input type="checkbox" checked={selectedIds.has(u.id)} onChange={() => toggleSelect(u.id)} disabled={isSelf}
                      className="w-3.5 h-3.5 rounded accent-white cursor-pointer flex-shrink-0 disabled:opacity-30" />
                    <div className="flex items-center justify-between gap-4 flex-1">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-sm font-medium ${isDeactivated ? 'text-neutral-500' : 'text-white'}`}>
                            {u.nickname ?? '(닉네임 미설정)'}
                          </span>
                          {u.role === 'ADMIN' && <span className="text-xs text-amber-400 border border-amber-400/30 rounded px-1.5 py-0.5">ADMIN</span>}
                          {isDeactivated && <span className="text-xs text-neutral-500 border border-neutral-700 rounded px-1.5 py-0.5">탈퇴</span>}
                          {isSelf && <span className="text-xs text-neutral-600 border border-neutral-800 rounded px-1.5 py-0.5">나</span>}
                        </div>
                        <p className="text-xs text-neutral-500">
                          {u.email} · 퀴즈 {u._count.quizSessions}회 · 가입{' '}
                          {new Date(u.createdAt).toLocaleDateString('ko-KR')}
                        </p>
                      </div>
                      <div className="flex gap-2 flex-shrink-0 flex-wrap justify-end">
                        {!isDeactivated && (
                          <button
                            onClick={() => {
                              const isAdmin = u.role === 'ADMIN';
                              requestConfirm(
                                isAdmin ? `'${u.nickname ?? u.email}'을 일반 사용자로 변경하시겠습니까?` : `'${u.nickname ?? u.email}'을 관리자로 변경하시겠습니까?`,
                                () => doAction(u.id, isAdmin ? 'set-user' : 'set-admin'),
                              );
                            }}
                            disabled={!!actionLoading || isSelf}
                            className={`rounded-md text-xs px-3 py-1.5 transition-colors disabled:opacity-40 ${u.role === 'ADMIN' ? 'bg-[#1a1a1a] border border-neutral-700 text-neutral-400 hover:text-white' : 'bg-amber-500/10 border border-amber-500/30 text-amber-400 hover:bg-amber-500/20'}`}>
                            {u.role === 'ADMIN' ? '일반으로' : '관리자로'}
                          </button>
                        )}
                        {isDeactivated ? (
                          <button onClick={() => requestConfirm(`'${u.nickname ?? u.email}' 계정을 복구하시겠습니까?`, () => doAction(u.id, 'reactivate'))}
                            disabled={!!actionLoading}
                            className="rounded-md bg-green-500/10 border border-green-500/30 text-green-400 text-xs px-3 py-1.5 hover:bg-green-500/20 transition-colors disabled:opacity-40">
                            복구
                          </button>
                        ) : (
                          <button onClick={() => requestConfirm(`'${u.nickname ?? u.email}'을 탈퇴 처리하시겠습니까?`, () => doAction(u.id, 'deactivate'))}
                            disabled={!!actionLoading || isSelf}
                            className="rounded-md bg-red-500/10 border border-red-500/30 text-red-400 text-xs px-3 py-1.5 hover:bg-red-500/20 transition-colors disabled:opacity-40">
                            탈퇴처리
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          {pageCount > 1 && (
            <div className="flex gap-2 mt-4 justify-center items-center">
              <button onClick={() => { setPage((p) => Math.max(1, p - 1)); setSelectedIds(new Set()); }} disabled={page === 1}
                className="rounded-md border border-neutral-800 text-neutral-400 text-xs px-3 py-1.5 hover:text-white disabled:opacity-30 transition-colors">
                이전
              </button>
              <span className="text-xs text-neutral-500">{page} / {pageCount}</span>
              <button onClick={() => { setPage((p) => Math.min(pageCount, p + 1)); setSelectedIds(new Set()); }} disabled={page >= pageCount}
                className="rounded-md border border-neutral-800 text-neutral-400 text-xs px-3 py-1.5 hover:text-white disabled:opacity-30 transition-colors">
                다음
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

const INQUIRY_TYPE_LABEL: Record<string, string> = {
  BUG_REPORT: '버그 신고', ACCOUNT_ISSUE: '계정 문제',
  CONTENT_ISSUE: '콘텐츠 오류', SUGGESTION: '기능 제안', OTHER: '기타',
};
const INQUIRY_STATUS_CONFIG: Record<string, { label: string; cls: string }> = {
  PENDING:     { label: '대기 중',   cls: 'text-amber-400 border-amber-500/30' },
  IN_PROGRESS: { label: '처리 중',   cls: 'text-blue-400 border-blue-500/30' },
  RESOLVED:    { label: '해결 완료', cls: 'text-green-400 border-green-500/30' },
};

interface AdminInquiry {
  id: string; type: string; title: string; content: string;
  status: string; adminReply: string | null; repliedAt: string | null; createdAt: string;
  user: { id: string; nickname: string | null; email: string };
}

const INQUIRIES_PAGE_SIZE = 10;

function InquiriesTab({ prevSeenAt }: { prevSeenAt: string | null }) {
  const queryClient = useQueryClient();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [replyDraft, setReplyDraft] = useState<Record<string, string>>({});
  const [statusDraft, setStatusDraft] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [sortOrder, setSortInquiryOrder] = useState<'newest' | 'oldest'>('newest');
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkPending, setBulkPending] = useState(false);

  const { data: inquiries = [], isLoading } = useQuery<AdminInquiry[]>({
    queryKey: ['admin', 'inquiries'],
    queryFn: async () => { const r = await fetch('/api/admin/inquiries'); if (!r.ok) return []; return r.json(); },
  });

  const filtered = inquiries
    .filter((i) => (!statusFilter || i.status === statusFilter) && (!typeFilter || i.type === typeFilter))
    .sort((a, b) => {
      const diff = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      return sortOrder === 'newest' ? -diff : diff;
    });

  const pageCount = Math.max(1, Math.ceil(filtered.length / INQUIRIES_PAGE_SIZE));
  const paged = filtered.slice((page - 1) * INQUIRIES_PAGE_SIZE, page * INQUIRIES_PAGE_SIZE);

  async function handleSave(inq: AdminInquiry) {
    setSaving(inq.id);
    try {
      const reply = replyDraft[inq.id] ?? inq.adminReply ?? '';
      const status = statusDraft[inq.id] ?? inq.status;
      const res = await fetch(`/api/admin/inquiries/${inq.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminReply: reply, status }),
      });
      if (res.ok) {
        toast.success('저장되었습니다.');
        queryClient.invalidateQueries({ queryKey: ['admin', 'inquiries'] });
        queryClient.invalidateQueries({ queryKey: ['admin', 'badge'] });
        setReplyDraft((d) => { const n = { ...d }; delete n[inq.id]; return n; });
        setStatusDraft((d) => { const n = { ...d }; delete n[inq.id]; return n; });
      } else {
        toast.error('저장에 실패했습니다.');
      }
    } finally {
      setSaving(null);
    }
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  }
  function toggleAll() {
    const pageIds = paged.map((i) => i.id);
    const allSel = pageIds.every((id) => selectedIds.has(id));
    setSelectedIds(allSel ? new Set() : new Set(pageIds));
  }
  async function handleBulkStatus(status: 'IN_PROGRESS' | 'RESOLVED') {
    if (selectedIds.size === 0 || bulkPending) return;
    setBulkPending(true);
    try {
      await fetch('/api/admin/inquiries/bulk', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids: [...selectedIds], status }) });
      queryClient.invalidateQueries({ queryKey: ['admin', 'inquiries'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'badge'] });
      setSelectedIds(new Set());
      toast.success('일괄 상태 변경 완료');
    } finally { setBulkPending(false); }
  }

  const allPageSelected = paged.length > 0 && paged.every((i) => selectedIds.has(i.id));

  if (isLoading) return <p className="text-neutral-500 text-sm text-center py-8">로딩 중...</p>;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 flex-wrap">
        <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); setSelectedIds(new Set()); }}
          className="bg-[#1a1a1a] border border-neutral-700 rounded-md px-3 py-1.5 text-sm text-white focus:outline-none focus:border-neutral-500">
          <option value="">전체 상태</option>
          <option value="PENDING">대기 중</option>
          <option value="IN_PROGRESS">처리 중</option>
          <option value="RESOLVED">해결 완료</option>
        </select>
        <select value={typeFilter} onChange={(e) => { setTypeFilter(e.target.value); setPage(1); setSelectedIds(new Set()); }}
          className="bg-[#1a1a1a] border border-neutral-700 rounded-md px-3 py-1.5 text-sm text-white focus:outline-none focus:border-neutral-500">
          <option value="">전체 유형</option>
          {Object.entries(INQUIRY_TYPE_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <select value={sortOrder} onChange={(e) => { setSortInquiryOrder(e.target.value as 'newest' | 'oldest'); setPage(1); setSelectedIds(new Set()); }}
          className="bg-[#1a1a1a] border border-neutral-700 rounded-md px-3 py-1.5 text-sm text-white focus:outline-none focus:border-neutral-500">
          <option value="newest">최신순</option>
          <option value="oldest">오래된순</option>
        </select>
        <span className="text-xs text-neutral-500">{filtered.length}건</span>
      </div>

      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 bg-neutral-900 border border-neutral-700 rounded-lg px-4 py-2.5">
          <span className="text-xs text-neutral-300">{selectedIds.size}개 선택됨</span>
          <button onClick={() => handleBulkStatus('IN_PROGRESS')} disabled={bulkPending}
            className="rounded-md bg-blue-500/10 border border-blue-500/30 text-blue-400 text-xs px-3 py-1.5 hover:bg-blue-500/20 transition-colors disabled:opacity-40">
            일괄 처리 중
          </button>
          <button onClick={() => handleBulkStatus('RESOLVED')} disabled={bulkPending}
            className="rounded-md bg-green-500/10 border border-green-500/30 text-green-400 text-xs px-3 py-1.5 hover:bg-green-500/20 transition-colors disabled:opacity-40">
            일괄 해결 완료
          </button>
          <button onClick={() => setSelectedIds(new Set())} className="ml-auto text-xs text-neutral-600 hover:text-neutral-400 transition-colors">선택 해제</button>
        </div>
      )}

      {filtered.length === 0 ? (
        <p className="text-neutral-500 text-sm text-center py-8">접수된 문의가 없습니다.</p>
      ) : (
        <>
          <div className="flex items-center gap-2 px-1">
            <input type="checkbox" checked={allPageSelected} onChange={toggleAll} className="w-3.5 h-3.5 rounded accent-white cursor-pointer" />
            <span className="text-xs text-neutral-600">현재 페이지 전체 선택</span>
          </div>
          {paged.map((inq) => {
            const expanded = expandedId === inq.id;
            const sc = INQUIRY_STATUS_CONFIG[inq.status] ?? { label: inq.status, cls: 'text-neutral-400 border-neutral-700' };
            const currentReply = replyDraft[inq.id] ?? inq.adminReply ?? '';
            const currentStatus = statusDraft[inq.id] ?? inq.status;

            return (
              <div key={inq.id} className="bg-[#111111] border border-neutral-800 rounded-xl overflow-hidden">
                <div className="flex items-start gap-3 px-4 pt-3">
                  <input type="checkbox" checked={selectedIds.has(inq.id)} onChange={() => toggleSelect(inq.id)}
                    className="w-3.5 h-3.5 rounded accent-white cursor-pointer mt-1.5 flex-shrink-0" />
                  <button onClick={() => setExpandedId(expanded ? null : inq.id)}
                    className="flex-1 text-left pb-3 hover:text-white transition-colors">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs text-neutral-500 border border-neutral-800 rounded-full px-2 py-0.5">
                        {INQUIRY_TYPE_LABEL[inq.type] ?? inq.type}
                      </span>
                      <span className={`text-xs border rounded-full px-2 py-0.5 ${sc.cls}`}>{sc.label}</span>
                      {inq.adminReply && (
                        <span className="text-xs text-emerald-400 border border-emerald-500/30 rounded-full px-2 py-0.5">답변 완료</span>
                      )}
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-white">{inq.title}</p>
                          {prevSeenAt && new Date(inq.createdAt) > new Date(prevSeenAt) && inq.status === 'PENDING' && (
                            <span className="text-[10px] font-bold text-amber-400 border border-amber-500/40 rounded px-1.5 py-0.5">NEW</span>
                          )}
                        </div>
                        <p className="text-xs text-neutral-500 mt-0.5">
                          {inq.user.nickname ?? inq.user.email} · {new Date(inq.createdAt).toLocaleDateString('ko-KR')}
                        </p>
                      </div>
                      <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
                        className={`flex-shrink-0 text-neutral-600 transition-transform ${expanded ? 'rotate-180' : ''}`}>
                        <path d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </button>
                </div>

                {expanded && (
                  <div className="border-t border-neutral-800 px-5 py-5 space-y-5">
                    <div>
                      <p className="text-xs text-neutral-500 mb-1.5">문의 내용</p>
                      <p className="text-sm text-neutral-300 leading-relaxed whitespace-pre-wrap">{inq.content}</p>
                    </div>
                    <div className="border-t border-neutral-800 pt-4 space-y-3">
                      <div className="flex items-center gap-3">
                        <p className="text-xs text-neutral-400 font-medium">답변 및 상태</p>
                        <select value={currentStatus} onChange={(e) => setStatusDraft((d) => ({ ...d, [inq.id]: e.target.value }))}
                          className="bg-[#1a1a1a] border border-neutral-700 rounded-md px-2 py-1 text-xs text-neutral-300 focus:outline-none focus:border-neutral-500">
                          <option value="PENDING">대기 중</option>
                          <option value="IN_PROGRESS">처리 중</option>
                          <option value="RESOLVED">해결 완료</option>
                        </select>
                      </div>
                      <textarea value={currentReply} onChange={(e) => setReplyDraft((d) => ({ ...d, [inq.id]: e.target.value }))}
                        rows={4} placeholder="답변을 입력하세요..."
                        className="w-full bg-[#1a1a1a] border border-neutral-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-neutral-500 resize-none" />
                      <button onClick={() => handleSave(inq)} disabled={saving === inq.id}
                        className="rounded-md bg-white text-black text-xs font-semibold px-4 py-2 hover:bg-neutral-200 disabled:opacity-40 transition-colors">
                        {saving === inq.id ? '저장 중...' : '저장'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          {pageCount > 1 && (
            <div className="flex gap-2 mt-4 justify-center items-center">
              <button onClick={() => { setPage((p) => Math.max(1, p - 1)); setExpandedId(null); setSelectedIds(new Set()); }} disabled={page === 1}
                className="rounded-md border border-neutral-800 text-neutral-400 text-xs px-3 py-1.5 hover:text-white disabled:opacity-30 transition-colors">
                이전
              </button>
              <span className="text-xs text-neutral-500">{page} / {pageCount}</span>
              <button onClick={() => { setPage((p) => Math.min(pageCount, p + 1)); setExpandedId(null); setSelectedIds(new Set()); }} disabled={page >= pageCount}
                className="rounded-md border border-neutral-800 text-neutral-400 text-xs px-3 py-1.5 hover:text-white disabled:opacity-30 transition-colors">
                다음
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function ConfirmDialog({ message, onConfirm, onCancel }: {
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

const ACTION_LABEL: Record<string, string> = {
  LOGIN: '로그인',
  LOGIN_FAIL: '로그인 실패',
  QUESTION_SUBMIT: '문제 제출',
  QUESTION_APPROVE: '문제 승인',
  QUESTION_REJECT: '문제 거절',
  QUESTION_BLIND: '문제 블라인드',
  QUESTION_UNBLIND: '블라인드 해제',
  QUESTION_DELETE: '문제 삭제',
  QUESTION_EDIT: '문제 수정',
  REPORT_BLIND: '신고→블라인드',
  REPORT_DISMISS: '신고 무시',
  USER_ROLE_CHANGE: '권한 변경',
  USER_DEACTIVATE: '계정 비활성화',
  USER_REACTIVATE: '계정 복구',
  USER_DELETE: '계정 삭제',
  NICKNAME_CHANGE: '닉네임 변경',
  INQUIRY_REPLY: '문의 답변',
  INQUIRY_STATUS_CHANGE: '문의 상태 변경',
};

const ACTION_COLOR: Record<string, string> = {
  LOGIN: 'text-blue-400 border-blue-500/30',
  LOGIN_FAIL: 'text-red-400 border-red-500/30',
  QUESTION_SUBMIT: 'text-cyan-400 border-cyan-500/30',
  QUESTION_APPROVE: 'text-green-400 border-green-500/30',
  QUESTION_REJECT: 'text-red-400 border-red-500/30',
  QUESTION_BLIND: 'text-orange-400 border-orange-500/30',
  QUESTION_UNBLIND: 'text-neutral-400 border-neutral-600',
  QUESTION_DELETE: 'text-red-500 border-red-600/40',
  QUESTION_EDIT: 'text-sky-400 border-sky-500/30',
  REPORT_BLIND: 'text-orange-400 border-orange-500/30',
  REPORT_DISMISS: 'text-neutral-400 border-neutral-600',
  USER_ROLE_CHANGE: 'text-amber-400 border-amber-500/30',
  USER_DEACTIVATE: 'text-red-400 border-red-500/30',
  USER_REACTIVATE: 'text-green-400 border-green-500/30',
  USER_DELETE: 'text-red-600 border-red-700/50',
  NICKNAME_CHANGE: 'text-violet-400 border-violet-500/30',
  INQUIRY_REPLY: 'text-sky-400 border-sky-500/30',
  INQUIRY_STATUS_CHANGE: 'text-neutral-400 border-neutral-600',
};

interface AuditLogItem {
  id: string;
  actorRole: string | null;
  action: string;
  targetType: string | null;
  targetId: string | null;
  payload: Record<string, unknown> | null;
  createdAt: string;
  actor: { email: string; nickname: string | null } | null;
}

interface LogsResponse {
  logs: AuditLogItem[];
  total: number;
  page: number;
  pageCount: number;
}

function UserCombobox({ users, value, onChange }: { users: AdminUser[]; value: string; onChange: (id: string) => void }) {
  const [inputVal, setInputVal] = useState('');
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const selectedUser = users.find((u) => u.id === value);
  const displayVal = selectedUser ? (selectedUser.nickname ?? selectedUser.email) : '';

  const filtered = inputVal.trim()
    ? users.filter((u) =>
        (u.nickname ?? '').toLowerCase().includes(inputVal.toLowerCase()) ||
        u.email.toLowerCase().includes(inputVal.toLowerCase())
      ).slice(0, 20)
    : users.slice(0, 20);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function select(id: string, label: string) {
    onChange(id);
    setInputVal(label);
    setOpen(false);
  }

  function clear() {
    onChange('');
    setInputVal('');
    setOpen(false);
  }

  return (
    <div ref={ref} className="relative">
      <div className="flex items-center bg-[#1a1a1a] border border-neutral-700 rounded-md px-3 py-1.5 gap-1.5 focus-within:border-neutral-500">
        <input
          type="text"
          placeholder={value ? displayVal : '유저 검색…'}
          value={open ? inputVal : (displayVal || inputVal)}
          onChange={(e) => { setInputVal(e.target.value); setOpen(true); }}
          onFocus={() => { setInputVal(''); setOpen(true); }}
          className="bg-transparent text-sm text-white placeholder-neutral-500 focus:outline-none w-32"
        />
        {value && (
          <button onClick={clear} className="text-neutral-600 hover:text-white text-xs leading-none">✕</button>
        )}
      </div>
      {open && (
        <div className="absolute z-20 top-full mt-1 left-0 w-56 bg-[#1a1a1a] border border-neutral-700 rounded-md shadow-xl max-h-52 overflow-y-auto">
          <button
            onMouseDown={() => clear()}
            className="w-full text-left px-3 py-2 text-xs text-neutral-500 hover:bg-neutral-800 transition-colors"
          >
            전체 유저
          </button>
          {filtered.map((u) => (
            <button
              key={u.id}
              onMouseDown={() => select(u.id, u.nickname ?? u.email)}
              className="w-full text-left px-3 py-2 text-xs text-neutral-300 hover:bg-neutral-800 transition-colors flex items-center gap-2"
            >
              <span>{u.nickname ?? u.email}</span>
              {u.role === 'ADMIN' && <span className="text-amber-500/70 text-[10px]">관리자</span>}
            </button>
          ))}
          {filtered.length === 0 && (
            <p className="px-3 py-2 text-xs text-neutral-600">결과 없음</p>
          )}
        </div>
      )}
    </div>
  );
}

const PAYLOAD_LABEL: Record<string, string> = {
  questionTitle: '문제',
  targetEmail: '대상 이메일',
  title: '제목',
  newRole: '변경된 권한',
  reason: '사유',
  status: '상태',
  fields: '수정 필드',
};

function LogDetailPanel({ log, onClose }: { log: AuditLogItem; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const payloadEntries = log.payload
    ? Object.entries(log.payload).filter(([, v]) => v !== null && v !== undefined)
    : [];

  function renderValue(key: string, val: unknown): string {
    if (Array.isArray(val)) return val.join(', ');
    return String(val);
  }

  return (
    <div className="fixed top-0 right-0 h-full w-80 bg-[#0f0f0f] border-l border-neutral-800 z-50 flex flex-col shadow-2xl">
      {/* 헤더 */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-800 flex-shrink-0">
        <span className={`text-xs border rounded px-2 py-1 font-medium ${ACTION_COLOR[log.action] ?? 'text-neutral-400 border-neutral-700'}`}>
          {ACTION_LABEL[log.action] ?? log.action}
        </span>
        <button onClick={onClose} className="text-neutral-500 hover:text-white transition-colors text-lg leading-none">✕</button>
      </div>

      {/* 내용 */}
      <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">
        {/* 시각 */}
        <div>
          <p className="text-[10px] text-neutral-600 uppercase tracking-wider mb-1">시각</p>
          <p className="text-sm text-neutral-200">
            {new Date(log.createdAt).toLocaleString('ko-KR', {
              year: 'numeric', month: '2-digit', day: '2-digit',
              hour: '2-digit', minute: '2-digit', second: '2-digit',
            })}
          </p>
        </div>

        {/* 행위자 */}
        <div>
          <p className="text-[10px] text-neutral-600 uppercase tracking-wider mb-1">행위자</p>
          {log.actor ? (
            <div className="space-y-0.5">
              <p className="text-sm text-neutral-200">{log.actor.nickname ?? '(닉네임 없음)'}</p>
              <p className="text-xs text-neutral-500">{log.actor.email}</p>
              {log.actorRole === 'ADMIN' && (
                <span className="text-[10px] text-amber-400 border border-amber-500/30 rounded px-1.5 py-0.5">관리자</span>
              )}
            </div>
          ) : (
            <p className="text-sm text-neutral-500">—</p>
          )}
        </div>

        {/* 대상 */}
        {(log.targetType || log.targetId) && (
          <div>
            <p className="text-[10px] text-neutral-600 uppercase tracking-wider mb-1">대상</p>
            <div className="space-y-0.5">
              {log.targetType && <p className="text-xs text-neutral-400">{log.targetType}</p>}
              {log.targetId && (
                <p className="text-xs text-neutral-600 font-mono break-all">{log.targetId}</p>
              )}
            </div>
          </div>
        )}

        {/* 상세 payload */}
        {payloadEntries.length > 0 && (
          <div>
            <p className="text-[10px] text-neutral-600 uppercase tracking-wider mb-2">상세 내용</p>
            <div className="space-y-3">
              {payloadEntries.map(([key, val]) => (
                <div key={key}>
                  <p className="text-[10px] text-neutral-600 mb-0.5">
                    {PAYLOAD_LABEL[key] ?? key}
                  </p>
                  <p className="text-sm text-neutral-300 break-words leading-relaxed">
                    {renderValue(key, val)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function LogsTab() {
  const [page, setPage] = useState(1);
  const [actionFilter, setActionFilter] = useState('');
  const [actorFilter, setActorFilter] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [selectedLog, setSelectedLog] = useState<AuditLogItem | null>(null);

  const { data: users = [] } = useQuery<AdminUser[]>({
    queryKey: ['admin', 'users'],
    queryFn: async () => { const r = await fetch('/api/admin/users'); if (!r.ok) return []; return r.json(); },
    staleTime: 60_000,
  });

  const { data, isFetching } = useQuery<LogsResponse>({
    queryKey: ['admin', 'logs', page, actionFilter, actorFilter, fromDate, toDate],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page) });
      if (actionFilter) params.set('action', actionFilter);
      if (actorFilter) params.set('actorId', actorFilter);
      if (fromDate) params.set('from', fromDate);
      if (toDate) params.set('to', toDate);
      const r = await fetch(`/api/admin/logs?${params}`);
      if (!r.ok) return { logs: [], total: 0, page: 1, pageCount: 1 };
      return r.json();
    },
    staleTime: 10_000,
  });

  const logs = data?.logs ?? [];
  const pageCount = data?.pageCount ?? 1;
  const total = data?.total ?? 0;

  function payloadSummary(log: AuditLogItem): string {
    if (!log.payload) return '';
    const p = log.payload;
    if (p.questionTitle) return String(p.questionTitle);
    if (p.targetEmail) return String(p.targetEmail);
    if (p.title) return String(p.title);
    if (p.newRole) return `→ ${String(p.newRole)}`;
    if (p.reason) return String(p.reason);
    return '';
  }

  return (
    <>
      <div className="space-y-4">
        <div className="flex items-center gap-3 flex-wrap">
          <select
            value={actionFilter}
            onChange={(e) => { setActionFilter(e.target.value); setPage(1); }}
            className="bg-[#1a1a1a] border border-neutral-700 rounded-md px-3 py-1.5 text-sm text-white focus:outline-none focus:border-neutral-500"
          >
            <option value="">전체 액션</option>
            {Object.entries(ACTION_LABEL).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
          <UserCombobox
            users={users}
            value={actorFilter}
            onChange={(id) => { setActorFilter(id); setPage(1); }}
          />
          <div className="flex items-center gap-1.5">
            <input
              type="date"
              value={fromDate}
              onChange={(e) => { setFromDate(e.target.value); setPage(1); }}
              className="bg-[#1a1a1a] border border-neutral-700 rounded-md px-2 py-1.5 text-xs text-neutral-300 focus:outline-none focus:border-neutral-500"
              title="시작일"
            />
            <span className="text-neutral-600 text-xs">~</span>
            <input
              type="date"
              value={toDate}
              onChange={(e) => { setToDate(e.target.value); setPage(1); }}
              className="bg-[#1a1a1a] border border-neutral-700 rounded-md px-2 py-1.5 text-xs text-neutral-300 focus:outline-none focus:border-neutral-500"
              title="종료일"
            />
            {(fromDate || toDate) && (
              <button
                onClick={() => { setFromDate(''); setToDate(''); setPage(1); }}
                className="text-xs text-neutral-600 hover:text-white transition-colors px-1"
                title="날짜 필터 초기화"
              >
                ✕
              </button>
            )}
          </div>
          <span className="text-xs text-neutral-500">총 {total}건</span>
          {isFetching && <span className="text-xs text-neutral-600">로딩 중...</span>}
          {selectedLog && (
            <button
              onClick={() => setSelectedLog(null)}
              className="ml-auto text-xs text-neutral-500 hover:text-white transition-colors"
            >
              패널 닫기 ✕
            </button>
          )}
        </div>

        {logs.length === 0 && !isFetching ? (
          <p className="text-neutral-500 text-sm text-center py-8">로그가 없습니다.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-neutral-500 border-b border-neutral-800">
                  <th className="text-left py-2 pr-4 font-medium">시각</th>
                  <th className="text-left py-2 pr-4 font-medium">액션</th>
                  <th className="text-left py-2 pr-4 font-medium">행위자</th>
                  <th className="text-left py-2 font-medium">대상 / 메모</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-900">
                {logs.map((log) => (
                  <tr
                    key={log.id}
                    onClick={() => setSelectedLog(log)}
                    className={`cursor-pointer transition-colors ${
                      selectedLog?.id === log.id
                        ? 'bg-neutral-800/60'
                        : 'hover:bg-neutral-900/40'
                    }`}
                  >
                    <td className="py-2.5 pr-4 text-neutral-600 whitespace-nowrap">
                      {new Date(log.createdAt).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </td>
                    <td className="py-2.5 pr-4 whitespace-nowrap">
                      <span className={`border rounded px-1.5 py-0.5 ${ACTION_COLOR[log.action] ?? 'text-neutral-400 border-neutral-700'}`}>
                        {ACTION_LABEL[log.action] ?? log.action}
                      </span>
                    </td>
                    <td className="py-2.5 pr-4 text-neutral-300 whitespace-nowrap">
                      {log.actor?.nickname ?? log.actor?.email ?? '—'}
                      {log.actorRole === 'ADMIN' && (
                        <span className="ml-1 text-amber-500/70">관리자</span>
                      )}
                    </td>
                    <td className="py-2.5 text-neutral-500 max-w-[200px] truncate">
                      {payloadSummary(log)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {pageCount > 1 && (
          <div className="flex items-center gap-2 pt-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="rounded border border-neutral-700 text-neutral-400 text-xs px-3 py-1.5 hover:text-white disabled:opacity-30 transition-colors"
            >
              이전
            </button>
            <span className="text-xs text-neutral-500">{page} / {pageCount}</span>
            <button
              onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
              disabled={page === pageCount}
              className="rounded border border-neutral-700 text-neutral-400 text-xs px-3 py-1.5 hover:text-white disabled:opacity-30 transition-colors"
            >
              다음
            </button>
          </div>
        )}
      </div>

      {/* 슬라이드 패널 */}
      <div className={`fixed top-0 right-0 h-full w-80 z-50 transition-transform duration-200 ease-in-out ${selectedLog ? 'translate-x-0' : 'translate-x-full'}`}>
        {selectedLog && <LogDetailPanel log={selectedLog} onClose={() => setSelectedLog(null)} />}
      </div>
    </>
  );
}

interface AnalyticsData {
  onlineNow: number;
  periodVisitors: number;
  periodAttempts: number;
  newUsersInPeriod: number;
  totalUsers: number;
  totalBattles: number;
  totalAttempts: number;
  questionStats: { official: number; approved: number; pending: number; rejected: number; blinded: number };
  inquiryStats: { pending: number; inProgress: number; resolved: number };
  reportStats: { pending: number; reviewed: number };
  chartVisits: { label: string; count: number }[];
  chartAttempts: { label: string; count: number }[];
  categoryStats: { category: string; attempts: number }[];
  todayVisitorList: { nickname: string | null; email: string }[];
}

type Period = 'day' | 'month' | 'year';

const PERIOD_LABEL: Record<Period, string> = { day: '일', month: '월', year: '년' };

function formatChartLabel(label: string, period: Period): string {
  if (period === 'year') return `${parseInt(label.slice(5))}월`;
  if (period === 'month') return label.slice(8);
  return label.slice(5).replace('-', '/');
}

function MiniBarChart({ data, color, period }: { data: { label: string; count: number }[]; color: string; period: Period }) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const maxCount = Math.max(...data.map((d) => d.count), 1);
  const MAX_BAR_PX = 72;
  const LABEL_H = 14;

  const showLabel = (i: number): boolean => {
    if (period === 'year') return true;
    const n = data.length;
    if (n <= 10) return true;
    if (n <= 20) return i % 5 === 0 || i === n - 1;
    return i % 7 === 0 || i === n - 1;
  };

  return (
    <div className="relative overflow-visible">
      <div className="flex items-end gap-px overflow-visible" style={{ height: `${MAX_BAR_PX}px` }}>
        {data.map((d, i) => {
          const barPx = d.count > 0 ? Math.max(Math.round((d.count / maxCount) * MAX_BAR_PX), 8) : 2;
          const isHovered = hoveredIdx === i;
          return (
            <div
              key={d.label}
              className="flex-1 flex flex-col items-center justify-end relative min-w-0"
              style={{ height: `${MAX_BAR_PX}px` }}
              onMouseEnter={() => setHoveredIdx(i)}
              onMouseLeave={() => setHoveredIdx(null)}
            >
              {/* hover tooltip */}
              {isHovered && (
                <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 z-10 pointer-events-none">
                  <div className="bg-neutral-800 border border-neutral-700 rounded px-1.5 py-0.5 text-[9px] text-white whitespace-nowrap shadow">
                    {d.count.toLocaleString()}
                  </div>
                </div>
              )}
              <div
                className={`w-full rounded-sm transition-all ${d.count > 0 ? `${color} ${isHovered ? 'opacity-100' : 'opacity-70'}` : `bg-neutral-700 ${isHovered ? 'opacity-40' : 'opacity-20'}`}`}
                style={{ height: `${barPx}px` }}
              />
            </div>
          );
        })}
      </div>
      {/* 날짜 레이블 행 */}
      <div className="flex gap-px mt-1" style={{ height: `${LABEL_H}px` }}>
        {data.map((d, i) => (
          <div key={d.label} className="flex-1 min-w-0 flex items-center justify-center">
            {showLabel(i) && (
              <span className="text-[8px] text-neutral-600 truncate leading-none">
                {formatChartLabel(d.label, period)}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function AStatCard({ label, value, color, dot, pulse, loading, onClick }: {
  label: string; value: number; color: string; dot?: string; pulse?: boolean; loading: boolean; onClick?: () => void;
}) {
  return (
    <div
      className={`bg-[#111111] border border-neutral-800 rounded-xl px-4 py-4 ${onClick ? 'cursor-pointer hover:border-neutral-600 transition-colors' : ''}`}
      onClick={onClick}
    >
      <div className="flex items-center gap-1.5 mb-2">
        {dot && <span className={`w-2 h-2 rounded-full ${dot} ${pulse ? 'animate-pulse' : ''}`} />}
        <span className="text-xs text-neutral-500">{label}</span>
        {onClick && <span className="ml-auto text-[10px] text-neutral-700">↗</span>}
      </div>
      {loading ? (
        <div className="h-7 w-14 bg-neutral-800 rounded animate-pulse" />
      ) : (
        <span className={`text-2xl font-semibold ${color}`}>{value.toLocaleString()}</span>
      )}
    </div>
  );
}

function StatusBar({ items, total, loading }: {
  items: { key: string; label: string; color: string; value: number }[];
  total: number;
  loading: boolean;
}) {
  return loading ? (
    <div className="h-10 bg-neutral-800 rounded animate-pulse" />
  ) : (
    <div className="space-y-2">
      {items.map(({ key, label, color, value }) => {
        const pct = total > 0 ? Math.round((value / total) * 100) : 0;
        return (
          <div key={key} className="flex items-center gap-3">
            <span className="text-xs text-neutral-500 w-20 flex-shrink-0">{label}</span>
            <div className="flex-1 h-1.5 bg-neutral-800 rounded-full overflow-hidden">
              <div className={`h-full ${color} rounded-full`} style={{ width: `${pct}%` }} />
            </div>
            <span className="text-xs text-neutral-400 w-10 text-right">{value.toLocaleString()}</span>
          </div>
        );
      })}
    </div>
  );
}

function AnalyticsTab() {
  const [chartPeriod, setChartPeriod] = useState<'month' | 'year'>('month');
  const [targetYear, setTargetYear] = useState(String(new Date().getFullYear()));
  const [targetMonth, setTargetMonth] = useState(String(new Date().getMonth() + 1).padStart(2, '0'));
  const [sidePanel, setSidePanel] = useState<'online' | 'visitors' | null>(null);

  const availableYears = Array.from({ length: 5 }, (_, i) => String(new Date().getFullYear() - i));

  // TODAY 고정 조회
  const { data: todayData, isLoading: todayLoading } = useQuery<AnalyticsData>({
    queryKey: ['admin', 'analytics', 'today'],
    queryFn: () => fetch('/api/admin/analytics?period=day').then((r) => r.json()),
    refetchInterval: 30_000,
    staleTime: 15_000,
  });

  // 기간별 차트 조회 (월 / 년)
  const chartTarget = chartPeriod === 'month' ? `${targetYear}-${targetMonth}` : targetYear;
  const { data: chartData, isLoading: chartLoading } = useQuery<AnalyticsData>({
    queryKey: ['admin', 'analytics', chartPeriod, chartTarget],
    queryFn: () =>
      fetch(`/api/admin/analytics?period=${chartPeriod}&target=${chartTarget}`).then((r) => r.json()),
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  const { onlineUsers } = useRealtime();
  const onlineCount = onlineUsers.length;

  const qStats = todayData?.questionStats;
  const totalQ = qStats ? Object.values(qStats).reduce((a, b) => a + b, 0) : 0;
  const iStats = todayData?.inquiryStats;
  const totalI = iStats ? Object.values(iStats).reduce((a, b) => a + b, 0) : 0;
  const rStats = todayData?.reportStats;
  const totalR = rStats ? rStats.pending + rStats.reviewed : 0;

  const categoryStats = todayData?.categoryStats ?? [];
  const sortedCats = [...categoryStats].sort((a, b) => b.attempts - a.attempts);
  const popularCat = sortedCats[0]?.category;
  const leastCat = sortedCats.length > 1 ? sortedCats[sortedCats.length - 1]?.category : null;

  const chartPeriodLabel =
    chartPeriod === 'month'
      ? `${targetYear}년 ${parseInt(targetMonth)}월`
      : `${targetYear}년`;

  const todayVisitorList = todayData?.todayVisitorList ?? [];

  return (
    <div className="space-y-6">

      {/* ── 슬라이드 패널 ── */}
      <div
        className={`fixed inset-0 z-[200] transition-opacity duration-200 ${sidePanel ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
        style={{ background: 'rgba(0,0,0,0.55)' }}
        onClick={() => setSidePanel(null)}
      />
      <div
        className={`fixed top-0 right-0 h-full z-[201] w-72 bg-[#0d0d0d] border-l border-neutral-800 shadow-2xl flex flex-col transition-transform duration-200 ${sidePanel ? 'translate-x-0' : 'translate-x-full'}`}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-800">
          <p className="text-sm font-semibold text-white">
            {sidePanel === 'online'
              ? `현재 접속자 (${onlineCount}명)`
              : `오늘 방문자 (${todayVisitorList.length}명)`}
          </p>
          <button
            onClick={() => setSidePanel(null)}
            className="text-neutral-500 hover:text-white text-lg leading-none transition-colors"
          >
            ✕
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {sidePanel === 'online' ? (
            onlineUsers.length === 0 ? (
              <p className="text-xs text-neutral-600 py-4 text-center">현재 접속 중인 유저 없음</p>
            ) : (
              <div className="space-y-1">
                {onlineUsers.map((u) => (
                  <div key={u.userId} className="flex items-center gap-3 py-2.5 border-b border-neutral-800/50 last:border-0">
                    <div className="relative w-8 h-8 rounded-full bg-neutral-800 flex items-center justify-center flex-shrink-0">
                      <span className="text-xs font-semibold text-neutral-300">{(u.nickname[0] ?? '?').toUpperCase()}</span>
                      <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-[#0d0d0d]" />
                    </div>
                    <span className="text-sm text-neutral-200">{u.nickname}</span>
                  </div>
                ))}
              </div>
            )
          ) : (
            todayVisitorList.length === 0 ? (
              <p className="text-xs text-neutral-600 py-4 text-center">오늘 방문 기록 없음</p>
            ) : (
              <div className="space-y-1">
                {todayVisitorList.map((v, i) => (
                  <div key={i} className="flex items-center gap-3 py-2.5 border-b border-neutral-800/50 last:border-0">
                    <div className="w-8 h-8 rounded-full bg-neutral-800 flex items-center justify-center flex-shrink-0">
                      <span className="text-xs font-semibold text-neutral-300">
                        {((v.nickname ?? v.email)[0] ?? '?').toUpperCase()}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm text-neutral-200 truncate">{v.nickname ?? '(닉네임 없음)'}</p>
                      <p className="text-[11px] text-neutral-600 truncate">{v.email}</p>
                    </div>
                  </div>
                ))}
              </div>
            )
          )}
        </div>
      </div>

      {/* ── TODAY ── */}
      <div>
        <p className="text-[10px] text-neutral-600 font-bold uppercase tracking-widest mb-2">Today</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <AStatCard
            label="현재 접속자" value={onlineCount}
            dot="bg-emerald-500" pulse color="text-emerald-400" loading={false}
            onClick={() => setSidePanel('online')}
          />
          <AStatCard
            label="오늘 방문자" value={todayData?.periodVisitors ?? 0}
            dot="bg-blue-500" color="text-blue-400" loading={todayLoading}
            onClick={() => setSidePanel('visitors')}
          />
          <AStatCard label="오늘 퀴즈 풀기" value={todayData?.periodAttempts ?? 0} dot="bg-violet-500" color="text-violet-400" loading={todayLoading} />
          <AStatCard label="오늘 신규 가입" value={todayData?.newUsersInPeriod ?? 0} dot="bg-amber-500" color="text-amber-400" loading={todayLoading} />
        </div>
      </div>

      {/* ── 기간별 추이 ── */}
      <div>
        <p className="text-[10px] text-neutral-600 font-bold uppercase tracking-widest mb-3">기간별 추이</p>

        {/* 필터 박스 */}
        <div className="bg-[#111111] border border-neutral-800 rounded-xl px-4 py-4 space-y-3 mb-3">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex gap-1">
              {(['month', 'year'] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => setChartPeriod(p)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                    chartPeriod === p
                      ? 'bg-white text-black'
                      : 'text-neutral-400 hover:text-white border border-neutral-800 hover:border-neutral-600'
                  }`}
                >
                  {p === 'month' ? '월별' : '연도별'}
                </button>
              ))}
            </div>
            <select
              value={targetYear}
              onChange={(e) => setTargetYear(e.target.value)}
              className="bg-[#1a1a1a] border border-neutral-700 text-xs text-neutral-300 rounded-lg px-3 py-1.5 focus:outline-none focus:border-neutral-500 cursor-pointer"
            >
              {availableYears.map((y) => (
                <option key={y} value={y}>{y}년</option>
              ))}
            </select>
          </div>
          {chartPeriod === 'month' && (
            <div className="flex gap-1 flex-wrap">
              {Array.from({ length: 12 }, (_, i) => {
                const m = String(i + 1).padStart(2, '0');
                return (
                  <button
                    key={m}
                    onClick={() => setTargetMonth(m)}
                    className={`px-2.5 py-1 text-xs rounded-lg transition-colors ${
                      targetMonth === m
                        ? 'bg-neutral-700 text-white border border-neutral-600'
                        : 'border border-neutral-800 text-neutral-500 hover:text-neutral-300 hover:border-neutral-600'
                    }`}
                  >
                    {i + 1}월
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* 기간 요약 스탯 */}
        <div className="grid grid-cols-3 gap-3 mb-3">
          <AStatCard label={`${chartPeriodLabel} 방문자`} value={chartData?.periodVisitors ?? 0} dot="bg-blue-500" color="text-blue-400" loading={chartLoading} />
          <AStatCard label={`${chartPeriodLabel} 퀴즈 풀기`} value={chartData?.periodAttempts ?? 0} dot="bg-violet-500" color="text-violet-400" loading={chartLoading} />
          <AStatCard label={`${chartPeriodLabel} 신규 가입`} value={chartData?.newUsersInPeriod ?? 0} dot="bg-amber-500" color="text-amber-400" loading={chartLoading} />
        </div>

        {/* 차트 2개 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="bg-[#111111] border border-neutral-800 rounded-xl px-4 py-4">
            <p className="text-xs font-medium text-neutral-300 mb-3">방문자 추이</p>
            {chartLoading ? (
              <div className="h-24 bg-neutral-800 rounded animate-pulse" />
            ) : chartData ? (
              <MiniBarChart data={chartData.chartVisits} color="bg-blue-500" period={chartPeriod} />
            ) : (
              <p className="text-xs text-neutral-500 text-center py-8">데이터 없음</p>
            )}
          </div>
          <div className="bg-[#111111] border border-neutral-800 rounded-xl px-4 py-4">
            <p className="text-xs font-medium text-neutral-300 mb-3">퀴즈 풀기 추이</p>
            {chartLoading ? (
              <div className="h-24 bg-neutral-800 rounded animate-pulse" />
            ) : chartData ? (
              <MiniBarChart data={chartData.chartAttempts} color="bg-violet-500" period={chartPeriod} />
            ) : (
              <p className="text-xs text-neutral-500 text-center py-8">데이터 없음</p>
            )}
          </div>
        </div>
      </div>

      {/* ── 전체 현황 ── */}
      <div>
        <p className="text-[10px] text-neutral-600 font-bold uppercase tracking-widest mb-3">전체 현황</p>
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <AStatCard label="총 가입자" value={todayData?.totalUsers ?? 0} color="text-neutral-200" loading={todayLoading} />
            <AStatCard label="총 대전 수" value={todayData?.totalBattles ?? 0} color="text-purple-400" loading={todayLoading} />
            <AStatCard label="누적 퀴즈 풀기" value={todayData?.totalAttempts ?? 0} color="text-neutral-200" loading={todayLoading} />
          </div>

          {sortedCats.length > 0 && (
            <div className="bg-[#111111] border border-neutral-800 rounded-xl px-4 py-4">
              <p className="text-xs font-medium text-neutral-300 mb-3">카테고리별 활동</p>
              <div className="space-y-2.5">
                {sortedCats.map((cs) => {
                  const maxAttempts = sortedCats[0]?.attempts ?? 1;
                  const barWidth = Math.max(Math.round((cs.attempts / maxAttempts) * 100), 2);
                  const isPopular = cs.category === popularCat;
                  const isLeast = cs.category === leastCat;
                  return (
                    <div key={cs.category} className="flex items-center gap-3">
                      <span className="text-xs text-neutral-500 w-20 flex-shrink-0">{CATEGORY_LABEL[cs.category] ?? cs.category}</span>
                      <div className="flex-1 h-1.5 bg-neutral-800 rounded-full overflow-hidden">
                        <div className="h-full bg-sky-500 rounded-full" style={{ width: `${barWidth}%` }} />
                      </div>
                      <span className="text-xs text-neutral-400 w-12 text-right flex-shrink-0">{cs.attempts.toLocaleString()}회</span>
                      <div className="w-10 flex-shrink-0 flex justify-end">
                        {isPopular && <span className="text-[10px] text-emerald-400 border border-emerald-500/30 rounded px-1">인기</span>}
                        {isLeast && !isPopular && <span className="text-[10px] text-neutral-500 border border-neutral-700 rounded px-1">비인기</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="bg-[#111111] border border-neutral-800 rounded-xl px-4 py-4">
            <p className="text-xs font-medium text-neutral-300 mb-3">문제 현황 (총 {totalQ.toLocaleString()}개)</p>
            <StatusBar
              loading={todayLoading}
              total={totalQ}
              items={[
                { key: 'official', label: '기본 문제', color: 'bg-blue-500', value: qStats?.official ?? 0 },
                { key: 'approved', label: '승인됨', color: 'bg-emerald-500', value: qStats?.approved ?? 0 },
                { key: 'pending', label: '대기 중', color: 'bg-amber-500', value: qStats?.pending ?? 0 },
                { key: 'rejected', label: '반려됨', color: 'bg-red-500', value: qStats?.rejected ?? 0 },
                { key: 'blinded', label: '블라인드', color: 'bg-orange-500', value: qStats?.blinded ?? 0 },
              ]}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="bg-[#111111] border border-neutral-800 rounded-xl px-4 py-4">
              <p className="text-xs font-medium text-neutral-300 mb-3">문의 현황 (총 {totalI.toLocaleString()}건)</p>
              <StatusBar
                loading={todayLoading}
                total={totalI}
                items={[
                  { key: 'pending', label: '미처리', color: 'bg-amber-500', value: iStats?.pending ?? 0 },
                  { key: 'inProgress', label: '처리 중', color: 'bg-blue-500', value: iStats?.inProgress ?? 0 },
                  { key: 'resolved', label: '해결됨', color: 'bg-emerald-500', value: iStats?.resolved ?? 0 },
                ]}
              />
            </div>
            <div className="bg-[#111111] border border-neutral-800 rounded-xl px-4 py-4">
              <p className="text-xs font-medium text-neutral-300 mb-3">신고 현황 (총 {totalR.toLocaleString()}건)</p>
              <StatusBar
                loading={todayLoading}
                total={totalR}
                items={[
                  { key: 'pending', label: '미처리', color: 'bg-red-500', value: rStats?.pending ?? 0 },
                  { key: 'reviewed', label: '처리 완료', color: 'bg-emerald-500', value: rStats?.reviewed ?? 0 },
                ]}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ───────── 오류 로그 탭 ─────────

interface AdminErrorLog {
  id: string;
  userId: string | null;
  statusCode: number | null;
  errorCode: string | null;
  message: string;
  path: string | null;
  digest: string | null;
  createdAt: string;
  user: { nickname: string | null; email: string } | null;
}

const STATUS_COLOR: Record<number, string> = {
  404: 'text-amber-400 border-amber-500/30',
  500: 'text-red-400 border-red-500/30',
};

function ErrorLogsTab() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [statusCodeFilter, setStatusCodeFilter] = useState('');
  const [errorCodeFilter, setErrorCodeFilter] = useState('');
  const [sort, setSort] = useState<'desc' | 'asc'>('desc');
  const [confirmClear, setConfirmClear] = useState(false);

  function resetPage() { setPage(1); }

  const params = new URLSearchParams({ page: String(page), sort });
  if (statusCodeFilter) params.set('statusCode', statusCodeFilter);
  if (errorCodeFilter) params.set('errorCode', errorCodeFilter);

  const { data, isLoading } = useQuery<{
    total: number; totalPages: number;
    logs: AdminErrorLog[]; errorCodes: string[];
  }>({
    queryKey: ['admin', 'error-logs', page, statusCodeFilter, errorCodeFilter, sort],
    queryFn: () => fetch(`/api/admin/errors?${params}`).then((r) => r.json()),
    staleTime: 15_000,
  });

  const logs = data?.logs ?? [];
  const total = data?.total ?? 0;
  const totalPages = data?.totalPages ?? 1;
  const errorCodes = data?.errorCodes ?? [];

  async function handleDelete(id: string) {
    await fetch(`/api/admin/errors?id=${id}`, { method: 'DELETE' });
    queryClient.invalidateQueries({ queryKey: ['admin', 'error-logs'] });
  }

  async function handleClearAll() {
    await fetch('/api/admin/errors', { method: 'DELETE' });
    queryClient.invalidateQueries({ queryKey: ['admin', 'error-logs'] });
    setConfirmClear(false);
  }

  return (
    <div className="space-y-4">
      {/* 필터 바 */}
      <div className="flex items-center gap-2 flex-wrap">
        <select
          value={statusCodeFilter}
          onChange={(e) => { setStatusCodeFilter(e.target.value); resetPage(); }}
          className="bg-[#1a1a1a] border border-neutral-700 rounded-md px-3 py-1.5 text-sm text-white focus:outline-none focus:border-neutral-500"
        >
          <option value="">전체 코드</option>
          <option value="404">404</option>
          <option value="500">500</option>
        </select>

        {errorCodes.length > 0 && (
          <select
            value={errorCodeFilter}
            onChange={(e) => { setErrorCodeFilter(e.target.value); resetPage(); }}
            className="bg-[#1a1a1a] border border-neutral-700 rounded-md px-3 py-1.5 text-sm text-white focus:outline-none focus:border-neutral-500"
          >
            <option value="">전체 유형</option>
            {errorCodes.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        )}

        <select
          value={sort}
          onChange={(e) => { setSort(e.target.value as 'desc' | 'asc'); resetPage(); }}
          className="bg-[#1a1a1a] border border-neutral-700 rounded-md px-3 py-1.5 text-sm text-white focus:outline-none focus:border-neutral-500"
        >
          <option value="desc">최신순</option>
          <option value="asc">오래된순</option>
        </select>

        <span className="text-xs text-neutral-500 ml-1">총 {total.toLocaleString()}건</span>

        <div className="ml-auto">
          {total > 0 && (
            confirmClear ? (
              <div className="flex items-center gap-2">
                <span className="text-xs text-neutral-400">전체 삭제?</span>
                <button onClick={handleClearAll} className="text-xs text-red-400 hover:text-red-300 transition-colors">확인</button>
                <button onClick={() => setConfirmClear(false)} className="text-xs text-neutral-500 hover:text-white transition-colors">취소</button>
              </div>
            ) : (
              <button onClick={() => setConfirmClear(true)} className="text-xs text-neutral-600 hover:text-red-400 transition-colors">
                전체 삭제
              </button>
            )
          )}
        </div>
      </div>

      {isLoading && <p className="text-neutral-500 text-sm text-center py-8">로딩 중...</p>}
      {!isLoading && logs.length === 0 && (
        <p className="text-neutral-500 text-sm text-center py-8">기록된 오류가 없습니다.</p>
      )}

      <div className="space-y-2">
        {logs.map((log) => {
          const sc = log.statusCode ? (STATUS_COLOR[log.statusCode] ?? 'text-neutral-400 border-neutral-700') : 'text-neutral-400 border-neutral-700';
          return (
            <div key={log.id} className="bg-[#111111] border border-neutral-800 rounded-xl px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    {log.statusCode && (
                      <span className={`text-[11px] font-mono border rounded px-1.5 py-0.5 ${sc}`}>
                        {log.statusCode}
                      </span>
                    )}
                    {log.errorCode && (
                      <span className="text-[11px] font-mono text-neutral-500 border border-neutral-800 rounded px-1.5 py-0.5">
                        {log.errorCode}
                      </span>
                    )}
                    <span className="text-[11px] text-neutral-600">
                      {new Date(log.createdAt).toLocaleString('ko-KR')}
                    </span>
                  </div>
                  <p className="text-sm text-neutral-200 break-all">{log.message}</p>
                  {log.path && (
                    <p className="text-xs text-neutral-600 mt-0.5 font-mono break-all">{log.path}</p>
                  )}
                  {log.digest && (
                    <p className="text-xs text-neutral-700 mt-0.5 font-mono">digest: {log.digest}</p>
                  )}
                  {log.user && (
                    <p className="text-xs text-neutral-600 mt-1">유저: {log.user.nickname ?? log.user.email}</p>
                  )}
                </div>
                <button
                  onClick={() => handleDelete(log.id)}
                  className="flex-shrink-0 text-neutral-700 hover:text-red-400 transition-colors"
                  title="삭제"
                >
                  <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <button
            onClick={() => setPage(1)}
            disabled={page === 1}
            className="px-2.5 py-1.5 text-xs rounded border border-neutral-800 text-neutral-400 hover:text-white disabled:opacity-30 transition-colors"
          >
            처음
          </button>
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-3 py-1.5 text-xs rounded border border-neutral-800 text-neutral-400 hover:text-white disabled:opacity-30 transition-colors"
          >
            이전
          </button>
          <span className="text-xs text-neutral-500 px-1">{page} / {totalPages}</span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="px-3 py-1.5 text-xs rounded border border-neutral-800 text-neutral-400 hover:text-white disabled:opacity-30 transition-colors"
          >
            다음
          </button>
          <button
            onClick={() => setPage(totalPages)}
            disabled={page === totalPages}
            className="px-2.5 py-1.5 text-xs rounded border border-neutral-800 text-neutral-400 hover:text-white disabled:opacity-30 transition-colors"
          >
            마지막
          </button>
        </div>
      )}
    </div>
  );
}
