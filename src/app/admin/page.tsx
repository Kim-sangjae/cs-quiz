'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

type Author = { nickname: string | null; email: string };

interface PendingQuestion {
  id: string;
  category: string;
  question: string;
  createdAt: string;
  author: Author | null;
}

interface ReportItem {
  id: string;
  reason: string;
  description: string | null;
  reporter: { nickname: string | null };
}

interface ReportGroup {
  question: {
    id: string;
    category: string;
    question: string;
    status: string;
  };
  reportCount: number;
  reports: ReportItem[];
}

const CATEGORY_LABEL: Record<string, string> = {
  ds: '자료구조',
  algo: '알고리즘',
  os: '운영체제',
  network: '네트워크',
  db: '데이터베이스',
  arch: '컴퓨터 구조',
};

const REASON_LABEL: Record<string, string> = {
  INAPPROPRIATE: '부적절한 내용',
  ERROR: '오류 있음',
  DUPLICATE: '중복 문제',
  OTHER: '기타',
};

export default function AdminPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<'questions' | 'reports'>('questions');
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');

  if (status === 'loading') return null;
  if (!session || session.user?.role !== 'ADMIN') {
    router.replace('/');
    return null;
  }

  return <AdminPanel
    activeTab={activeTab}
    setActiveTab={setActiveTab}
    rejectingId={rejectingId}
    setRejectingId={setRejectingId}
    rejectionReason={rejectionReason}
    setRejectionReason={setRejectionReason}
    queryClient={queryClient}
  />;
}

function AdminPanel({
  activeTab,
  setActiveTab,
  rejectingId,
  setRejectingId,
  rejectionReason,
  setRejectionReason,
  queryClient,
}: {
  activeTab: 'questions' | 'reports';
  setActiveTab: (tab: 'questions' | 'reports') => void;
  rejectingId: string | null;
  setRejectingId: (id: string | null) => void;
  rejectionReason: string;
  setRejectionReason: (r: string) => void;
  queryClient: ReturnType<typeof useQueryClient>;
}) {
  const { data: pendingQuestions = [] } = useQuery<PendingQuestion[]>({
    queryKey: ['admin', 'questions'],
    queryFn: () => fetch('/api/admin/questions').then((r) => r.json()),
    enabled: activeTab === 'questions',
  });

  const { data: reportGroups = [] } = useQuery<ReportGroup[]>({
    queryKey: ['admin', 'reports'],
    queryFn: () => fetch('/api/admin/reports').then((r) => r.json()),
    enabled: activeTab === 'reports',
  });

  const questionMutation = useMutation({
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

  const reportMutation = useMutation({
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

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-semibold text-white mb-6">관리자 패널</h1>

      <div className="flex gap-2 mb-6 border-b border-neutral-800">
        <button
          onClick={() => setActiveTab('questions')}
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === 'questions'
              ? 'text-white border-b-2 border-white'
              : 'text-neutral-400 hover:text-white'
          }`}
        >
          승인 대기
          {pendingQuestions.length > 0 && (
            <span className="ml-2 text-xs bg-neutral-700 text-neutral-300 rounded px-1.5 py-0.5">
              {pendingQuestions.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('reports')}
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === 'reports'
              ? 'text-white border-b-2 border-white'
              : 'text-neutral-400 hover:text-white'
          }`}
        >
          신고 접수
          {reportGroups.length > 0 && (
            <span className="ml-2 text-xs bg-neutral-700 text-neutral-300 rounded px-1.5 py-0.5">
              {reportGroups.length}
            </span>
          )}
        </button>
      </div>

      {activeTab === 'questions' && (
        <div className="space-y-4">
          {pendingQuestions.length === 0 ? (
            <p className="text-neutral-500 text-sm text-center py-8">대기 중인 문제가 없습니다.</p>
          ) : (
            pendingQuestions.map((q) => (
              <div
                key={q.id}
                className="bg-[#111111] border border-neutral-800 rounded-lg p-5"
              >
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div className="flex items-center gap-2">
                    <span className="inline-block text-xs text-neutral-500 border border-neutral-800 rounded px-2 py-0.5">
                      {CATEGORY_LABEL[q.category] ?? q.category}
                    </span>
                    <span className="text-xs text-neutral-500">
                      {q.author?.nickname ?? q.author?.email ?? '(알 수 없음)'}
                    </span>
                    <span className="text-xs text-neutral-600">
                      {new Date(q.createdAt).toLocaleDateString('ko-KR')}
                    </span>
                  </div>
                </div>

                <p className="text-sm text-neutral-200 mb-4 leading-relaxed">
                  {q.question.slice(0, 80)}{q.question.length > 80 ? '…' : ''}
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
                        onClick={() =>
                          questionMutation.mutate({
                            id: q.id,
                            action: 'reject',
                            reason: rejectionReason,
                          })
                        }
                        disabled={questionMutation.isPending}
                        className="rounded-md bg-red-500/10 border border-red-500/30 text-red-400 text-xs px-3 py-1.5 hover:bg-red-500/20 transition-colors disabled:opacity-40"
                      >
                        거절 확인
                      </button>
                      <button
                        onClick={() => {
                          setRejectingId(null);
                          setRejectionReason('');
                        }}
                        className="rounded-md border border-neutral-700 text-neutral-400 text-xs px-3 py-1.5 hover:text-white transition-colors"
                      >
                        취소
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <button
                      onClick={() => questionMutation.mutate({ id: q.id, action: 'approve' })}
                      disabled={questionMutation.isPending}
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
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {activeTab === 'reports' && (
        <div className="space-y-4">
          {reportGroups.length === 0 ? (
            <p className="text-neutral-500 text-sm text-center py-8">처리할 신고가 없습니다.</p>
          ) : (
            reportGroups.map((group) => (
              <div
                key={group.question.id}
                className="bg-[#111111] border border-neutral-800 rounded-lg p-5"
              >
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div className="flex items-center gap-2">
                    <span className="inline-block text-xs text-neutral-500 border border-neutral-800 rounded px-2 py-0.5">
                      {CATEGORY_LABEL[group.question.category] ?? group.question.category}
                    </span>
                    <span className="text-xs text-neutral-500">
                      신고 {group.reportCount}건
                    </span>
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
                  {group.question.question.slice(0, 80)}
                  {group.question.question.length > 80 ? '…' : ''}
                </p>

                <div className="mb-4 space-y-1">
                  {group.reports.map((r) => (
                    <div key={r.id} className="text-xs text-neutral-500 flex gap-2">
                      <span className="text-neutral-600">{r.reporter.nickname ?? '(탈퇴)'}</span>
                      <span>{REASON_LABEL[r.reason] ?? r.reason}</span>
                      {r.description && (
                        <span className="text-neutral-600">— {r.description}</span>
                      )}
                    </div>
                  ))}
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() =>
                      reportMutation.mutate({ questionId: group.question.id, action: 'blind' })
                    }
                    disabled={reportMutation.isPending || group.question.status === 'BLINDED'}
                    className="rounded-md bg-red-500/10 border border-red-500/30 text-red-400 text-xs px-3 py-1.5 hover:bg-red-500/20 transition-colors disabled:opacity-40"
                  >
                    블라인드
                  </button>
                  <button
                    onClick={() =>
                      reportMutation.mutate({ questionId: group.question.id, action: 'dismiss' })
                    }
                    disabled={reportMutation.isPending}
                    className="rounded-md bg-[#1a1a1a] border border-neutral-700 text-neutral-400 text-xs px-3 py-1.5 hover:text-white transition-colors disabled:opacity-40"
                  >
                    무시
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
