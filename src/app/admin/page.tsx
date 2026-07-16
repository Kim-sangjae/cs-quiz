'use client';

import { useState, useRef, useEffect } from 'react';
import { useRealtime } from '@/contexts/RealtimeContext';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { getLevelInfo, MAX_LEVEL } from '@/lib/user-level';
import PaginationNav from '@/components/PaginationNav';

type Tab = 'questions' | 'board' | 'reports' | 'users' | 'inquiries' | 'logs' | 'analytics' | 'errors' | 'generate' | 'blocked-words' | 'points-log';

const CATEGORY_LABEL: Record<string, string> = {
  ds: '자료구조', algo: '알고리즘', os: '운영체제',
  network: '네트워크', db: '데이터베이스', arch: '컴퓨터 구조', se: '소프트웨어공학',
};
const CATEGORIES = ['ds', 'algo', 'os', 'network', 'db', 'arch', 'se'];
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
  role: string; deletedAt: string | null; createdAt: string; xp: number;
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

  const { data: badge } = useQuery<{ questions: number; reports: number; inquiries: number; userReports: number; commentReports: number }>({
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
    alert('권한이 없습니다.');
    router.replace('/');
    return null;
  }

  const tabs: { key: Tab; label: string; count?: number }[] = [
    { key: 'analytics', label: '통계' },
    { key: 'questions', label: '승인 대기', count: badge?.questions },
    { key: 'board', label: '게시판 관리' },
    { key: 'reports', label: '신고 접수', count: (badge?.reports ?? 0) + (badge?.userReports ?? 0) + (badge?.commentReports ?? 0) || undefined },
    { key: 'users', label: '유저 관리' },
    { key: 'inquiries', label: '문의 관리', count: badge?.inquiries },
    { key: 'logs', label: '활동 로그' },
    { key: 'errors', label: '오류 내역' },
    { key: 'generate', label: 'AI 문제 생성' },
    { key: 'blocked-words', label: '금칙어 관리' },
    { key: 'points-log', label: '포인트 내역' },
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
      {activeTab === 'generate' && <GenerateQuestionsTab />}
      {activeTab === 'blocked-words' && <BlockedWordsTab />}
      {activeTab === 'points-log' && <PointsLogTab />}
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
        <ul className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
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

const Q_CAT_LABELS: Record<string, string> = {
  all: '전체', ds: '자료구조', algo: '알고리즘', os: '운영체제',
  network: '네트워크', db: '데이터베이스', arch: '컴퓨터 구조', se: '소프트웨어공학',
};

interface QuestionsResponse {
  questions: PendingQuestion[];
  total: number;
  pageCount: number;
  categoryCounts: { category: string; count: number }[];
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
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);
  const [catFilter, setCatFilter] = useState('all');
  const [page, setPage] = useState(1);

  const { data } = useQuery<QuestionsResponse>({
    queryKey: ['admin', 'questions', catFilter, page],
    queryFn: async () => {
      const params = new URLSearchParams({ category: catFilter, page: String(page) });
      const r = await fetch(`/api/admin/questions?${params}`);
      if (!r.ok) return { questions: [], total: 0, pageCount: 1, categoryCounts: [] };
      return r.json();
    },
  });

  const questions = data?.questions ?? [];
  const pageCount = data?.pageCount ?? 1;
  const total = data?.total ?? 0;
  const categoryCounts = data?.categoryCounts ?? [];

  const mutation = useMutation({
    mutationFn: ({ id, action, reason }: { id: string; action: 'approve' | 'reject'; reason?: string }) =>
      fetch(`/api/admin/questions/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, rejectionReason: reason }),
      }).then((r) => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'questions', catFilter, page] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'badge'] });
      setRejectingId(null);
      setRejectionReason(REJECTION_REASONS[0]);
    },
  });

  const allSelected = questions.length > 0 && selectedIds.size === questions.length;

  function toggleAll() {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(questions.map((q) => q.id)));
    }
  }

  function toggleOne(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); } else { next.add(id); }
      return next;
    });
  }

  async function handleBulk(action: 'approve' | 'reject') {
    if (selectedIds.size === 0) return;
    setBulkLoading(true);
    try {
      await fetch('/api/admin/questions/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: [...selectedIds], action, rejectionReason: REJECTION_REASONS[0] }),
      });
      queryClient.invalidateQueries({ queryKey: ['admin', 'questions', catFilter, page] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'badge'] });
      setSelectedIds(new Set());
      toast.success(`일괄 ${action === 'approve' ? '승인' : '거절'} 완료`);
    } finally {
      setBulkLoading(false);
    }
  }

  const catTabs = ['all', 'ds', 'algo', 'os', 'network', 'db', 'arch', 'se'];
  const countMap = Object.fromEntries(categoryCounts.map((c) => [c.category, c.count]));
  const totalPending = Object.values(countMap).reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-4">
      {/* 카테고리 필터 탭 */}
      <div className="flex flex-wrap gap-1.5">
        {catTabs.map((cat) => {
          const cnt = cat === 'all' ? totalPending : (countMap[cat] ?? 0);
          return (
            <button
              key={cat}
              onClick={() => { setCatFilter(cat); setPage(1); setSelectedIds(new Set()); }}
              className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                catFilter === cat
                  ? 'bg-white text-black border-white font-medium'
                  : 'border-neutral-700 text-neutral-400 hover:text-white hover:border-neutral-500'
              }`}
            >
              {Q_CAT_LABELS[cat]}
              {cnt > 0 && <span className={`ml-1.5 ${catFilter === cat ? 'text-neutral-500' : 'text-amber-400'}`}>{cnt}</span>}
            </button>
          );
        })}
      </div>

      {questions.length === 0 ? (
        <p className="text-neutral-500 text-sm text-center py-8">대기 중인 문제가 없습니다.</p>
      ) : (<>

      {/* 일괄 처리 툴바 */}
      <div className="flex items-center gap-3 bg-[#111111] border border-neutral-800 rounded-lg px-4 py-2.5">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={allSelected}
            onChange={toggleAll}
            className="accent-white w-3.5 h-3.5"
          />
          <span className="text-xs text-neutral-400">
            {selectedIds.size > 0 ? `${selectedIds.size}개 선택` : '전체 선택'}
          </span>
        </label>
        {selectedIds.size > 0 && (
          <>
            <button
              onClick={() => handleBulk('approve')}
              disabled={bulkLoading}
              className="rounded-md bg-green-500/10 border border-green-500/30 text-green-400 text-xs px-3 py-1 hover:bg-green-500/20 transition-colors disabled:opacity-40"
            >
              일괄 승인
            </button>
            <button
              onClick={() => handleBulk('reject')}
              disabled={bulkLoading}
              className="rounded-md bg-red-500/10 border border-red-500/30 text-red-400 text-xs px-3 py-1 hover:bg-red-500/20 transition-colors disabled:opacity-40"
            >
              일괄 거절
            </button>
          </>
        )}
      </div>

      {questions.map((q) => (
        <div key={q.id} className={`bg-[#111111] border rounded-lg p-5 transition-colors ${selectedIds.has(q.id) ? 'border-neutral-600' : 'border-neutral-800'}`}>
          <div className="flex items-start gap-3 mb-3">
            <input
              type="checkbox"
              checked={selectedIds.has(q.id)}
              onChange={() => toggleOne(q.id)}
              className="accent-white w-3.5 h-3.5 mt-0.5 flex-shrink-0"
            />
            <div className="flex items-center gap-2 flex-wrap">
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
          </div>
          <p className="text-sm text-neutral-200 mb-4 leading-relaxed pl-6">
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
            <div className="flex gap-2 mt-4 pl-6">
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

      {/* 페이징 */}
      {pageCount > 1 && (
        <div className="flex flex-col items-center gap-1 pt-2">
          <span className="text-xs text-neutral-500">{total}건</span>
          <PaginationNav
            page={page}
            pageCount={pageCount}
            onChange={(p) => { setPage(p); setSelectedIds(new Set()); }}
          />
        </div>
      )}
      </>)}
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
      <CategoryQuestionStats />
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
              <div className="mt-4">
                <PaginationNav
                  page={page}
                  pageCount={pageCount}
                  onChange={(p) => { setPage(p); setSelectedIds(new Set()); }}
                />
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
  const [reportKind, setReportKind] = useState<'question' | 'user' | 'comment'>('question');
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

  const [userReportStatusFilter, setUserReportStatusFilter] = useState<'PENDING' | 'REVIEWED' | 'all'>('PENDING');
  const { data: userReports = [], isLoading: userReportsLoading, isError: userReportsError, isFetching: userReportsFetching } = useQuery<UserReportItem[]>({
    queryKey: ['admin', 'user-reports'],
    queryFn: async () => { const r = await fetch('/api/admin/user-reports'); if (!r.ok) throw new Error(`${r.status}`); return r.json() as Promise<UserReportItem[]>; },
    refetchOnMount: 'always',
  });
  const dismissUserReportMutation = useMutation({
    mutationFn: (id: string) => fetch('/api/admin/user-reports', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, action: 'dismiss' }) }),
    onSuccess: () => { void queryClient.invalidateQueries({ queryKey: ['admin', 'user-reports'] }); void queryClient.invalidateQueries({ queryKey: ['admin', 'badge'] }); toast.success('처리되었습니다.'); },
  });
  const blindUserMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => fetch('/api/admin/user-reports', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, action: 'blind', reason }) }),
    onSuccess: () => { void queryClient.invalidateQueries({ queryKey: ['admin', 'user-reports'] }); void queryClient.invalidateQueries({ queryKey: ['admin', 'badge'] }); toast.success('블라인드 처리되었습니다.'); },
  });
  const changeNicknameMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => fetch('/api/admin/user-reports', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, action: 'change-nickname', reason }) }),
    onSuccess: () => { void queryClient.invalidateQueries({ queryKey: ['admin', 'user-reports'] }); void queryClient.invalidateQueries({ queryKey: ['admin', 'badge'] }); toast.success('닉네임이 강제 변경되었습니다.'); },
  });
  const bulkDismissUserMutation = useMutation({
    mutationFn: (ids: string[]) => fetch('/api/admin/user-reports', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids, action: 'dismiss' }) }),
    onSuccess: () => { void queryClient.invalidateQueries({ queryKey: ['admin', 'user-reports'] }); void queryClient.invalidateQueries({ queryKey: ['admin', 'badge'] }); setUserSelectedIds(new Set()); toast.success('처리되었습니다.'); },
  });
  const [userSelectedIds, setUserSelectedIds] = useState<Set<string>>(new Set());

  // 댓글 신고
  const { data: commentReportGroups = [], isLoading: commentReportsLoading } = useQuery<CommentReportGroup[]>({
    queryKey: ['admin', 'comment-reports'],
    queryFn: async () => { const r = await fetch('/api/admin/comment-reports'); if (!r.ok) return []; return r.json(); },
  });
  const commentReportMutation = useMutation({
    mutationFn: ({ commentId, action }: { commentId: string; action: 'delete' | 'dismiss' }) =>
      fetch('/api/admin/comment-reports', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ commentId, action }) }),
    onSuccess: () => { void queryClient.invalidateQueries({ queryKey: ['admin', 'comment-reports'] }); void queryClient.invalidateQueries({ queryKey: ['admin', 'badge'] }); toast.success('처리되었습니다.'); },
  });
  const [commentStatusFilter, setCommentStatusFilter] = useState<'pending' | 'dismissed' | 'all'>('pending');
  const filteredCommentGroups = commentReportGroups.filter((g) => {
    if (commentStatusFilter === 'pending' && g.dismissed) return false;
    if (commentStatusFilter === 'dismissed' && !g.dismissed) return false;
    return true;
  });
  const pendingCommentCount = commentReportGroups.filter((g) => !g.dismissed).length;

  function handleUserAction(id: string, action: 'blind' | 'change-nickname', reason: string) {
    if (action === 'blind') blindUserMutation.mutate({ id, reason });
    else changeNicknameMutation.mutate({ id, reason });
  }

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

  const filteredUserReports = userReports.filter((r) => userReportStatusFilter === 'all' || r.status === userReportStatusFilter);
  const pendingUserReportCount = userReports.filter((r) => r.status === 'PENDING').length;

  return (
    <div className="space-y-4">
      {/* 신고 종류 전환 */}
      <div className="flex gap-1 border-b border-neutral-800 pb-3">
        <button onClick={() => setReportKind('question')}
          className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${reportKind === 'question' ? 'bg-white text-black' : 'text-neutral-400 hover:text-white border border-neutral-800 hover:border-neutral-600'}`}>
          문제 신고 {pendingCount > 0 && <span className="ml-1 text-[10px] bg-red-500 text-white rounded-full px-1.5 py-0.5">{pendingCount}</span>}
        </button>
        <button onClick={() => setReportKind('user')}
          className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${reportKind === 'user' ? 'bg-white text-black' : 'text-neutral-400 hover:text-white border border-neutral-800 hover:border-neutral-600'}`}>
          닉네임 신고 {pendingUserReportCount > 0 && <span className="ml-1 text-[10px] bg-red-500 text-white rounded-full px-1.5 py-0.5">{pendingUserReportCount}</span>}
        </button>
        <button onClick={() => setReportKind('comment')}
          className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${reportKind === 'comment' ? 'bg-white text-black' : 'text-neutral-400 hover:text-white border border-neutral-800 hover:border-neutral-600'}`}>
          댓글 신고 {pendingCommentCount > 0 && <span className="ml-1 text-[10px] bg-red-500 text-white rounded-full px-1.5 py-0.5">{pendingCommentCount}</span>}
        </button>
      </div>

      {reportKind === 'comment' ? (
        <div className="space-y-4">
          <div className="flex gap-1.5">
            {([
              { key: 'pending', label: `대기 중 ${pendingCommentCount}` },
              { key: 'dismissed', label: '처리됨' },
              { key: 'all', label: '전체' },
            ] as const).map(({ key, label }) => (
              <button key={key} onClick={() => setCommentStatusFilter(key)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${commentStatusFilter === key ? 'bg-white text-black' : 'text-neutral-400 hover:text-white border border-neutral-800 hover:border-neutral-600'}`}>
                {label}
              </button>
            ))}
          </div>
          {commentReportsLoading ? (
            <p className="text-neutral-500 text-sm text-center py-8">로딩 중...</p>
          ) : filteredCommentGroups.length === 0 ? (
            <p className="text-neutral-500 text-sm text-center py-8">신고가 없습니다.</p>
          ) : (
            <div className="space-y-3">
              {filteredCommentGroups.map((group) => {
                const isPending = !group.dismissed;
                const isActing = commentReportMutation.isPending;
                return (
                  <div key={group.commentId} className={`bg-[#111111] border rounded-lg p-4 ${isPending ? 'border-neutral-800' : 'border-neutral-800/40 opacity-60'}`}>
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs text-neutral-500 border border-neutral-800 rounded px-2 py-0.5">
                            {CATEGORY_LABEL[group.comment.question.category] ?? group.comment.question.category}
                          </span>
                          <span className="text-xs text-neutral-500">신고 {group.reportCount}건</span>
                          {group.comment.deletedAt && <span className="text-xs text-red-400 border border-red-500/30 rounded px-1.5 py-0.5">삭제됨</span>}
                          {!group.dismissed && <span className="text-[10px] font-bold text-amber-400 border border-amber-500/40 rounded px-1.5 py-0.5">PENDING</span>}
                        </div>
                        <a
                          href={`/board/${group.comment.question.id}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs text-neutral-500 hover:text-white transition-colors underline flex-shrink-0"
                        >
                          게시글 보기 →
                        </a>
                      </div>
                      <div className="bg-neutral-900/60 rounded-md px-3 py-2 border border-neutral-800/60">
                        <p className="text-[10px] text-neutral-600 mb-0.5">문제</p>
                        <p className="text-xs text-neutral-400 truncate">{group.comment.question.question}</p>
                      </div>
                      <div className="bg-neutral-900/60 rounded-md px-3 py-2 border border-neutral-800/60">
                        <p className="text-[10px] text-neutral-600 mb-0.5">댓글 작성자: <span className="text-neutral-400">{group.comment.user.nickname ?? '(탈퇴)'}</span></p>
                        <p className="text-sm text-neutral-200 leading-relaxed">{group.comment.content}</p>
                      </div>
                      <div className="space-y-1">
                        {group.reports.map((r) => (
                          <div key={r.id} className="text-xs text-neutral-500 flex gap-2">
                            <span className="text-neutral-600">{r.reporter.nickname ?? '(탈퇴)'}</span>
                            <span>{COMMENT_REPORT_REASON_LABEL[r.reason] ?? r.reason}</span>
                            {r.description && <span className="text-neutral-600 italic">— {r.description}</span>}
                          </div>
                        ))}
                      </div>
                      {isPending && (
                        <div className="flex gap-1.5 flex-wrap">
                          {!group.comment.deletedAt && (
                            <button
                              onClick={() => commentReportMutation.mutate({ commentId: group.commentId, action: 'delete' })}
                              disabled={isActing}
                              className="rounded-md bg-red-500/10 border border-red-500/30 text-red-400 text-xs px-3 py-1.5 hover:bg-red-500/20 transition-colors disabled:opacity-40">
                              삭제
                            </button>
                          )}
                          <button
                            onClick={() => commentReportMutation.mutate({ commentId: group.commentId, action: 'dismiss' })}
                            disabled={isActing}
                            className="rounded-md border border-neutral-700 text-neutral-400 text-xs px-3 py-1.5 hover:text-white transition-colors disabled:opacity-40">
                            무시
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : reportKind === 'user' ? (
        <div className="space-y-4">
          <div className="flex gap-1.5">
            {([
              { key: 'PENDING', label: `대기 중 ${pendingUserReportCount}` },
              { key: 'REVIEWED', label: '처리됨' },
              { key: 'all', label: '전체' },
            ] as const).map(({ key, label }) => (
              <button key={key} onClick={() => { setUserReportStatusFilter(key); setUserSelectedIds(new Set()); }}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${userReportStatusFilter === key ? 'bg-white text-black' : 'text-neutral-400 hover:text-white border border-neutral-800 hover:border-neutral-600'}`}>
                {label}
              </button>
            ))}
          </div>
          {userSelectedIds.size > 0 && (
            <div className="flex items-center gap-3 bg-neutral-900 border border-neutral-700 rounded-lg px-4 py-2.5">
              <span className="text-xs text-neutral-300">{userSelectedIds.size}개 선택됨</span>
              <button onClick={() => bulkDismissUserMutation.mutate([...userSelectedIds])} disabled={bulkDismissUserMutation.isPending}
                className="rounded-md bg-[#1a1a1a] border border-neutral-700 text-neutral-400 text-xs px-3 py-1.5 hover:text-white transition-colors disabled:opacity-40">
                일괄 무시
              </button>
              <button onClick={() => setUserSelectedIds(new Set())} className="ml-auto text-xs text-neutral-600 hover:text-neutral-400 transition-colors">선택 해제</button>
            </div>
          )}
          {(userReportsLoading || userReportsFetching) ? (
            <p className="text-neutral-500 text-sm text-center py-8">로딩 중...</p>
          ) : userReportsError ? (
            <p className="text-red-500 text-sm text-center py-8">신고 목록을 불러오지 못했습니다.</p>
          ) : filteredUserReports.length === 0 ? (
            <p className="text-neutral-500 text-sm text-center py-8">신고가 없습니다.</p>
          ) : (
            <div className="space-y-3">
              {filteredUserReports.map((report) => {
                const isPending = report.status === 'PENDING';
                const isActing = blindUserMutation.isPending || changeNicknameMutation.isPending || dismissUserReportMutation.isPending;
                return (
                  <div key={report.id} className={`bg-[#111111] border rounded-lg p-4 ${isPending ? 'border-neutral-800' : 'border-neutral-800/40 opacity-60'}`}>
                    <div className="flex items-start gap-3">
                      {isPending && (
                        <input type="checkbox" checked={userSelectedIds.has(report.id)}
                          onChange={() => setUserSelectedIds((prev) => { const n = new Set(prev); if (n.has(report.id)) n.delete(report.id); else n.add(report.id); return n; })}
                          className="mt-1 w-3.5 h-3.5 accent-white flex-shrink-0 cursor-pointer" />
                      )}
                      <div className="flex-1 space-y-2.5">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <div>
                            <p className="text-[10px] text-neutral-600 uppercase tracking-wide mb-0.5">피신고자</p>
                            <p className="text-sm font-semibold text-white">{report.reported.nickname ?? report.reported.email}</p>
                          </div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-xs bg-red-500/10 border border-red-500/30 text-red-400 rounded px-2 py-0.5">{USER_REPORT_REASON_LABEL[report.reason] ?? report.reason}</span>
                            {!isPending && <span className="text-xs text-neutral-600 border border-neutral-800 rounded px-1.5 py-0.5">처리됨</span>}
                          </div>
                        </div>
                        <div className="bg-neutral-900/60 rounded-md px-3 py-2 border border-neutral-800/60">
                          <p className="text-[10px] text-neutral-600 uppercase tracking-wide mb-1">신고자</p>
                          <p className="text-xs text-neutral-400">
                            <span className="text-neutral-300">{report.reporter.nickname ?? report.reporter.email}</span>
                            <span className="text-neutral-700 ml-2">{new Date(report.createdAt).toLocaleDateString('ko-KR')}</span>
                          </p>
                          {report.description && <p className="text-xs text-neutral-500 mt-1 italic">&ldquo;{report.description}&rdquo;</p>}
                        </div>
                        {isPending && (
                          <div className="flex gap-1.5 flex-wrap">
                            <button
                              onClick={() => handleUserAction(report.id, 'change-nickname', `${USER_REPORT_REASON_LABEL[report.reason] ?? report.reason}`)}
                              disabled={isActing}
                              className="rounded-md bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs px-3 py-1.5 hover:bg-amber-500/20 transition-colors disabled:opacity-40">
                              닉네임 강제변경
                            </button>
                            <button
                              onClick={() => handleUserAction(report.id, 'blind', `${USER_REPORT_REASON_LABEL[report.reason] ?? report.reason}`)}
                              disabled={isActing}
                              className="rounded-md bg-red-500/10 border border-red-500/30 text-red-400 text-xs px-3 py-1.5 hover:bg-red-500/20 transition-colors disabled:opacity-40">
                              블라인드
                            </button>
                            <button
                              onClick={() => dismissUserReportMutation.mutate(report.id)}
                              disabled={isActing}
                              className="rounded-md border border-neutral-700 text-neutral-400 text-xs px-3 py-1.5 hover:text-white transition-colors disabled:opacity-40">
                              무시
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
      <><div className="flex gap-1">
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
            <div className="mt-4">
              <PaginationNav
                page={page}
                pageCount={pageCount}
                onChange={(p) => { setPage(p); setSelectedIds(new Set()); }}
              />
            </div>
          )}
        </>
      )}
      </>
    )}
    </div>
  );
}

interface UsersResponse { users: AdminUser[]; total: number; pageCount: number; }

function UsersTab({ currentUserId, requestConfirm }: { currentUserId: string; requestConfirm: (msg: string, fn: () => void) => void }) {
  const queryClient = useQueryClient();
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'ADMIN' | 'USER'>('all');
  const [statusFilter, setUserStatusFilter] = useState<'all' | 'active' | 'deactivated'>('all');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [sortBy, setSortBy] = useState<'createdAt' | 'xp'>('createdAt');
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkPending, setBulkPending] = useState(false);
  const [levelEditId, setLevelEditId] = useState<string | null>(null);
  const [levelInput, setLevelInput] = useState('');

  useEffect(() => {
    const t = setTimeout(() => { setSearch(searchInput); setPage(1); setSelectedIds(new Set()); }, 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  const { data } = useQuery<UsersResponse>({
    queryKey: ['admin', 'users', search, roleFilter, statusFilter, sortOrder, sortBy, page],
    queryFn: async () => {
      const params = new URLSearchParams({ search, role: roleFilter, status: statusFilter, sort: sortOrder, sortBy, page: String(page) });
      const r = await fetch(`/api/admin/users?${params}`);
      if (!r.ok) return { users: [], total: 0, pageCount: 1 };
      return r.json();
    },
  });

  const pagedUsers = data?.users ?? [];
  const pageCount = data?.pageCount ?? 1;

  async function doAction(userId: string, action: 'set-admin' | 'set-user' | 'deactivate' | 'reactivate' | 'reset-stats' | 'set-level', level?: number) {
    setActionLoading(userId + ':' + action);
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...(level !== undefined ? { level } : {}) }),
      });
      if (res.ok) {
        if (action === 'set-admin' || action === 'set-user') {
          toast.success('권한이 변경되었습니다.');
        } else if (action === 'deactivate') {
          toast.success('탈퇴 처리되었습니다.');
        } else if (action === 'reset-stats') {
          toast.success('통계가 초기화되었습니다.');
        } else if (action === 'set-level') {
          toast.success('레벨이 변경되었습니다.');
          setLevelEditId(null);
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
        <input type="text" value={searchInput} onChange={(e) => setSearchInput(e.target.value)}
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
        <div className="flex gap-1.5">
          {([['createdAt', '가입일'], ['xp', '레벨']] as const).map(([v, l]) => (
            <button key={v}
              onClick={() => {
                if (sortBy === v) { setSortOrder((o) => (o === 'desc' ? 'asc' : 'desc')); }
                else { setSortBy(v); setSortOrder('desc'); }
                setPage(1); setSelectedIds(new Set());
              }}
              className={`rounded px-3 py-1.5 text-xs transition-colors ${sortBy === v ? 'border border-neutral-500 text-white' : 'border border-neutral-800 text-neutral-500 hover:text-neutral-300'}`}>
              {l} {sortBy === v ? (sortOrder === 'desc' ? '↓' : '↑') : ''}
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

      {pagedUsers.length === 0 ? (
        <p className="text-neutral-500 text-sm text-center py-8">
          {search || roleFilter !== 'all' || statusFilter !== 'all' ? '검색 결과가 없습니다.' : '유저가 없습니다.'}
        </p>
      ) : (
        <>
          <div className="flex items-center gap-2 px-1 mb-2">
            <input type="checkbox" checked={allPageSelected} onChange={toggleAll} className="w-3.5 h-3.5 rounded accent-white cursor-pointer" />
            <span className="text-xs text-neutral-600">현재 페이지 전체 선택</span>
            <span className="ml-auto text-xs text-neutral-600">{data?.total ?? 0}명</span>
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
                          {levelEditId === u.id ? (
                            <span className="flex items-center gap-1">
                              <input type="number" min={1} max={MAX_LEVEL} value={levelInput}
                                onChange={(e) => setLevelInput(e.target.value)}
                                className="w-14 bg-[#1a1a1a] border border-neutral-700 rounded px-1.5 py-0.5 text-xs text-white focus:outline-none focus:border-neutral-500"
                                autoFocus
                              />
                              <button
                                onClick={() => {
                                  const lv = parseInt(levelInput, 10);
                                  if (!Number.isFinite(lv) || lv < 1 || lv > MAX_LEVEL) { toast.error(`레벨은 1~${MAX_LEVEL} 사이여야 합니다`); return; }
                                  doAction(u.id, 'set-level', lv);
                                }}
                                disabled={!!actionLoading}
                                className="text-xs text-emerald-400 hover:text-emerald-300 px-1"
                              >확인</button>
                              <button onClick={() => setLevelEditId(null)} className="text-xs text-neutral-500 hover:text-neutral-300 px-1">취소</button>
                            </span>
                          ) : (
                            <button
                              onClick={() => { setLevelEditId(u.id); setLevelInput(String(getLevelInfo(u.xp).level)); }}
                              className="text-xs text-blue-400 border border-blue-900/60 rounded px-1.5 py-0.5 hover:bg-blue-500/10 transition-colors"
                              title="클릭해서 레벨 직접 설정"
                            >
                              Lv.{getLevelInfo(u.xp).level}
                            </button>
                          )}
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
                        {!isSelf && (
                          <button onClick={() => requestConfirm(`'${u.nickname ?? u.email}'의 퀴즈 데이터(풀이기록·포인트·경험치·뱃지·스트릭)를 초기화하시겠습니까?`, () => doAction(u.id, 'reset-stats'))}
                            disabled={!!actionLoading || isSelf}
                            className="rounded-md bg-orange-500/10 border border-orange-500/30 text-orange-400 text-xs px-3 py-1.5 hover:bg-orange-500/20 transition-colors disabled:opacity-40">
                            통계초기화
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
            <div className="mt-4">
              <PaginationNav
                page={page}
                pageCount={pageCount}
                onChange={(p) => { setPage(p); setSelectedIds(new Set()); }}
              />
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

  interface InquiriesResponse { inquiries: AdminInquiry[]; total: number; pageCount: number; }

  const { data: inqData, isLoading } = useQuery<InquiriesResponse>({
    queryKey: ['admin', 'inquiries', statusFilter, typeFilter, sortOrder, page],
    queryFn: async () => {
      const params = new URLSearchParams({ status: statusFilter, type: typeFilter, sort: sortOrder, page: String(page) });
      const r = await fetch(`/api/admin/inquiries?${params}`);
      if (!r.ok) return { inquiries: [], total: 0, pageCount: 1 };
      return r.json();
    },
  });

  const paged = inqData?.inquiries ?? [];
  const pageCount = inqData?.pageCount ?? 1;

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
        <span className="text-xs text-neutral-500">{inqData?.total ?? 0}건</span>
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

      {paged.length === 0 ? (
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
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-neutral-500">문의자 이메일</span>
                      <span className="text-xs text-neutral-300 font-mono">{inq.user.email}</span>
                      <button
                        onClick={() => { void navigator.clipboard.writeText(inq.user.email); toast.success('이메일이 복사되었습니다.'); }}
                        title="이메일 복사"
                        className="p-1 rounded text-neutral-600 hover:text-white transition-colors"
                      >
                        <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                          <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
                        </svg>
                      </button>
                    </div>
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
            <div className="mt-4">
              <PaginationNav
                page={page}
                pageCount={pageCount}
                onChange={(p) => { setPage(p); setExpandedId(null); setSelectedIds(new Set()); }}
              />
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
  REGISTER: '신규가입',
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
  COMMENT_DELETE: '댓글 삭제',
};

const ACTION_COLOR: Record<string, string> = {
  REGISTER: 'text-emerald-400 border-emerald-500/30',
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
  COMMENT_DELETE: 'text-red-400 border-red-500/30',
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
    queryFn: async () => {
      const r = await fetch('/api/admin/users?page=1&limit=1000');
      if (!r.ok) return [];
      const json = await r.json() as { users?: AdminUser[] };
      return Array.isArray(json) ? json : (json.users ?? []);
    },
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
          <div className="pt-2">
            <PaginationNav page={page} pageCount={pageCount} onChange={setPage} />
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
  chartNewUsers: { label: string; count: number }[];
  categoryStats: { category: string; attempts: number }[];
  todayVisitorList: { nickname: string | null; email: string }[];
  todayNewUserList: { nickname: string | null; email: string }[];
  todayQuizList: { nickname: string | null; email: string }[];
}

type Period = 'day' | 'month' | 'year';

function formatChartLabel(label: string, period: Period): string {
  if (period === 'year') return `${parseInt(label.slice(5))}`;
  if (period === 'month') return `${parseInt(label.slice(8))}`;
  const [, m, d] = label.split('-');
  return `${parseInt(m)}/${parseInt(d)}`;
}

function MiniBarChart({ data, color, period }: { data: { label: string; count: number }[]; color: string; period: Period }) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const maxCount = Math.max(...data.map((d) => d.count), 1);
  const MAX_BAR_PX = 72;

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
              {isHovered && (
                <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 z-10 pointer-events-none">
                  <div className="bg-neutral-800 border border-neutral-700 rounded px-1.5 py-1 text-[9px] text-white whitespace-nowrap shadow text-center leading-tight">
                    <div className="text-neutral-400">{formatChartLabel(d.label, period)}</div>
                    <div className="font-semibold">{d.count.toLocaleString()}</div>
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

const CAT_LABEL_MAP: Record<string, string> = {
  ds: '자료구조', algo: '알고리즘', os: '운영체제', network: '네트워크',
  db: '데이터베이스', arch: '컴퓨터 구조', se: '소프트웨어공학',
};

function CategoryQuestionStats() {
  const { data } = useQuery<{ category: string; count: number }[]>({
    queryKey: ['admin', 'category-question-stats'],
    queryFn: () => fetch('/api/admin/category-stats').then((r) => r.json()),
    staleTime: 60_000,
  });
  if (!data) return null;
  const total = data.reduce((a, b) => a + b.count, 0);
  return (
    <div className="bg-[#111111] border border-neutral-800 rounded-xl p-4">
      <p className="text-xs font-medium text-neutral-400 mb-3">카테고리별 문제 수</p>
      <div className="grid grid-cols-4 gap-2">
        {data.map(({ category, count }) => (
          <div key={category} className="bg-neutral-900 rounded-lg px-3 py-2">
            <p className="text-[10px] text-neutral-500 mb-0.5">{CAT_LABEL_MAP[category] ?? category}</p>
            <p className="text-sm font-semibold text-white">{count.toLocaleString()}</p>
          </div>
        ))}
        <div className="bg-neutral-900 rounded-lg px-3 py-2">
          <p className="text-[10px] text-neutral-500 mb-0.5">전체</p>
          <p className="text-sm font-semibold text-emerald-400">{total.toLocaleString()}</p>
        </div>
      </div>
    </div>
  );
}

interface PointsTx {
  id: string;
  delta: number;
  reason: string;
  createdAt: string;
  user: { nickname: string | null; email: string };
}

function PointsLogTab() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');

  const { data, isLoading } = useQuery<{ transactions: PointsTx[]; totalCount: number; pageCount: number }>({
    queryKey: ['admin', 'points-log', page, query],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page) });
      if (query) params.set('user', query);
      return fetch(`/api/admin/points-log?${params}`).then((r) => r.json());
    },
    staleTime: 30_000,
  });

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setQuery(search);
    setPage(1);
  }

  const transactions = data?.transactions ?? [];

  return (
    <div className="space-y-4">
      <form onSubmit={handleSearch} className="flex gap-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="닉네임 또는 이메일 검색"
          className="flex-1 bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-white placeholder-neutral-600 focus:outline-none focus:border-neutral-500"
        />
        <button type="submit" className="px-4 py-2 rounded-lg bg-white text-black text-sm font-medium hover:bg-neutral-200 transition-colors">
          검색
        </button>
      </form>
      {isLoading ? (
        <div className="h-32 bg-neutral-800/40 rounded-xl animate-pulse" />
      ) : (
        <>
          <p className="text-xs text-neutral-500">총 {data?.totalCount.toLocaleString()}건</p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-neutral-500 border-b border-neutral-800">
                  <th className="text-left pb-2 font-normal">일시</th>
                  <th className="text-left pb-2 font-normal">유저</th>
                  <th className="text-right pb-2 font-normal">포인트</th>
                  <th className="text-left pb-2 font-normal pl-3">사유</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((tx) => (
                  <tr key={tx.id} className="border-b border-neutral-800/50 last:border-0">
                    <td className="py-2 text-neutral-500 whitespace-nowrap">
                      {new Date(tx.createdAt).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="py-2 text-neutral-300">
                      <span>{tx.user.nickname ?? tx.user.email}</span>
                      <span className="text-neutral-600 ml-1">({tx.user.email})</span>
                    </td>
                    <td className={`py-2 text-right font-mono font-semibold ${tx.delta > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {tx.delta > 0 ? '+' : ''}{tx.delta}P
                    </td>
                    <td className="py-2 pl-3 text-neutral-500">{tx.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {(data?.pageCount ?? 0) > 1 && (
            <div className="pt-2">
              <PaginationNav page={page} pageCount={data?.pageCount ?? 1} onChange={setPage} />
            </div>
          )}
        </>
      )}
    </div>
  );
}

interface InfraStats {
  dbSize: string;
  aiQGenToday: number;
  aiQGenTotal: number;
  aiOptGenToday: number;
  aiOptGenTotal: number;
}

function InfraTooltip({ text }: { text: string }) {
  const [visible, setVisible] = useState(false);
  return (
    <span className="relative inline-flex items-center">
      <button
        type="button"
        onMouseEnter={() => setVisible(true)}
        onMouseLeave={() => setVisible(false)}
        className="w-3.5 h-3.5 rounded-full bg-neutral-700 text-neutral-400 text-[9px] font-bold leading-none flex items-center justify-center hover:bg-neutral-600 hover:text-white transition-colors flex-shrink-0"
      >
        !
      </button>
      {visible && (
        <span className="absolute left-5 top-1/2 -translate-y-1/2 z-50 w-56 bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-[11px] text-neutral-300 leading-relaxed shadow-xl pointer-events-none whitespace-normal">
          {text}
        </span>
      )}
    </span>
  );
}

function AnalyticsTab() {
  const [chartPeriod, setChartPeriod] = useState<'month' | 'year'>('month');
  const [targetYear, setTargetYear] = useState(String(new Date().getFullYear()));
  const [targetMonth, setTargetMonth] = useState(String(new Date().getMonth() + 1).padStart(2, '0'));
  const [sidePanel, setSidePanel] = useState<'online' | 'visitors' | 'newusers' | 'quizzes' | null>(null);

  const availableYears = Array.from({ length: 5 }, (_, i) => String(new Date().getFullYear() - i));

  const { data: infraData, isLoading: infraLoading } = useQuery<InfraStats>({
    queryKey: ['admin', 'infra-stats'],
    queryFn: () => fetch('/api/admin/infra-stats').then((r) => r.json()),
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

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
  const todayNewUserList = todayData?.todayNewUserList ?? [];
  const todayQuizList = todayData?.todayQuizList ?? [];

  return (
    <div className="space-y-6">
      <CategoryQuestionStats />
      <DailyResetButton />

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
              : sidePanel === 'visitors'
              ? `오늘 방문자 (${todayVisitorList.length}명)`
              : sidePanel === 'quizzes'
              ? `오늘 퀴즈 풀기 (${todayQuizList.length}명)`
              : `오늘 신규 가입 (${todayNewUserList.length}명)`}
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
          ) : sidePanel === 'visitors' ? (
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
          ) : sidePanel === 'quizzes' ? (
            todayQuizList.length === 0 ? (
              <p className="text-xs text-neutral-600 py-4 text-center">오늘 퀴즈 풀기 기록 없음</p>
            ) : (
              <div className="space-y-1">
                {todayQuizList.map((v, i) => (
                  <div key={i} className="flex items-center gap-3 py-2.5 border-b border-neutral-800/50 last:border-0">
                    <div className="w-8 h-8 rounded-full bg-violet-500/20 border border-violet-500/30 flex items-center justify-center flex-shrink-0">
                      <span className="text-xs font-semibold text-violet-400">
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
          ) : (
            todayNewUserList.length === 0 ? (
              <p className="text-xs text-neutral-600 py-4 text-center">오늘 신규 가입 없음</p>
            ) : (
              <div className="space-y-1">
                {todayNewUserList.map((v, i) => (
                  <div key={i} className="flex items-center gap-3 py-2.5 border-b border-neutral-800/50 last:border-0">
                    <div className="w-8 h-8 rounded-full bg-amber-500/20 border border-amber-500/30 flex items-center justify-center flex-shrink-0">
                      <span className="text-xs font-semibold text-amber-400">
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
          <AStatCard label="오늘 퀴즈 풀기" value={todayData?.periodAttempts ?? 0} dot="bg-violet-500" color="text-violet-400" loading={todayLoading} onClick={() => setSidePanel('quizzes')} />
          <AStatCard label="오늘 신규 가입" value={todayNewUserList.length} dot="bg-amber-500" color="text-amber-400" loading={todayLoading} onClick={() => setSidePanel('newusers')} />
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

        {/* 차트 3개 */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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
          <div className="bg-[#111111] border border-neutral-800 rounded-xl px-4 py-4">
            <p className="text-xs font-medium text-neutral-300 mb-3">신규 가입 추이</p>
            {chartLoading ? (
              <div className="h-24 bg-neutral-800 rounded animate-pulse" />
            ) : chartData ? (
              <MiniBarChart data={chartData.chartNewUsers ?? []} color="bg-amber-500" period={chartPeriod} />
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

      {/* ── 외부 서비스 현황 ── */}
      <div>
        <p className="text-[10px] text-neutral-600 font-bold uppercase tracking-widest mb-3">외부 서비스</p>
        <div className="bg-[#111111] border border-neutral-800 rounded-xl divide-y divide-neutral-800">
          {/* DB 크기 */}
          <div className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span className="text-xs text-neutral-400">Supabase DB 크기</span>
              <InfraTooltip text="PostgreSQL DB 전체 크기. pg_size_pretty(pg_database_size()) 로 서버에서 직접 조회. 무료 플랜 한도 500MB — 초과 시 업그레이드 필요." />
            </div>
            {infraLoading ? (
              <div className="h-4 w-16 bg-neutral-800 rounded animate-pulse" />
            ) : (
              <span className="text-xs font-semibold text-white">
                {infraData?.dbSize ?? '-'} <span className="text-neutral-600 font-normal">/ 500MB 무료</span>
              </span>
            )}
          </div>
          {/* Realtime */}
          <div className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-sky-500" />
              <span className="text-xs text-neutral-400">Supabase Realtime</span>
              <InfraTooltip text="대결·채팅·알림·친구 패널 실시간 동기화에 사용. 무료 한도: 동시접속 200명 / 월 200만 메시지. 수치는 Supabase 대시보드에서 확인." />
            </div>
            <a
              href="https://supabase.com/dashboard/project/deyxefkihidlbskrjxsw/reports/realtime"
              target="_blank"
              rel="noreferrer"
              className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
            >
              대시보드 →
            </a>
          </div>
          {/* AI 문제생성 — 오늘 */}
          <div className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-violet-500" />
              <span className="text-xs text-neutral-400">AI 문제생성 (오늘)</span>
              <InfraTooltip text="오늘(자정~현재) 관리자가 [AI 문제 자동생성] 기능을 실행한 횟수. 실행 1회 = 배치 최대 10문제(GPT-4o). AuditLog(AI_QUESTION_GENERATE)에서 집계." />
            </div>
            {infraLoading ? (
              <div className="h-4 w-10 bg-neutral-800 rounded animate-pulse" />
            ) : (
              <span className="text-xs font-semibold text-violet-300">{infraData?.aiQGenToday ?? 0}회</span>
            )}
          </div>
          {/* AI 문제생성 — 누적 */}
          <div className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-violet-400" />
              <span className="text-xs text-neutral-400">AI 문제생성 (누적)</span>
              <InfraTooltip text="2026-07-07 이후 AI 문제생성 실행 횟수 누적. 그 이전 생성분은 미집계. 실제 토큰·비용은 OpenAI 대시보드에서 확인." />
            </div>
            <div className="flex items-center gap-3">
              {infraLoading ? (
                <div className="h-4 w-10 bg-neutral-800 rounded animate-pulse" />
              ) : (
                <span className="text-xs font-semibold text-violet-300">{infraData?.aiQGenTotal ?? 0}회</span>
              )}
              <a href="https://platform.openai.com/usage" target="_blank" rel="noreferrer" className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors">
                OpenAI 대시보드 →
              </a>
            </div>
          </div>
          {/* AI 오답보기생성 — 오늘 */}
          <div className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-fuchsia-500" />
              <span className="text-xs text-neutral-400">AI 오답보기생성 (오늘)</span>
              <InfraTooltip text="오늘 유저들이 문제 등록 시 [보기+해설 자동생성] 버튼을 누른 횟수. 1회 = 오답 3개+해설 생성(GPT-4o-mini). AuditLog(AI_OPTION_GENERATE)에서 집계." />
            </div>
            {infraLoading ? (
              <div className="h-4 w-10 bg-neutral-800 rounded animate-pulse" />
            ) : (
              <span className="text-xs font-semibold text-fuchsia-300">{infraData?.aiOptGenToday ?? 0}회</span>
            )}
          </div>
          {/* AI 오답보기생성 — 누적 */}
          <div className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-fuchsia-400" />
              <span className="text-xs text-neutral-400">AI 오답보기생성 (누적)</span>
              <InfraTooltip text="2026-07-07 이후 유저 오답보기 자동생성 누적 횟수. 그 이전 생성분은 미집계." />
            </div>
            {infraLoading ? (
              <div className="h-4 w-10 bg-neutral-800 rounded animate-pulse" />
            ) : (
              <span className="text-xs font-semibold text-fuchsia-300">{infraData?.aiOptGenTotal ?? 0}회</span>
            )}
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
        <div className="pt-2">
          <PaginationNav page={page} pageCount={totalPages} onChange={setPage} />
        </div>
      )}
    </div>
  );
}

// ───────── 일일 도전 관리 ─────────
function DailyResetButton() {
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');

  async function handleReset() {
    if (!confirm('오늘의 퀴즈 참여 기록을 전부 삭제하시겠습니까?\n(모든 유저가 오늘 다시 도전 가능해집니다)')) return;
    setLoading(true);
    setMsg('');
    try {
      const res = await fetch('/api/admin/daily-reset', { method: 'DELETE' });
      const data = await res.json() as { deleted?: { completions: number } };
      setMsg(`완료 — ${data.deleted?.completions ?? 0}개 기록 삭제됨`);
    } catch {
      setMsg('오류 발생');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center gap-3 p-4 rounded-lg border border-neutral-800 bg-[#0d0d0d]">
      <div className="flex-1">
        <p className="text-sm font-medium text-white">오늘의 문제 초기화</p>
        <p className="text-xs text-neutral-500 mt-0.5">오늘 도전자 기록 삭제 → 전원 재도전 가능</p>
        {msg && <p className="text-xs text-emerald-400 mt-1">{msg}</p>}
      </div>
      <button
        onClick={handleReset}
        disabled={loading}
        className="rounded-md bg-red-500/10 border border-red-500/30 text-red-400 text-xs px-4 py-2 hover:bg-red-500/20 transition-colors disabled:opacity-40 whitespace-nowrap"
      >
        {loading ? '처리 중...' : '초기화'}
      </button>
    </div>
  );
}

// ───────── AI 문제 생성 탭 ─────────

const GENERATE_CATEGORIES = [
  { key: 'ds', label: '자료구조' },
  { key: 'algo', label: '알고리즘' },
  { key: 'os', label: '운영체제' },
  { key: 'network', label: '네트워크' },
  { key: 'db', label: '데이터베이스' },
  { key: 'arch', label: '컴퓨터 구조' },
  { key: 'se', label: '소프트웨어공학' },
];

const DIFFICULTY_OPTIONS = [
  { key: 'easy', label: '쉬움', desc: '기초 개념, 핵심 용어' },
  { key: 'medium', label: '중간', desc: '개념 응용, 비교 분석' },
  { key: 'hard', label: '어려움', desc: '심화, 엣지케이스, 트레이드오프' },
];

function GenerateQuestionsTab() {
  const queryClient = useQueryClient();
  const [category, setCategory] = useState('se');
  const [count, setCount] = useState(20);
  const [difficulty, setDifficulty] = useState('medium');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ generated: number; saved: number; skipped: number } | null>(null);
  const [error, setError] = useState('');

  const { data: catStats } = useQuery<{ category: string; count: number }[]>({
    queryKey: ['admin', 'category-question-stats'],
    queryFn: () => fetch('/api/admin/category-stats').then((r) => r.json()),
    staleTime: 30_000,
  });
  const totalQuestions = catStats?.reduce((a, b) => a + b.count, 0) ?? 0;
  const catStatsMap = Object.fromEntries((catStats ?? []).map((c) => [c.category, c.count]));

  // 생성 중(최대 50개, 배치당 여러 번 GPT 호출) 탭을 닫으면 서버 요청은 끝까지 진행돼
  // 토큰만 소모되고 결과를 못 받으므로 경고
  useEffect(() => {
    if (!loading) return;
    function handleBeforeUnload(e: BeforeUnloadEvent) {
      e.preventDefault();
    }
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [loading]);

  async function handleGenerate() {
    setLoading(true);
    setResult(null);
    setError('');
    try {
      const res = await fetch('/api/admin/generate-questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category, count, difficulty }),
      });
      if (!res.ok) {
        const d = await res.json() as { error?: string };
        setError(d.error ?? '생성 실패');
        return;
      }
      const d = await res.json() as { generated: number; saved: number; skipped: number };
      setResult(d);
      queryClient.invalidateQueries({ queryKey: ['admin', 'category-question-stats'] });
    } catch {
      setError('요청 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* 현재 문제 현황 */}
      <div className="bg-[#111111] border border-neutral-800 rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium text-neutral-400">현재 문제 현황 (OFFICIAL + APPROVED)</p>
          <p className="text-sm font-bold text-emerald-400">총 {totalQuestions.toLocaleString()}문제</p>
        </div>
        <div className="grid grid-cols-4 gap-2">
          {GENERATE_CATEGORIES.map((c) => (
            <div key={c.key} className={`rounded-lg px-3 py-2 border transition-colors ${category === c.key ? 'bg-neutral-700 border-neutral-500' : 'bg-neutral-900 border-neutral-800'}`}>
              <p className="text-[10px] text-neutral-500 mb-0.5">{c.label}</p>
              <p className="text-sm font-semibold text-white">{(catStatsMap[c.key] ?? 0).toLocaleString()}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-[#111111] border border-neutral-800 rounded-xl p-5 space-y-4">
        <h2 className="text-sm font-medium text-white">AI 문제 자동 생성</h2>
        <p className="text-xs text-neutral-500">
          GPT-4o로 문제를 생성하고 기존 문제와 유사도를 검사합니다.
          중복이 없는 문제만 PENDING 상태로 저장되며 검토 후 승인할 수 있습니다.
        </p>

        <div className="flex flex-wrap gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-neutral-400">카테고리</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="bg-[#1a1a1a] border border-neutral-700 rounded-md px-3 py-1.5 text-sm text-white focus:outline-none focus:border-neutral-500"
            >
              {GENERATE_CATEGORIES.map((c) => (
                <option key={c.key} value={c.key}>{c.label}</option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-neutral-400">난이도</label>
            <div className="flex gap-1">
              {DIFFICULTY_OPTIONS.map((d) => (
                <button
                  key={d.key}
                  type="button"
                  onClick={() => setDifficulty(d.key)}
                  title={d.desc}
                  className={`px-3 py-1.5 rounded-md text-sm transition-colors ${
                    difficulty === d.key
                      ? 'bg-white text-black font-medium'
                      : 'bg-[#1a1a1a] border border-neutral-700 text-neutral-300 hover:border-neutral-500'
                  }`}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-neutral-400">생성 개수</label>
            <div className="flex gap-1">
              {[10, 20, 30, 40, 50].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setCount(n)}
                  className={`px-3 py-1.5 rounded-md text-sm transition-colors ${
                    count === n
                      ? 'bg-white text-black font-medium'
                      : 'bg-[#1a1a1a] border border-neutral-700 text-neutral-300 hover:border-neutral-500'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
        </div>

        <button
          onClick={handleGenerate}
          disabled={loading}
          className="flex items-center gap-2 rounded-lg bg-white text-black text-sm font-medium px-5 py-2 hover:bg-neutral-200 transition-colors disabled:opacity-40"
        >
          {loading ? (
            <>
              <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="32" strokeDashoffset="12" />
              </svg>
              생성 중... (최대 1-2분 소요)
            </>
          ) : '생성 시작'}
        </button>

        {loading && (
          <p className="text-xs text-amber-500/80">
            생성 중에는 탭을 닫거나 새로고침하지 마세요 — 벗어나도 서버 요청은 계속 진행돼 토큰만 소모되고 결과를 받지 못합니다.
          </p>
        )}

        {error && (
          <p className="text-sm text-red-400">{error}</p>
        )}

        {result && (
          <div className="bg-neutral-900 border border-neutral-700 rounded-lg p-4 space-y-1">
            <p className="text-sm text-white font-medium">생성 완료</p>
            <p className="text-xs text-neutral-400">GPT 생성: <span className="text-white">{result.generated}개</span></p>
            <p className="text-xs text-neutral-400">중복 제외: <span className="text-amber-400">{result.skipped}개</span></p>
            <p className="text-xs text-neutral-400">저장됨 (PENDING): <span className="text-emerald-400">{result.saved}개</span></p>
            <p className="text-xs text-neutral-500 pt-1">승인 대기 탭에서 검토 후 승인하세요.</p>
          </div>
        )}
      </div>
    </div>
  );
}

const BASE_BLOCKED_WORDS_DISPLAY = [
  'admin', 'administrator', 'root', 'system', 'mod', 'moderator',
  'csora', '운영자', '관리자', '개발자', '시스템', '공식',
  'staff', 'official', 'support', 'help',
  '씨발', '씨빨', '쌍년', '쌍놈', '존나', '존내', '졸라', 'ㅈㄴ',
  '미친', '미칠', 'ㅁㅊ', '애미', '애비', '에미', '에비',
  '씹', '자지', '보지',
];

function BlockedWordsTab() {
  const queryClient = useQueryClient();
  const [input, setInput] = useState('');
  const [showListModal, setShowListModal] = useState(false);

  const { data: customWords = [], isLoading } = useQuery<{ id: string; word: string; createdAt: string }[]>({
    queryKey: ['admin-blocked-words'],
    queryFn: () => fetch('/api/admin/blocked-words').then((r) => r.json()),
  });

  const addMutation = useMutation({
    mutationFn: (words: string[]) =>
      fetch('/api/admin/blocked-words', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ words }),
      }).then(async (r) => {
        if (!r.ok) throw new Error((await r.json()).error);
        return r.json() as Promise<{ added: number; skipped: number }>;
      }),
    onSuccess: (data) => {
      setInput('');
      void queryClient.invalidateQueries({ queryKey: ['admin-blocked-words'] });
      if (data.skipped > 0) {
        toast.success(`${data.added}개 추가, ${data.skipped}개 중복 건너뜀`);
      } else {
        toast.success(`${data.added}개 추가되었습니다.`);
      }
    },
    onError: () => toast.error('추가에 실패했습니다.'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      fetch('/api/admin/blocked-words', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-blocked-words'] });
      toast.success('삭제되었습니다.');
    },
  });

  return (
    <div className="space-y-6">
      <div className="bg-[#111111] border border-neutral-800 rounded-lg p-5">
        <h2 className="text-sm font-medium text-white mb-1">금칙어 추가</h2>
        <p className="text-xs text-neutral-500 mb-4">
          쉼표(,) 또는 줄바꿈으로 구분해 여러 단어를 한꺼번에 추가할 수 있습니다.
          소문자로 저장되며 <span className="text-neutral-400">닉네임 어디에 포함되든</span> 차단됩니다.
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const words = input
              .split(/[\n,]/)
              .map((w) => w.trim())
              .filter((w) => w.length > 0);
            if (words.length > 0) addMutation.mutate(words);
          }}
          className="space-y-2"
        >
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={'단어1, 단어2, 단어3\n또는 줄바꿈으로 구분'}
            rows={3}
            className="w-full bg-[#1a1a1a] border border-neutral-800 rounded-md px-3 py-2 text-sm text-white placeholder-neutral-600 focus:outline-none focus:border-neutral-600 resize-none"
          />
          <div className="flex justify-between items-center">
            <span className="text-xs text-neutral-600">
              {input.split(/[\n,]/).map((w) => w.trim()).filter((w) => w.length > 0).length > 0
                ? `${input.split(/[\n,]/).map((w) => w.trim()).filter((w) => w.length > 0).length}개 입력됨`
                : ''}
            </span>
            <button
              type="submit"
              disabled={!input.trim() || addMutation.isPending}
              className="rounded-md bg-white text-black text-sm font-medium px-4 py-2 hover:bg-neutral-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {addMutation.isPending ? '추가 중...' : '추가'}
            </button>
          </div>
        </form>
      </div>

      <div className="bg-[#111111] border border-neutral-800 rounded-lg p-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-medium text-white mb-1">금칙어 목록</h2>
            <p className="text-xs text-neutral-500">
              관리자 추가 {isLoading ? '–' : customWords.length}개 + 기본 {BASE_BLOCKED_WORDS_DISPLAY.length}개
            </p>
          </div>
          <button
            onClick={() => setShowListModal(true)}
            className="text-xs text-neutral-300 border border-neutral-700 rounded-md px-3 py-1.5 hover:border-neutral-500 hover:text-white transition-colors flex-shrink-0"
          >
            전체 목록 보기 →
          </button>
        </div>
      </div>

      {showListModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" onClick={() => setShowListModal(false)}>
          <div className="w-full max-w-lg max-h-[80vh] flex flex-col bg-[#111111] border border-neutral-700 rounded-xl shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-800 flex-shrink-0">
              <h3 className="text-sm font-semibold text-white">금칙어 전체 목록</h3>
              <button onClick={() => setShowListModal(false)} className="text-neutral-500 hover:text-white transition-colors p-1">
                <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
              </button>
            </div>
            <div className="px-5 py-4 overflow-y-auto">
              <p className="text-xs text-neutral-500 mb-4">
                관리자 추가 단어는 삭제 가능, 기본 단어(흐리게 표시)는 읽기 전용입니다.
                기본 단어 수정은{' '}
                <code className="text-neutral-400 bg-neutral-900 rounded px-1">src/lib/nickname-filter.ts</code>를,
                korcen 패턴 전체는{' '}
                <a href="https://github.com/Tanat05/korcen.ts/blob/stable/src/checkBadLang.ts" target="_blank" rel="noreferrer" className="text-blue-400 hover:underline">
                  여기 (checkBadLang.ts)
                </a>에서 확인하세요.
              </p>
              {isLoading ? (
                <p className="text-xs text-neutral-500">불러오는 중...</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {customWords.map((w) => (
                    <span key={w.id} className="inline-flex items-center gap-1.5 text-xs bg-neutral-900 border border-neutral-700 rounded px-2.5 py-1 text-neutral-300">
                      {w.word}
                      <button
                        onClick={() => deleteMutation.mutate(w.id)}
                        className="text-neutral-600 hover:text-red-400 transition-colors"
                        title="삭제"
                      >
                        ✕
                      </button>
                    </span>
                  ))}
                  {BASE_BLOCKED_WORDS_DISPLAY.map((w) => (
                    <span key={w} className="text-xs bg-neutral-900 border border-neutral-700 rounded px-2.5 py-1 text-neutral-500">
                      {w}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const USER_REPORT_REASON_LABEL: Record<string, string> = {
  INAPPROPRIATE_NICKNAME: '부적절한 닉네임',
  HARASSMENT: '괴롭힘/욕설',
  SPAM: '도배/스팸',
  OTHER: '기타',
};

interface UserReportItem {
  id: string;
  reason: string;
  description: string | null;
  status: string;
  createdAt: string;
  reporter: { id: string; nickname: string | null; email: string };
  reported: { id: string; nickname: string | null; email: string };
}

interface CommentReportItem {
  id: string;
  reason: string;
  description: string | null;
  status: string;
  createdAt: string;
  reporter: { nickname: string | null };
}

interface CommentReportGroup {
  commentId: string;
  comment: {
    id: string;
    content: string;
    deletedAt: string | null;
    userId: string;
    user: { nickname: string | null };
    question: { id: string; question: string; category: string };
  };
  reportCount: number;
  latestReportAt: string;
  dismissed: boolean;
  reports: CommentReportItem[];
}

const COMMENT_REPORT_REASON_LABEL: Record<string, string> = {
  INAPPROPRIATE: '부적절한 내용',
  SPAM: '스팸/광고',
  HARASSMENT: '욕설/비방',
  OTHER: '기타',
};

