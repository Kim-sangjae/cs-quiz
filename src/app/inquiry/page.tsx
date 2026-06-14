'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import Spinner from '@/components/Spinner';

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

export default function InquiryPage() {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data: inquiries = [], isLoading } = useQuery<Inquiry[]>({
    queryKey: ['inquiries'],
    queryFn: async () => {
      const r = await fetch('/api/inquiries');
      if (!r.ok) return [];
      return r.json();
    },
  });

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-xl font-semibold text-white">내 문의</h1>
          <p className="text-xs text-neutral-500 mt-1">관리자가 확인 후 답변을 드립니다</p>
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
        <div className="space-y-3">
          {inquiries.map((inq) => {
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
      )}
    </div>
  );
}
