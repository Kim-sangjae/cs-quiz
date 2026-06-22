'use client';

import { useEffect, useRef, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useSupabaseRealtime } from '@/hooks/useSupabaseRealtime';

interface Friend {
  friendshipId: string;
  userId: string;
  nickname: string;
  isOnline: boolean;
  lastSeenAt: string | null;
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
  isOnline: boolean;
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

const CATEGORIES = [
  { key: 'all', label: '전체' },
  { key: 'ds', label: '자료구조' },
  { key: 'algo', label: '알고리즘' },
  { key: 'os', label: '운영체제' },
  { key: 'network', label: '네트워크' },
  { key: 'db', label: '데이터베이스' },
  { key: 'arch', label: '컴퓨터 구조' },
] as const;

function ProfileModal({
  friend,
  onClose,
  onBattle,
  onRemove,
}: {
  friend: Friend;
  onClose: () => void;
  onBattle: (friendId: string, category: string) => void;
  onRemove: (friendshipId: string) => void;
}) {
  const [step, setStep] = useState<'profile' | 'battle'>('profile');
  const [confirmingRemove, setConfirmingRemove] = useState(false);
  const [category, setCategory] = useState('ds');

  const { data: profile, isLoading } = useQuery<UserProfile>({
    queryKey: ['profile', friend.userId],
    queryFn: () => fetch(`/api/users/${friend.userId}/profile`).then((r) => r.json()),
    staleTime: 60_000,
  });

  const battleWinRate = profile && profile.battleTotal > 0
    ? Math.round((profile.battleWins / profile.battleTotal) * 100)
    : null;

  function battleRecord(p: UserProfile): string {
    if (p.battleTotal === 0) return '-';
    const parts = [`${p.battleWins}승`];
    if (p.battleTies > 0) parts.push(`${p.battleTies}무`);
    parts.push(`${p.battleLosses}패`);
    return parts.join(' ');
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px]" />
      <div
        className="relative w-full max-w-xs bg-[#111111] border border-neutral-800 rounded-2xl overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 닫기 */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 p-1.5 rounded text-neutral-600 hover:text-white hover:bg-neutral-800 transition-colors"
        >
          <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>

        {step === 'profile' && (
          <>
            {/* 아바타 + 닉네임 */}
            <div className="flex flex-col items-center pt-8 pb-5 px-5">
              <div className="relative mb-3">
                <div className="w-16 h-16 rounded-full bg-neutral-800 border border-neutral-700 flex items-center justify-center">
                  <span className="text-xl font-semibold text-neutral-300">
                    {(friend.nickname[0] ?? '?').toUpperCase()}
                  </span>
                </div>
                <span
                  className={`absolute bottom-0.5 right-0.5 w-3.5 h-3.5 rounded-full border-2 border-[#111111] ${
                    friend.isOnline ? 'bg-emerald-500' : 'bg-neutral-600'
                  }`}
                />
              </div>
              <p className="text-base font-semibold text-white">{friend.nickname}</p>
              <div className="flex items-center gap-2 mt-1">
                {isLoading ? (
                  <div className="h-4 w-16 bg-neutral-800 rounded animate-pulse" />
                ) : profile ? (
                  <>
                    <span className="text-xs text-neutral-500">Lv.{profile.level}</span>
                    <span className="text-neutral-700">·</span>
                    <span className={`text-xs ${friend.isOnline ? 'text-emerald-400' : 'text-neutral-600'}`}>
                      {formatLastSeen(friend.lastSeenAt, friend.isOnline)}
                    </span>
                  </>
                ) : null}
              </div>
            </div>

            {/* 스탯 */}
            <div className="border-t border-neutral-800 px-5 py-4">
              {isLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-4 bg-neutral-800 rounded animate-pulse" />
                  ))}
                </div>
              ) : profile ? (
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-neutral-500">정답률</span>
                    <span className="text-sm font-medium text-neutral-200">
                      {profile.totalAttempts > 0 ? `${(profile.accuracy * 100).toFixed(1)}%` : '-'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-neutral-500">총 시도</span>
                    <span className="text-sm font-medium text-neutral-200">
                      {profile.totalAttempts > 0 ? `${profile.totalAttempts.toLocaleString()}문제` : '-'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-neutral-500">상대방과의 승률</span>
                    <span className="text-sm font-medium text-neutral-200">
                      {profile.battleTotal > 0
                        ? `${battleWinRate}% (${battleRecord(profile)})`
                        : '-'}
                    </span>
                  </div>
                </div>
              ) : null}
            </div>

            {/* 버튼 */}
            {confirmingRemove ? (
              <div className="border-t border-neutral-800 px-4 py-3 space-y-2">
                <p className="text-xs text-neutral-400 text-center">{friend.nickname}님을 친구 목록에서 삭제할까요?</p>
                <div className="flex gap-2">
                  <button
                    onClick={() => onRemove(friend.friendshipId)}
                    className="flex-1 rounded-lg bg-red-500/15 border border-red-500/30 text-xs text-red-400 font-medium py-2 hover:bg-red-500/25 transition-colors"
                  >
                    삭제
                  </button>
                  <button
                    onClick={() => setConfirmingRemove(false)}
                    className="flex-1 rounded-lg border border-neutral-700 text-xs text-neutral-400 py-2 hover:text-white transition-colors"
                  >
                    취소
                  </button>
                </div>
              </div>
            ) : (
              <div className="border-t border-neutral-800 px-4 py-3 flex gap-2">
                {friend.isOnline && (
                  <button
                    onClick={() => setStep('battle')}
                    className="flex-1 rounded-lg bg-white text-black text-xs font-semibold py-2.5 hover:bg-neutral-200 transition-colors"
                  >
                    대전 신청
                  </button>
                )}
                <button
                  onClick={() => setConfirmingRemove(true)}
                  className={`${friend.isOnline ? '' : 'flex-1'} rounded-lg border border-neutral-800 text-xs text-neutral-500 py-2.5 px-3 hover:border-red-900 hover:text-red-400 transition-colors`}
                >
                  친구 삭제
                </button>
              </div>
            )}
          </>
        )}

        {step === 'battle' && (
          <>
            <div className="px-5 pt-6 pb-4">
              <button onClick={() => setStep('profile')} className="text-xs text-neutral-500 hover:text-neutral-300 mb-4 flex items-center gap-1">
                <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M15 18l-6-6 6-6" /></svg>
                뒤로
              </button>
              <p className="text-sm font-medium text-white mb-1">{friend.nickname}에게 대전 신청</p>
              <p className="text-xs text-neutral-500 mb-4">카테고리를 선택하세요</p>
              <div className="grid grid-cols-2 gap-2">
                {CATEGORIES.map((c) => (
                  <button
                    key={c.key}
                    onClick={() => setCategory(c.key)}
                    className={`text-xs px-3 py-2 rounded-lg border transition-colors ${
                      category === c.key
                        ? 'border-neutral-400 text-white bg-neutral-800'
                        : 'border-neutral-800 text-neutral-500 hover:border-neutral-600 hover:text-neutral-300'
                    }`}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="border-t border-neutral-800 px-4 py-3">
              <button
                onClick={() => onBattle(friend.userId, category)}
                className="w-full rounded-lg bg-white text-black text-xs font-semibold py-2.5 hover:bg-neutral-200 transition-colors"
              >
                신청하기
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function FriendPanel() {
  const { status } = useSession();
  const [open, setOpen] = useState(false);
  const [addingFriend, setAddingFriend] = useState(false);
  const [nickname, setNickname] = useState('');
  const [selectedFriend, setSelectedFriend] = useState<Friend | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const queryClient = useQueryClient();
  const { onlineUsers, realtimeActive } = useSupabaseRealtime();

  const { data } = useQuery<{ friends: Friend[] }>({
    queryKey: ['friends'],
    queryFn: () => fetch('/api/friends').then((r) => r.json()),
    enabled: status === 'authenticated',
    // Realtime이 살아있으면 온라인 상태는 Presence로 처리하므로 폴링 간격 늘림
    refetchInterval: open ? (realtimeActive ? 15_000 : 5_000) : 30_000,
  });

  const { data: battleRoomsData } = useQuery<{ rooms: { id: string; status: string }[] }>({
    queryKey: ['battle', 'rooms'],
    queryFn: () => fetch('/api/battle/rooms').then((r) => r.json()),
    enabled: status === 'authenticated' && open,
    refetchInterval: open ? 10_000 : false,
  });

  const activeRoom = (battleRoomsData?.rooms ?? []).find(
    (r) => r.status === 'PLAYING' || r.status === 'WAITING'
  );

  const addFriend = useMutation({
    mutationFn: (nick: string) =>
      fetch('/api/friends', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nickname: nick }),
      }).then(async (r) => {
        const data = await r.json() as { error?: string };
        if (!r.ok) throw new Error(data.error ?? '오류가 발생했습니다');
        return data;
      }),
    onSuccess: () => {
      toast.success('친구 요청을 보냈습니다');
      setNickname('');
      setAddingFriend(false);
      queryClient.invalidateQueries({ queryKey: ['friends'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeFriend = useMutation({
    mutationFn: (friendshipId: string) =>
      fetch(`/api/friends/${friendshipId}`, { method: 'DELETE' }).then(async (r) => {
        if (!r.ok) throw new Error('오류가 발생했습니다');
        return r.json();
      }),
    onSuccess: () => {
      toast.success('친구를 삭제했습니다');
      setSelectedFriend(null);
      queryClient.invalidateQueries({ queryKey: ['friends'] });
    },
    onError: () => toast.error('오류가 발생했습니다'),
  });

  const createRoom = useMutation({
    mutationFn: ({ friendId, category }: { friendId: string; category: string }) =>
      fetch('/api/battle/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ friendId, category }),
      }).then(async (r) => {
        const data = await r.json() as { roomId?: string; error?: string };
        if (!r.ok) throw new Error(data.error ?? '오류가 발생했습니다');
        return data;
      }),
    onSuccess: (data) => {
      toast.success('대전 신청을 보냈습니다');
      setSelectedFriend(null);
      setOpen(false);
      if (data.roomId) router.push(`/battle/${data.roomId}`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
        setAddingFriend(false);
      }
    }
    if (open) document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [open]);

  if (status !== 'authenticated') return null;

  const onlineUserIds = new Set(onlineUsers.map((u) => u.userId));

  const friends = (data?.friends ?? []).map((f) =>
    realtimeActive ? { ...f, isOnline: onlineUserIds.has(f.userId) } : f
  );
  const onlineCount = friends.filter((f) => f.isOnline).length;

  return (
    <>
      {/* 프로필 모달 */}
      {selectedFriend && (
        <ProfileModal
          friend={selectedFriend}
          onClose={() => setSelectedFriend(null)}
          onBattle={(friendId, category) => createRoom.mutate({ friendId, category })}
          onRemove={(fid) => removeFriend.mutate(fid)}
        />
      )}

      <div ref={panelRef} className="fixed right-4 z-50 flex flex-col items-end" style={{ bottom: 'max(7rem, calc(env(safe-area-inset-bottom, 0px) + 7rem))' }}>
        {/* 패널 */}
        {open && (
          <div className="mb-2 w-64 bg-[#0f0f0f] border border-neutral-800 rounded-xl shadow-2xl overflow-hidden">
            {/* 헤더 */}
            <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-neutral-800">
              <span className="text-xs font-medium text-neutral-300">
                친구&nbsp;
                <span className="text-emerald-400">{onlineCount}</span>
                <span className="text-neutral-600"> / {friends.length}</span>
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => { router.push('/friends'); setOpen(false); }}
                  className="w-5 h-5 flex items-center justify-center rounded text-neutral-500 hover:text-white hover:bg-neutral-800 transition-colors"
                  title="친구 목록 페이지"
                >
                  <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                  </svg>
                </button>
                <button
                  onClick={() => setAddingFriend((v) => !v)}
                  className="w-5 h-5 flex items-center justify-center rounded text-neutral-500 hover:text-white hover:bg-neutral-800 transition-colors"
                  title="친구 추가"
                >
                  <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* 활성 대전 링크 */}
            {activeRoom && (
              <button
                onClick={() => { router.push(`/battle/${activeRoom.id}`); setOpen(false); }}
                className="w-full flex items-center gap-2 px-3.5 py-2 border-b border-neutral-800 hover:bg-neutral-800/40 transition-colors text-left"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse flex-shrink-0" />
                <span className="text-xs text-emerald-400 font-medium">
                  {activeRoom.status === 'PLAYING' ? '대전 진행 중 →' : '대전 대기 중 →'}
                </span>
              </button>
            )}

            {/* 친구 추가 입력 */}
            {addingFriend && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (nickname.trim()) addFriend.mutate(nickname.trim());
                }}
                className="px-3 py-2.5 border-b border-neutral-800 flex gap-1.5"
              >
                <input
                  autoFocus
                  type="text"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  placeholder="닉네임 입력"
                  className="flex-1 min-w-0 bg-neutral-800 border border-neutral-700 rounded-md px-2.5 py-1.5 text-xs text-white placeholder-neutral-600 focus:outline-none focus:border-neutral-500"
                />
                <button
                  type="submit"
                  disabled={addFriend.isPending || !nickname.trim()}
                  className="text-xs bg-white text-black font-medium rounded-md px-2.5 py-1.5 hover:bg-neutral-200 transition-colors disabled:opacity-50 flex-shrink-0"
                >
                  {addFriend.isPending ? '...' : '추가'}
                </button>
              </form>
            )}

            {/* 친구 목록 */}
            <ul className="max-h-72 overflow-y-auto">
              {friends.length === 0 ? (
                <li className="px-3.5 py-5 text-center">
                  <p className="text-xs text-neutral-600 mb-2">친구가 없습니다</p>
                  <button
                    onClick={() => setAddingFriend(true)}
                    className="text-xs text-neutral-400 underline underline-offset-2 hover:text-white transition-colors"
                  >
                    친구 추가하기
                  </button>
                </li>
              ) : (
                friends.map((f) => (
                  <li key={f.friendshipId}>
                    <button
                      onClick={() => setSelectedFriend(f)}
                      className="w-full flex items-center gap-2.5 px-3.5 py-2.5 hover:bg-neutral-800/60 transition-colors text-left"
                    >
                      <div className="relative flex-shrink-0">
                        <div className="w-8 h-8 rounded-full bg-neutral-800 border border-neutral-700 flex items-center justify-center">
                          <span className="text-xs text-neutral-400 font-medium">
                            {(f.nickname[0] ?? '?').toUpperCase()}
                          </span>
                        </div>
                        <span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-[#0f0f0f] ${f.isOnline ? 'bg-emerald-500' : 'bg-neutral-600'}`} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium text-neutral-200 truncate">{f.nickname}</p>
                        <p className={`text-[10px] ${f.isOnline ? 'text-emerald-500' : 'text-neutral-600'}`}>
                          {formatLastSeen(f.lastSeenAt, f.isOnline)}
                        </p>
                      </div>
                      {f.isOnline && (
                        <span className="text-[9px] text-emerald-800 border border-emerald-900/50 rounded px-1 py-0.5 flex-shrink-0">
                          대전
                        </span>
                      )}
                    </button>
                  </li>
                ))
              )}
            </ul>
          </div>
        )}

        {/* 플로팅 버튼 */}
        <button
          onClick={() => { setOpen((v) => !v); if (!open) setAddingFriend(false); }}
          className="relative w-12 h-12 rounded-full bg-[#1a1a1a] border border-neutral-700 flex items-center justify-center text-neutral-400 hover:text-white hover:border-neutral-500 transition-colors shadow-lg"
          aria-label="친구 목록"
        >
          <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
            <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 00-3-3.87" />
            <path d="M16 3.13a4 4 0 010 7.75" />
          </svg>
          {onlineCount > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-emerald-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1 leading-none">
              {onlineCount}
            </span>
          )}
        </button>
      </div>
    </>
  );
}
