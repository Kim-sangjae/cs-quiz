'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import Spinner from '@/components/Spinner';
import PaginationNav from '@/components/PaginationNav';

const TYPE_LABEL: Record<string, string> = {
  BUG_REPORT: '버그 신고',
  ACCOUNT_ISSUE: '계정 문제',
  CONTENT_ISSUE: '콘텐츠/문제 오류',
  SUGGESTION: '기능 제안',
  OTHER: '기타',
};

const STATUS_CONFIG: Record<string, { label: string; cls: string }> = {
  PENDING:     { label: '대기 중',   cls: 'text-amber-400 border-amber-500/30' },
  IN_PROGRESS: { label: '처리 중',   cls: 'text-blue-400 border-blue-500/30' },
  RESOLVED:    { label: '해결 완료', cls: 'text-green-400 border-green-500/30' },
};

interface Inquiry {
  id: string;
  type: string;
  title: string;
  content: string;
  status: string;
  adminReply: string | null;
  repliedAt: string | null;
  createdAt: string;
}

type StatusFilter = 'all' | 'PENDING' | 'IN_PROGRESS' | 'RESOLVED';
type SortKey = 'newest' | 'oldest';

const PAGE_SIZE = 5;

export default function InquiryPage() {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [sort, setSort] = useState<SortKey>('newest');
  const [page, setPage] = useState(0);

  const { data: inquiries = [], isLoading } = useQuery<Inquiry[]>({
    queryKey: ['inquiries'],
    queryFn: async () => {
      const r = await fetch('/api/inquiries');
      if (!r.ok) return [];
      return r.json();
    },
  });

  // 필터
  const filtered = statusFilter === 'all'
    ? inquiries
    : inquiries.filter((i) => i.status === statusFilter);

  // 정렬
  const sorted = [...filtered].sort((a, b) => {
    const ta = new Date(a.createdAt).getTime();
    const tb = new Date(b.createdAt).getTime();
    return sort === 'newest' ? tb - ta : ta - tb;
  });

  const pageCount = Math.ceil(sorted.length / PAGE_SIZE);
  const paged = sorted.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  function setFilter(f: StatusFilter) { setStatusFilter(f); setPage(0); setExpandedId(null); }
  function setOrder(s: SortKey) { setSort(s); setPage(0); setExpandedId(null); }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-white mb-1">내 문의</h1>
          <p className="text-sm text-neutral-500">관리자가 확인 후 답변을 드립니다</p>
        </div>
        <Link
          href="/inquiry/new"
          className="rounded-md bg-white text-black text-sm font-semibold px-4 py-2 hover:bg-neutral-200 transition-colors"
        >
          + 새 문의
        </Link>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16"><Spinner size={28} /></div>
      ) : inquiries.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-neutral-500 text-sm mb-4">등록한 문의가 없습니다</p>
          <Link
            href="/inquiry/new"
            className="text-sm text-white underline underline-offset-2 hover:text-neutral-300 transition-colors"
          >
            첫 문의 작성하기
          </Link>
        </div>
      ) : (
        <>
          {/* 필터 + 정렬 */}
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <div className="flex gap-1">
              {(['all', 'PENDING', 'IN_PROGRESS', 'RESOLVED'] as StatusFilter[]).map((s) => {
                const labels: Record<StatusFilter, string> = {
                  all: '전체', PENDING: '대기 중', IN_PROGRESS: '처리 중', RESOLVED: '해결 완료',
                };
                return (
                  <button
                    key={s}
                    onClick={() => setFilter(s)}
                    className={`px-2.5 py-1 rounded text-xs transition-colors ${
                      statusFilter === s
                        ? 'bg-neutral-700 text-white font-medium'
                        : 'border border-neutral-800 text-neutral-400 hover:border-neutral-600 hover:text-white'
                    }`}
                  >
                    {labels[s]}
                  </button>
                );
              })}
            </div>
            <div className="w-px h-4 bg-neutral-800 self-center" />
            <div className="flex gap-1">
              {(['newest', 'oldest'] as SortKey[]).map((s) => (
                <button
                  key={s}
                  onClick={() => setOrder(s)}
                  className={`px-2.5 py-1 rounded text-xs transition-colors ${
                    sort === s
                      ? 'bg-white text-black font-medium'
                      : 'border border-neutral-800 text-neutral-400 hover:border-neutral-600 hover:text-white'
                  }`}
                >
                  {s === 'newest' ? '최신순' : '오래된순'}
                </button>
              ))}
            </div>
          </div>

          {sorted.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-neutral-500 text-sm">해당 상태의 문의가 없습니다.</p>
            </div>
          ) : (
            <>
              <p className="text-xs text-neutral-500 mb-3">총 {sorted.length}건</p>
              <div className="space-y-3">
                {paged.map((inq) => {
                  const expanded = expandedId === inq.id;
                  const sc = STATUS_CONFIG[inq.status] ?? { label: inq.status, cls: 'text-neutral-400 border-neutral-700' };
                  return (
                    <div key={inq.id} className="bg-[#111111] border border-neutral-800 rounded-xl overflow-hidden">
                      <button
                        onClick={() => setExpandedId(expanded ? null : inq.id)}
                        className="w-full text-left px-5 py-4 hover:bg-[#1a1a1a] transition-colors"
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-xs text-neutral-500 border border-neutral-800 rounded-full px-2 py-0.5">
                            {TYPE_LABEL[inq.type] ?? inq.type}
                          </span>
                          <span className={`text-xs border rounded-full px-2 py-0.5 ${sc.cls}`}>
                            {sc.label}
                          </span>
                          {inq.adminReply && (
                            <span className="text-xs text-emerald-400 border border-emerald-500/30 rounded-full px-2 py-0.5">
                              답변 완료
                            </span>
                          )}
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-sm font-medium text-white">{inq.title}</p>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <span className="text-xs text-neutral-600">
                              {new Date(inq.createdAt).toLocaleDateString('ko-KR')}
                            </span>
                            <svg
                              width={14} height={14} viewBox="0 0 24 24" fill="none"
                              stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
                              className={`text-neutral-600 transition-transform ${expanded ? 'rotate-180' : ''}`}
                            >
                              <path d="M19 9l-7 7-7-7" />
                            </svg>
                          </div>
                        </div>
                      </button>

                      {expanded && (
                        <div className="border-t border-neutral-800 px-5 py-4 space-y-4">
                          <div>
                            <p className="text-xs text-neutral-500 mb-1.5">문의 내용</p>
                            <p className="text-sm text-neutral-300 leading-relaxed whitespace-pre-wrap">{inq.content}</p>
                          </div>
                          <div className="border-t border-neutral-800 pt-4">
                            <p className="text-xs text-neutral-500 mb-1.5">관리자 답변</p>
                            {inq.adminReply ? (
                              <>
                                <p className="text-sm text-neutral-200 leading-relaxed whitespace-pre-wrap">{inq.adminReply}</p>
                                {inq.repliedAt && (
                                  <p className="text-xs text-neutral-600 mt-2">
                                    {new Date(inq.repliedAt).toLocaleDateString('ko-KR')} 답변
                                  </p>
                                )}
                              </>
                            ) : (
                              <p className="text-sm text-neutral-600">아직 답변이 등록되지 않았습니다.</p>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {pageCount > 1 && (
                <div className="mt-4">
                  <PaginationNav
                    page={page + 1}
                    pageCount={pageCount}
                    onChange={(p) => { setPage(p - 1); setExpandedId(null); }}
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
