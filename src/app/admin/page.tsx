'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

type Tab = 'questions' | 'board' | 'reports' | 'users';

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
  author: { nickname: string | null; email: string } | null;
}
interface ReportItem {
  id: string; reason: string; description: string | null;
  reporter: { nickname: string | null };
}
interface ReportGroup {
  question: { id: string; category: string; question: string; status: string };
  reportCount: number; reports: ReportItem[];
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

export default function AdminPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>('questions');

  if (status === 'loading') return null;
  if (!session || session.user?.role !== 'ADMIN') {
    router.replace('/');
    return null;
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: 'questions', label: '승인 대기' },
    { key: 'board', label: '게시판 관리' },
    { key: 'reports', label: '신고 접수' },
    { key: 'users', label: '유저 관리' },
  ];

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-semibold text-white mb-6">관리자 패널</h1>
      <div className="flex gap-1 mb-6 border-b border-neutral-800 overflow-x-auto">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={`px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors ${
              activeTab === t.key
                ? 'text-white border-b-2 border-white'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      {activeTab === 'questions' && <QuestionsTab />}
      {activeTab === 'board' && <BoardTab />}
      {activeTab === 'reports' && <ReportsTab />}
      {activeTab === 'users' && <UsersTab currentUserId={session.user?.id ?? ''} />}
    </div>
  );
}

function QuestionsTab() {
  const queryClient = useQueryClient();
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');

  const { data: questions = [] } = useQuery<PendingQuestion[]>({
    queryKey: ['admin', 'questions'],
    queryFn: () => fetch('/api/admin/questions').then((r) => r.json()),
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
      setRejectionReason('');
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
          </div>
          <p className="text-sm text-neutral-200 mb-4 leading-relaxed">
            {q.question.length > 120 ? q.question.slice(0, 120) + '…' : q.question}
          </p>
          {rejectingId === q.id ? (
            <div className="space-y-2">
              <input
                type="text"
                placeholder="거절 이유 (비워두면 기본 메시지 사용)"
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                className="w-full bg-[#1a1a1a] border border-neutral-700 rounded-md px-3 py-2 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-neutral-500"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => mutation.mutate({ id: q.id, action: 'reject', reason: rejectionReason })}
                  disabled={mutation.isPending}
                  className="rounded-md bg-red-500/10 border border-red-500/30 text-red-400 text-xs px-3 py-1.5 hover:bg-red-500/20 transition-colors disabled:opacity-40"
                >
                  거절 확인
                </button>
                <button
                  onClick={() => { setRejectingId(null); setRejectionReason(''); }}
                  className="rounded-md border border-neutral-700 text-neutral-400 text-xs px-3 py-1.5 hover:text-white transition-colors"
                >
                  취소
                </button>
              </div>
            </div>
          ) : (
            <div className="flex gap-2">
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
              <a
                href={`/board/${q.id}`}
                target="_blank"
                rel="noreferrer"
                className="rounded-md border border-neutral-800 text-neutral-500 text-xs px-3 py-1.5 hover:text-white transition-colors"
              >
                상세 보기
              </a>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function BoardTab() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState('all');
  const [catFilter, setCatFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [editState, setEditState] = useState<EditState | null>(null);
  const [editSaving, setEditSaving] = useState(false);

  const { data, isLoading } = useQuery<BoardResponse>({
    queryKey: ['admin', 'board', statusFilter, catFilter, page],
    queryFn: () => {
      const params = new URLSearchParams({ status: statusFilter, cat: catFilter, page: String(page) });
      return fetch(`/api/admin/board?${params}`).then((r) => r.json());
    },
  });

  const questions = data?.questions ?? [];
  const pageCount = data?.pageCount ?? 1;
  const totalCount = data?.totalCount ?? 0;

  async function handleAction(id: string, action: 'blind' | 'unblind' | 'delete') {
    if (action === 'delete' && !window.confirm('정말 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) return;
    setActionLoading(id + ':' + action);
    try {
      await fetch(`/api/admin/questions/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      queryClient.invalidateQueries({ queryKey: ['admin', 'board'] });
    } finally {
      setActionLoading(null);
    }
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
          <div className="flex flex-wrap gap-1.5 mt-1">
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
            <p className="text-xs text-neutral-500 mb-3">총 {totalCount}개</p>
            <div className="space-y-3">
              {questions.map((q) => (
                <div key={q.id} className="bg-[#111111] border border-neutral-800 rounded-lg p-4">
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
                    <button
                      onClick={() => openEdit(q)}
                      className="rounded-md bg-[#1a1a1a] border border-neutral-700 text-neutral-300 text-xs px-3 py-1.5 hover:text-white transition-colors"
                    >
                      수정
                    </button>
                    {q.status !== 'BLINDED' ? (
                      <button
                        onClick={() => handleAction(q.id, 'blind')}
                        disabled={actionLoading === q.id + ':blind' || q.status === 'OFFICIAL'}
                        className="rounded-md bg-[#1a1a1a] border border-neutral-700 text-neutral-400 text-xs px-3 py-1.5 hover:text-white transition-colors disabled:opacity-30"
                      >
                        블라인드
                      </button>
                    ) : (
                      <button
                        onClick={() => handleAction(q.id, 'unblind')}
                        disabled={actionLoading === q.id + ':unblind'}
                        className="rounded-md bg-green-500/10 border border-green-500/30 text-green-400 text-xs px-3 py-1.5 hover:bg-green-500/20 transition-colors disabled:opacity-40"
                      >
                        공개
                      </button>
                    )}
                    <button
                      onClick={() => handleAction(q.id, 'delete')}
                      disabled={actionLoading === q.id + ':delete'}
                      className="rounded-md bg-red-500/10 border border-red-500/30 text-red-400 text-xs px-3 py-1.5 hover:bg-red-500/20 transition-colors disabled:opacity-40"
                    >
                      삭제
                    </button>
                    <a
                      href={`/board/${q.id}`}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-md border border-neutral-800 text-neutral-500 text-xs px-3 py-1.5 hover:text-white transition-colors"
                    >
                      보기
                    </a>
                  </div>
                </div>
              ))}
            </div>
            {pageCount > 1 && (
              <div className="flex gap-2 mt-4 justify-center items-center">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="rounded-md border border-neutral-800 text-neutral-400 text-xs px-3 py-1.5 hover:text-white disabled:opacity-30 transition-colors"
                >
                  이전
                </button>
                <span className="text-xs text-neutral-500">{page} / {pageCount}</span>
                <button
                  onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                  disabled={page >= pageCount}
                  className="rounded-md border border-neutral-800 text-neutral-400 text-xs px-3 py-1.5 hover:text-white disabled:opacity-30 transition-colors"
                >
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
                onClick={saveEdit}
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

function ReportsTab() {
  const queryClient = useQueryClient();

  const { data: reportGroups = [] } = useQuery<ReportGroup[]>({
    queryKey: ['admin', 'reports'],
    queryFn: () => fetch('/api/admin/reports').then((r) => r.json()),
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
    },
  });

  if (reportGroups.length === 0) {
    return <p className="text-neutral-500 text-sm text-center py-8">처리할 신고가 없습니다.</p>;
  }

  return (
    <div className="space-y-4">
      {reportGroups.map((group) => (
        <div key={group.question.id} className="bg-[#111111] border border-neutral-800 rounded-lg p-5">
          <div className="flex items-start justify-between gap-4 mb-3">
            <div className="flex items-center gap-2">
              <span className="text-xs text-neutral-500 border border-neutral-800 rounded px-2 py-0.5">
                {CATEGORY_LABEL[group.question.category] ?? group.question.category}
              </span>
              <span className="text-xs text-neutral-500">신고 {group.reportCount}건</span>
              {group.question.status === 'BLINDED' && (
                <span className="text-xs text-red-400 border border-red-500/30 rounded px-1.5 py-0.5">
                  블라인드됨
                </span>
              )}
            </div>
            <a
              href={`/board/${group.question.id}`}
              target="_blank"
              rel="noreferrer"
              className="text-xs text-neutral-500 hover:text-white transition-colors underline"
            >
              문제 보기
            </a>
          </div>
          <p className="text-sm text-neutral-200 mb-3 leading-relaxed">
            {group.question.question.length > 80
              ? group.question.question.slice(0, 80) + '…'
              : group.question.question}
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
          <div className="flex gap-2">
            <button
              onClick={() => mutation.mutate({ questionId: group.question.id, action: 'blind' })}
              disabled={mutation.isPending || group.question.status === 'BLINDED'}
              className="rounded-md bg-red-500/10 border border-red-500/30 text-red-400 text-xs px-3 py-1.5 hover:bg-red-500/20 transition-colors disabled:opacity-40"
            >
              블라인드
            </button>
            <button
              onClick={() => mutation.mutate({ questionId: group.question.id, action: 'dismiss' })}
              disabled={mutation.isPending}
              className="rounded-md bg-[#1a1a1a] border border-neutral-700 text-neutral-400 text-xs px-3 py-1.5 hover:text-white transition-colors disabled:opacity-40"
            >
              무시
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

function UsersTab({ currentUserId }: { currentUserId: string }) {
  const queryClient = useQueryClient();
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const { data: users = [] } = useQuery<AdminUser[]>({
    queryKey: ['admin', 'users'],
    queryFn: () => fetch('/api/admin/users').then((r) => r.json()),
  });

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
          toast.info('사용자 권한이 변경되어 재로그인이 필요합니다.', { duration: 5000 });
        } else if (action === 'deactivate') {
          toast.success('탈퇴 처리되었습니다.');
        } else {
          toast.success('계정이 복구되었습니다.');
        }
        queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      } else {
        const data = await res.json() as { error?: string };
        toast.error(data.error ?? '처리에 실패했습니다.');
      }
    } finally {
      setActionLoading(null);
    }
  }

  if (users.length === 0) {
    return <p className="text-neutral-500 text-sm text-center py-8">유저가 없습니다.</p>;
  }

  return (
    <div className="space-y-3">
      {users.map((u) => {
        const isDeactivated = u.deletedAt !== null;
        const isSelf = u.id === currentUserId;
        return (
          <div
            key={u.id}
            className={`bg-[#111111] border rounded-lg p-4 ${isDeactivated ? 'border-neutral-800/50 opacity-60' : 'border-neutral-800'}`}
          >
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-sm font-medium ${isDeactivated ? 'text-neutral-500' : 'text-white'}`}>
                    {u.nickname ?? '(닉네임 미설정)'}
                  </span>
                  {u.role === 'ADMIN' && (
                    <span className="text-xs text-amber-400 border border-amber-400/30 rounded px-1.5 py-0.5">
                      ADMIN
                    </span>
                  )}
                  {isDeactivated && (
                    <span className="text-xs text-neutral-500 border border-neutral-700 rounded px-1.5 py-0.5">
                      탈퇴
                    </span>
                  )}
                  {isSelf && (
                    <span className="text-xs text-neutral-600 border border-neutral-800 rounded px-1.5 py-0.5">
                      나
                    </span>
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
                    onClick={() => doAction(u.id, u.role === 'ADMIN' ? 'set-user' : 'set-admin')}
                    disabled={!!actionLoading || isSelf}
                    className={`rounded-md text-xs px-3 py-1.5 transition-colors disabled:opacity-40 ${
                      u.role === 'ADMIN'
                        ? 'bg-[#1a1a1a] border border-neutral-700 text-neutral-400 hover:text-white'
                        : 'bg-amber-500/10 border border-amber-500/30 text-amber-400 hover:bg-amber-500/20'
                    }`}
                  >
                    {u.role === 'ADMIN' ? '일반으로' : '관리자로'}
                  </button>
                )}
                {isDeactivated ? (
                  <button
                    onClick={() => doAction(u.id, 'reactivate')}
                    disabled={!!actionLoading}
                    className="rounded-md bg-green-500/10 border border-green-500/30 text-green-400 text-xs px-3 py-1.5 hover:bg-green-500/20 transition-colors disabled:opacity-40"
                  >
                    복구
                  </button>
                ) : (
                  <button
                    onClick={() => doAction(u.id, 'deactivate')}
                    disabled={!!actionLoading || isSelf}
                    className="rounded-md bg-red-500/10 border border-red-500/30 text-red-400 text-xs px-3 py-1.5 hover:bg-red-500/20 transition-colors disabled:opacity-40"
                  >
                    탈퇴처리
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
