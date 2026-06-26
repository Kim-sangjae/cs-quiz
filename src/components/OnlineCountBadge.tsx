'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';

interface OnlineUser {
  id: string;
  nickname: string;
  isFriend: boolean;
}

interface UserProfile {
  nickname: string;
  level: number;
  totalAttempts: number;
  accuracy: number;
  battleWins: number;
  battleTies: number;
  battleLosses: number;
  battleTotal: number;
}

export default function OnlineCountBadge() {
  const { status } = useSession();
  const router = useRouter();
  const [count, setCount] = useState<number | null>(null);
  const [showPanel, setShowPanel] = useState(false);
  const [users, setUsers] = useState<OnlineUser[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [selectedUser, setSelectedUser] = useState<OnlineUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [friendRequested, setFriendRequested] = useState(false);
  const [addingFriend, setAddingFriend] = useState(false);

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

  const selectUser = useCallback(async (user: OnlineUser) => {
    setSelectedUser(user);
    setProfile(null);
    setFriendRequested(false);
    setProfileLoading(true);
    try {
      const res = await fetch(`/api/users/${user.id}/profile`);
      if (res.ok) setProfile(await res.json() as UserProfile);
    } catch {}
    setProfileLoading(false);
  }, []);

  const addFriend = useCallback(async () => {
    if (!selectedUser || addingFriend) return;
    setAddingFriend(true);
    try {
      const res = await fetch('/api/friends', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetId: selectedUser.id }),
      });
      if (res.ok) setFriendRequested(true);
    } catch {}
    setAddingFriend(false);
  }, [selectedUser, addingFriend]);

  const closePanel = useCallback(() => {
    setShowPanel(false);
    setSelectedUser(null);
    setProfile(null);
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

      {/* 배경 오버레이 */}
      <div
        className={`fixed inset-0 z-[200] transition-opacity duration-200 ${showPanel ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
        style={{ background: 'rgba(0,0,0,0.55)' }}
        onClick={closePanel}
      />

      {/* 슬라이드 패널 */}
      <div
        className={`fixed top-0 right-0 h-full z-[201] w-72 bg-[#0d0d0d] border-l border-neutral-800 shadow-2xl flex flex-col transition-transform duration-200 ${showPanel ? 'translate-x-0' : 'translate-x-full'}`}
      >
        {selectedUser ? (
          <>
            <div className="flex items-center gap-3 px-5 py-4 border-b border-neutral-800 flex-shrink-0">
              <button
                onClick={() => { setSelectedUser(null); setProfile(null); }}
                className="text-neutral-500 hover:text-white text-sm transition-colors"
              >←</button>
              <p className="text-sm font-semibold text-white flex-1 truncate">{selectedUser.nickname}</p>
              {selectedUser.isFriend && (
                <span className="text-[10px] text-emerald-400 border border-emerald-500/30 rounded-full px-2 py-0.5 flex-shrink-0">친구</span>
              )}
              <button onClick={closePanel} className="text-neutral-500 hover:text-white text-lg leading-none transition-colors flex-shrink-0">✕</button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-5">
              {profileLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => <div key={i} className="h-16 bg-neutral-800 rounded-xl animate-pulse" />)}
                </div>
              ) : profile ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-neutral-900 rounded-xl p-3 text-center">
                      <p className="text-[10px] text-neutral-600 mb-1">레벨</p>
                      <p className="text-xl font-bold text-white">Lv.{profile.level}</p>
                    </div>
                    <div className="bg-neutral-900 rounded-xl p-3 text-center">
                      <p className="text-[10px] text-neutral-600 mb-1">정답률</p>
                      <p className="text-xl font-bold text-white">{(profile.accuracy * 100).toFixed(0)}%</p>
                    </div>
                  </div>
                  <div className="bg-neutral-900 rounded-xl p-3 text-center">
                    <p className="text-[10px] text-neutral-600 mb-1">총 풀기</p>
                    <p className="text-lg font-semibold text-white">{profile.totalAttempts.toLocaleString()}문제</p>
                  </div>
                  {profile.battleTotal > 0 && (
                    <div className="bg-neutral-900 rounded-xl p-3">
                      <p className="text-[10px] text-neutral-600 mb-2">대전 전적</p>
                      <div className="flex gap-4 justify-center text-sm font-semibold">
                        <span className="text-emerald-400">{profile.battleWins}승</span>
                        <span className="text-neutral-500">{profile.battleTies}무</span>
                        <span className="text-red-400">{profile.battleLosses}패</span>
                      </div>
                    </div>
                  )}
                  {!selectedUser.isFriend && !friendRequested && (
                    <button
                      onClick={addFriend}
                      disabled={addingFriend}
                      className="w-full rounded-lg bg-white text-black text-sm font-medium py-2.5 hover:bg-neutral-200 disabled:opacity-50 transition-colors"
                    >
                      {addingFriend ? '요청 중...' : '친구 추가'}
                    </button>
                  )}
                  {friendRequested && (
                    <p className="text-xs text-emerald-400 text-center py-1">친구 요청을 보냈습니다 ✓</p>
                  )}
                </div>
              ) : (
                <p className="text-xs text-neutral-600 py-4 text-center">프로필을 불러올 수 없습니다</p>
              )}
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-800 flex-shrink-0">
              <p className="text-sm font-semibold text-white">접속 중 ({count}명)</p>
              <button onClick={closePanel} className="text-neutral-500 hover:text-white text-lg leading-none transition-colors">✕</button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-4">
              {usersLoading ? (
                <div className="space-y-2 pt-2">
                  {[1, 2, 3].map((i) => <div key={i} className="h-12 bg-neutral-800 rounded-lg animate-pulse" />)}
                </div>
              ) : users.length === 0 ? (
                <p className="text-xs text-neutral-600 py-4 text-center">다른 접속자 없음</p>
              ) : (
                <div className="space-y-0.5">
                  {users.map((u) => (
                    <button
                      key={u.id}
                      onClick={() => selectUser(u)}
                      className="w-full flex items-center gap-3 py-2.5 px-2 rounded-lg hover:bg-neutral-900 transition-colors border-b border-neutral-800/40 last:border-0"
                    >
                      <div className="relative w-8 h-8 rounded-full bg-neutral-800 flex items-center justify-center flex-shrink-0">
                        <span className="text-xs font-semibold text-neutral-300">{(u.nickname[0] ?? '?').toUpperCase()}</span>
                        <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-[#0d0d0d]" />
                      </div>
                      <span className="text-sm text-neutral-200 flex-1 text-left truncate">{u.nickname}</span>
                      {u.isFriend && (
                        <span className="text-[10px] text-emerald-400 border border-emerald-500/30 rounded-full px-1.5 py-0.5 flex-shrink-0">친구</span>
                      )}
                      <span className="text-neutral-600 text-xs flex-shrink-0">›</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </>
  );
}
