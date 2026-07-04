'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import UserProfileModal from './UserProfileModal';

interface OnlineUser {
  id: string;
  nickname: string;
  isFriend: boolean;
  isSelf: boolean;
}

export default function OnlineCountBadge() {
  const { status } = useSession();
  const router = useRouter();
  const [count, setCount] = useState<number | null>(null);
  const [showPanel, setShowPanel] = useState(false);
  const [users, setUsers] = useState<OnlineUser[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [selectedUser, setSelectedUser] = useState<OnlineUser | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function fetchCount() {
      try {
        const res = await fetch('/api/stats/online');
        if (!res.ok) return;
        const data = await res.json() as { count: number };
        if (!cancelled) setCount(data.count);
      } catch {}
    }
    fetchCount();
    const id = setInterval(fetchCount, 30_000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  const openPanel = useCallback(async () => {
    if (status !== 'authenticated') { router.push('/auth/login'); return; }
    setShowPanel(true);
    setUsersLoading(true);
    try {
      const res = await fetch('/api/stats/online-users');
      if (res.ok) {
        const data = await res.json() as { users: OnlineUser[]; totalCount: number };
        setUsers(data.users);
        setCount(data.totalCount);
      }
    } catch {}
    setUsersLoading(false);
  }, [status, router]);

  const addFriend = useCallback(async () => {
    if (!selectedUser) return;
    await fetch('/api/friends', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nickname: selectedUser.nickname }),
    });
  }, [selectedUser]);

  const closePanel = useCallback(() => {
    setShowPanel(false);
    setSelectedUser(null);
  }, []);

  if (count === null || count === 0) return null;

  return (
    <>
      <button
        onClick={openPanel}
        className="inline-flex items-center gap-1.5 text-xs text-neutral-400 border border-neutral-800 rounded-full px-3 py-1 hover:text-neutral-200 hover:border-neutral-600 transition-colors cursor-pointer"
      >
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
        현재 {count}명 접속 중
      </button>

      {/* 배경 오버레이 (슬라이드 패널용) */}
      <div
        className={`fixed inset-0 z-[200] transition-opacity duration-200 ${showPanel && !selectedUser ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
        style={{ background: 'rgba(0,0,0,0.55)' }}
        onClick={closePanel}
      />

      {/* 접속자 목록 슬라이드 패널 */}
      <div
        className={`fixed top-0 right-0 h-full z-[201] w-72 bg-[#111111] border-l border-neutral-800 shadow-2xl flex flex-col transition-transform duration-200 ${showPanel ? 'translate-x-0' : 'translate-x-full'}`}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-800 flex-shrink-0">
          <p className="text-sm font-semibold text-white">접속 중 ({count}명)</p>
          <button onClick={closePanel} className="p-1 rounded text-neutral-600 hover:text-white hover:bg-neutral-800 transition-colors">
            <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {usersLoading ? (
            <div className="space-y-px pt-1">
              {[1, 2, 3].map((i) => <div key={i} className="h-14 bg-neutral-800/40 animate-pulse" />)}
            </div>
          ) : users.length === 0 ? (
            <p className="text-xs text-neutral-600 py-8 text-center">접속자 없음</p>
          ) : (
            <ul>
              {users.map((u) => (
                <li key={u.id}>
                  <button
                    onClick={() => setSelectedUser(u)}
                    className="w-full flex items-center gap-2.5 px-3.5 py-2.5 hover:bg-neutral-800/60 transition-colors text-left border-b border-neutral-800/40 last:border-0"
                  >
                    <div className="relative flex-shrink-0">
                      <div className="w-8 h-8 rounded-full bg-neutral-800 border border-neutral-700 flex items-center justify-center">
                        <span className="text-xs font-medium text-neutral-400">
                          {(u.nickname[0] ?? '?').toUpperCase()}
                        </span>
                      </div>
                      <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-[#111111]" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-neutral-200 truncate">{u.nickname}</p>
                      <p className="text-[10px] text-emerald-500">접속 중</p>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {u.isSelf && (
                        <span className="text-[10px] text-neutral-500 border border-neutral-700 rounded-full px-1.5 py-0.5">나</span>
                      )}
                      {u.isFriend && !u.isSelf && (
                        <span className="text-[10px] text-emerald-400 border border-emerald-500/30 rounded-full px-1.5 py-0.5">친구</span>
                      )}
                      <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="text-neutral-700"><path d="M9 18l6-6-6-6" /></svg>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {selectedUser && (
        <UserProfileModal
          userId={selectedUser.id}
          nickname={selectedUser.nickname}
          isOnline={true}
          isFriend={selectedUser.isFriend}
          isSelf={selectedUser.isSelf}
          showActions={true}
          onClose={() => setSelectedUser(null)}
          onAddFriend={selectedUser.isFriend || selectedUser.isSelf ? undefined : addFriend}
        />
      )}
    </>
  );
}
