'use client';

import { useEffect, useRef, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface Friend {
  friendshipId: string;
  userId: string;
  nickname: string;
  isOnline: boolean;
  lastSeenAt: string | null;
}

function formatLastSeen(lastSeenAt: string | null, isOnline: boolean): string {
  if (isOnline) return '접속 중';
  if (!lastSeenAt) return '접속 기록 없음';
  const diff = Date.now() - new Date(lastSeenAt).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 2) return '방금 전';
  if (minutes < 60) return `${minutes}분 전`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}시간 전`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}일 전`;
  return `${Math.floor(days / 30)}개월 전`;
}

export default function FriendPanel() {
  const { status } = useSession();
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const { data } = useQuery<{ friends: Friend[] }>({
    queryKey: ['friends'],
    queryFn: () => fetch('/api/friends').then((r) => r.json()),
    enabled: status === 'authenticated',
    refetchInterval: 30_000,
  });

  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [open]);

  if (status !== 'authenticated') return null;

  const friends = data?.friends ?? [];
  const onlineCount = friends.filter((f) => f.isOnline).length;

  return (
    <div ref={panelRef} className="fixed right-4 z-50 flex flex-col items-end" style={{ bottom: 'max(7rem, calc(env(safe-area-inset-bottom, 0px) + 7rem))' }}>
      {/* 패널 */}
      {open && (
        <div className="mb-2 w-60 bg-[#0f0f0f] border border-neutral-800 rounded-xl shadow-2xl overflow-hidden">
          {/* 헤더 */}
          <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-neutral-800">
            <span className="text-xs font-medium text-neutral-300">
              친구&nbsp;
              <span className="text-emerald-400">{onlineCount}</span>
              <span className="text-neutral-600"> / {friends.length}</span>
            </span>
            <Link
              href="/friends"
              onClick={() => setOpen(false)}
              className="w-5 h-5 flex items-center justify-center rounded text-neutral-500 hover:text-white hover:bg-neutral-800 transition-colors"
              title="친구 관리"
            >
              <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            </Link>
          </div>

          {/* 친구 목록 */}
          <ul className="max-h-72 overflow-y-auto">
            {friends.length === 0 ? (
              <li className="px-3.5 py-5 text-center">
                <p className="text-xs text-neutral-600 mb-2">친구가 없습니다</p>
                <Link
                  href="/friends"
                  onClick={() => setOpen(false)}
                  className="text-xs text-neutral-400 underline underline-offset-2 hover:text-white transition-colors"
                >
                  친구 추가하기
                </Link>
              </li>
            ) : (
              friends.map((f) => (
                <li key={f.friendshipId}>
                  <button
                    onClick={() => { setOpen(false); router.push(`/battle?invite=${f.userId}`); }}
                    className="w-full flex items-center gap-2.5 px-3.5 py-2.5 hover:bg-neutral-800/60 transition-colors text-left group"
                  >
                    {/* 아바타 */}
                    <div className="relative flex-shrink-0">
                      <div className="w-8 h-8 rounded-full bg-neutral-800 border border-neutral-700 flex items-center justify-center">
                        <span className="text-xs text-neutral-400 font-medium">
                          {(f.nickname[0] ?? '?').toUpperCase()}
                        </span>
                      </div>
                      <span
                        className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-[#0f0f0f] ${
                          f.isOnline ? 'bg-emerald-500' : 'bg-neutral-600'
                        }`}
                      />
                    </div>
                    {/* 닉네임 + 마지막 접속 */}
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-neutral-200 truncate">{f.nickname}</p>
                      <p className={`text-[10px] ${f.isOnline ? 'text-emerald-500' : 'text-neutral-600'}`}>
                        {formatLastSeen(f.lastSeenAt, f.isOnline)}
                      </p>
                    </div>
                    {/* 대전 신청 힌트 */}
                    <span className="ml-auto text-[10px] text-neutral-700 group-hover:text-neutral-500 transition-colors flex-shrink-0">
                      대전
                    </span>
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      )}

      {/* 플로팅 버튼 */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative w-10 h-10 rounded-full bg-[#1a1a1a] border border-neutral-700 flex items-center justify-center text-neutral-400 hover:text-white hover:border-neutral-500 transition-colors shadow-lg"
        aria-label="친구 목록"
      >
        <svg width={17} height={17} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
          <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 00-3-3.87" />
          <path d="M16 3.13a4 4 0 010 7.75" />
        </svg>
        {onlineCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[16px] h-4 bg-emerald-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center px-0.5 leading-none">
            {onlineCount}
          </span>
        )}
      </button>
    </div>
  );
}
