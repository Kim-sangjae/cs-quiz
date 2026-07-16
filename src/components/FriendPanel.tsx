'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter, usePathname } from 'next/navigation';
import { toast } from 'sonner';
import { useSupabaseRealtime } from '@/hooks/useSupabaseRealtime';
import { supabaseBrowser } from '@/lib/supabase-browser';
import UserProfileModal from './UserProfileModal';
import ChatWindow from './ChatWindow';
import { ChatMessage } from '@/lib/chat-store';
import { sendNotification, requestNotificationPermission } from '@/lib/notify';

interface Friend {
  friendshipId: string;
  userId: string;
  nickname: string;
  isOnline: boolean;
  lastSeenAt: string | null;
  battleStatus: 'WAITING' | 'PLAYING' | null;
  isPlayingQuiz?: boolean;
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
  const { data: session, status } = useSession();
  const myId = session?.user?.id ?? '';
  const [open, setOpen] = useState(false);
  const [addingFriend, setAddingFriend] = useState(false);
  const [nickname, setNickname] = useState('');
  const [friendSearch, setFriendSearch] = useState('');
  const [onlineOnly, setOnlineOnly] = useState(false);
  const [selectedFriend, setSelectedFriend] = useState<Friend | null>(null);
  const [chatFriend, setChatFriend] = useState<{ userId: string; nickname: string } | null>(null);
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const chatFriendRef = useRef<{ userId: string; nickname: string } | null>(null);
  const friendsRef = useRef<Friend[]>([]);
  const panelRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const { onlineUsers, realtimeActive } = useSupabaseRealtime();
  const prevActiveRoomStatusRef = useRef<string | undefined>(undefined);

  // 드래그 위치 (양수 = 위로 이동, 음수 = 아래로 이동)
  const [deltaY, setDeltaY] = useState(0);
  const didDragRef = useRef(false);

  const { data } = useQuery<{ friends: Friend[] }>({
    queryKey: ['friends'],
    queryFn: () => fetch('/api/friends').then((r) => r.json()),
    enabled: status === 'authenticated',
    refetchInterval: open ? 5_000 : 30_000,
  });

  useEffect(() => {
    if (open) {
      void queryClient.invalidateQueries({ queryKey: ['friends'] });
    } else {
      setFriendSearch('');
      setOnlineOnly(false);
    }
  }, [open, queryClient]);

  useEffect(() => {
    if (status !== 'authenticated') return;
    const channel = supabaseBrowser
      .channel('battle-status-updates')
      .on('broadcast', { event: 'battle_status_changed' }, () => {
        void queryClient.invalidateQueries({ queryKey: ['friends'] });
      })
      .subscribe();
    return () => { void supabaseBrowser.removeChannel(channel); };
  }, [queryClient, status]);

  // chatFriendRef / friendsRef: closure에서 최신 상태 참조용
  useEffect(() => { chatFriendRef.current = chatFriend; }, [chatFriend]);
  useEffect(() => { friendsRef.current = data?.friends ?? []; }, [data?.friends]);

  // 알림 권한 요청 (인증 후 1회)
  useEffect(() => {
    if (status === 'authenticated') void requestNotificationPermission();
  }, [status]);

  // pathname 변경 시 드래그 위치 초기화
  useEffect(() => { setDeltaY(0); }, [pathname]);

  // 내 알림 채널 구독 — 상대가 보낸 메시지를 채팅창이 닫혀 있어도 수신
  useEffect(() => {
    if (!myId || status !== 'authenticated') return;
    const ch = supabaseBrowser
      .channel(`csora-chat-notif-${myId}`)
      .on('broadcast', { event: 'chat_message' }, ({ payload }: { payload: ChatMessage }) => {
        // 해당 친구와 채팅창이 열려 있으면 이미 실시간으로 표시 중
        if (chatFriendRef.current?.userId === payload.senderId) return;
        setUnreadCounts((prev) => ({
          ...prev,
          [payload.senderId]: (prev[payload.senderId] ?? 0) + 1,
        }));
        const sender = friendsRef.current.find((f) => f.userId === payload.senderId);
        sendNotification('💬 새 메시지', `${sender?.nickname ?? '친구'}님의 메시지가 도착했습니다`);
      })
      .subscribe();
    return () => { void supabaseBrowser.removeChannel(ch); };
  }, [myId, status]);

  const { data: battleRoomsData } = useQuery<{ rooms: { id: string; status: string }[] }>({
    queryKey: ['battle', 'rooms'],
    queryFn: () => fetch('/api/battle/rooms').then((r) => r.json()),
    enabled: status === 'authenticated',
    staleTime: 0,
    refetchInterval: 5_000,
  });

  const activeRoom = (battleRoomsData?.rooms ?? []).find(
    (r) => r.status === 'PLAYING' || r.status === 'WAITING'
  );
  const activeRoomStatus = activeRoom?.status;
  const activeRoomId = activeRoom?.id;
  const isOnBattlePage = pathname?.startsWith('/battle/') ?? false;

  useEffect(() => {
    const prevStatus = prevActiveRoomStatusRef.current;
    prevActiveRoomStatusRef.current = activeRoomStatus;
    if (prevStatus === undefined) return;
    if (prevStatus === 'WAITING' && !activeRoomStatus && !isOnBattlePage) {
      toast.info('상대방의 응답이 없어 대전이 취소되었습니다');
    }
    if (prevStatus === 'WAITING' && activeRoomStatus === 'PLAYING' && !isOnBattlePage) {
      router.push(`/battle/${activeRoomId!}`);
    }
  }, [activeRoomStatus]); // eslint-disable-line react-hooks/exhaustive-deps

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
      queryClient.invalidateQueries({ queryKey: ['battle', 'rooms'] });
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

  // 드래그: mousedown / touchstart 시 document에 move/up 리스너를 직접 붙임
  const startDrag = useCallback((startClientY: number) => {
    const startDelta = deltaY;
    didDragRef.current = false;
    function onMove(clientY: number) {
      if (Math.abs(startClientY - clientY) > 5) didDragRef.current = true;
      const moved = startDelta + (startClientY - clientY);
      // min=0: 기본 위치보다 아래로 못 내림
      // max: 버튼 센터가 화면 정중앙까지만 (baseBottom≈112, buttonHalf=24)
      const max = Math.max(0, window.innerHeight / 2 - 136);
      setDeltaY(Math.max(0, Math.min(max, moved)));
    }
    function onMouseMove(e: MouseEvent) { onMove(e.clientY); }
    function onTouchMoveDoc(e: TouchEvent) { onMove(e.touches[0].clientY); }
    function cleanup() {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', cleanup);
      document.removeEventListener('touchmove', onTouchMoveDoc);
      document.removeEventListener('touchend', cleanup);
    }
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', cleanup);
    document.addEventListener('touchmove', onTouchMoveDoc, { passive: true });
    document.addEventListener('touchend', cleanup);
  }, [deltaY]);

  if (status !== 'authenticated') return null;

  const onlineUserIds = new Set(onlineUsers.map((u) => u.userId));

  const allFriends = (data?.friends ?? []).map((f) =>
    realtimeActive ? { ...f, isOnline: onlineUserIds.has(f.userId) } : f
  );
  const onlineCount = allFriends.filter((f) => f.isOnline).length;

  const friends = allFriends.filter((f) => {
    if (onlineOnly && !f.isOnline) return false;
    if (friendSearch.trim()) return f.nickname.toLowerCase().includes(friendSearch.toLowerCase());
    return true;
  });

  const playingRoom = (battleRoomsData?.rooms ?? []).find(r => r.status === 'PLAYING');
  const totalUnread = Object.values(unreadCounts).reduce((a, b) => a + b, 0);

  return (
    <>
      {chatFriend && myId && (
        <ChatWindow
          myId={myId}
          friend={chatFriend}
          isOnline={onlineUserIds.has(chatFriend.userId)}
          onClose={() => setChatFriend(null)}
        />
      )}

      {/* 대결 진행 중 – 다른 페이지 차단 */}
      {playingRoom && !isOnBattlePage && battleRoomsData && (
        <div className="fixed inset-0 z-[65] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
          <div className="relative bg-[#111111] border border-neutral-700 rounded-2xl shadow-2xl p-6 max-w-xs w-full text-center">
            <div className="w-10 h-10 rounded-full bg-red-500/15 border border-red-500/30 flex items-center justify-center mx-auto mb-4">
              <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="text-red-400">
                <path d="M14.5 17.5L3 6V3h3l11.5 11.5" /><path d="M13 19l2 2" /><path d="M19 13l2 2" /><path d="M14.5 6.5l3-3 3 3-3 3" /><path d="M6.5 14.5l-3 3 3 3 3-3" />
              </svg>
            </div>
            <p className="text-sm font-semibold text-white mb-1">대결 진행 중</p>
            <p className="text-sm text-neutral-400 mb-5">대결이 진행 중입니다.<br />다른 기능을 사용하려면 대결을 완료해 주세요.</p>
            <button
              onClick={() => router.push(`/battle/${playingRoom.id}`)}
              className="w-full rounded-lg bg-white text-black text-sm font-semibold py-2.5 hover:bg-neutral-200 transition-colors"
            >
              대결 화면으로 이동
            </button>
          </div>
        </div>
      )}

      {/* 프로필 모달 - UserProfileModal 통일 */}
      {selectedFriend && (
        <UserProfileModal
          userId={selectedFriend.userId}
          nickname={selectedFriend.nickname}
          isOnline={selectedFriend.isOnline}
          isFriend={true}
          showActions={true}
          onClose={() => setSelectedFriend(null)}
          friendActions={{
            battleStatus: selectedFriend.battleStatus,
            isPlayingQuiz: selectedFriend.isPlayingQuiz,
            onBattle: (category) => createRoom.mutate({ friendId: selectedFriend.userId, category }),
            onRemove: () => removeFriend.mutate(selectedFriend.friendshipId),
          }}
        />
      )}

      <div ref={panelRef} className="fixed right-4 z-40 flex flex-col items-end" style={{ bottom: 'max(7rem, calc(env(safe-area-inset-bottom, 0px) + 7rem))', transform: `translateY(${-deltaY}px)` }}>
        {open && (
          <div className="mb-2 w-64 bg-[#0f0f0f] border border-neutral-800 rounded-xl shadow-2xl overflow-hidden">
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

            {activeRoom && (
              <button
                onClick={() => { router.push(`/battle/${activeRoom.id}`); setOpen(false); }}
                className={`w-full flex items-center gap-3 px-3.5 py-3 border-b transition-colors text-left ${
                  activeRoom.status === 'PLAYING'
                    ? 'border-red-900/40 bg-red-500/10 hover:bg-red-500/20'
                    : 'border-amber-900/40 bg-amber-500/10 hover:bg-amber-500/20'
                }`}
              >
                <span className="relative flex-shrink-0 w-2.5 h-2.5">
                  <span className={`absolute inset-0 rounded-full animate-ping opacity-75 ${activeRoom.status === 'PLAYING' ? 'bg-red-500' : 'bg-amber-500'}`} />
                  <span className={`relative block w-2.5 h-2.5 rounded-full ${activeRoom.status === 'PLAYING' ? 'bg-red-400' : 'bg-amber-400'}`} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className={`text-xs font-semibold ${activeRoom.status === 'PLAYING' ? 'text-red-400' : 'text-amber-400'}`}>
                    {activeRoom.status === 'PLAYING' ? '⚔ 대결 진행 중' : '⏳ 대결 대기 중'}
                  </p>
                  <p className="text-[10px] text-neutral-500 mt-0.5">탭하여 대결 화면으로 이동</p>
                </div>
                <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={activeRoom.status === 'PLAYING' ? 'text-red-500' : 'text-amber-500'}>
                  <path d="M9 18l6-6-6-6" />
                </svg>
              </button>
            )}

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

            {allFriends.length >= 5 && (
              <div className="px-3 py-2 border-b border-neutral-800/60 flex items-center gap-1.5">
                <input
                  type="text"
                  value={friendSearch}
                  onChange={(e) => setFriendSearch(e.target.value)}
                  placeholder="닉네임 검색..."
                  className="flex-1 min-w-0 bg-neutral-800/60 border border-neutral-800 rounded px-2 py-1 text-[11px] text-white placeholder-neutral-600 focus:outline-none focus:border-neutral-600"
                />
                <button
                  onClick={() => setOnlineOnly((v) => !v)}
                  title="접속 중만 보기"
                  className={`flex-shrink-0 px-2 py-1 rounded text-[10px] border transition-colors ${onlineOnly ? 'border-emerald-500/50 text-emerald-400 bg-emerald-500/10' : 'border-neutral-800 text-neutral-600 hover:text-neutral-400'}`}
                >
                  접속 중
                </button>
              </div>
            )}

            <ul className="max-h-72 overflow-y-auto">
              {allFriends.length === 0 ? (
                <li className="px-3.5 py-5 text-center">
                  <p className="text-xs text-neutral-600 mb-2">친구가 없습니다</p>
                  <button
                    onClick={() => setAddingFriend(true)}
                    className="text-xs text-neutral-400 underline underline-offset-2 hover:text-white transition-colors"
                  >
                    친구 추가하기
                  </button>
                </li>
              ) : friends.length === 0 ? (
                <li className="px-3.5 py-4 text-center">
                  <p className="text-xs text-neutral-600">검색 결과 없음</p>
                </li>
              ) : (
                friends.map((f) => {
                  const unread = unreadCounts[f.userId] ?? 0;
                  function openChat() {
                    setChatFriend({ userId: f.userId, nickname: f.nickname });
                    setUnreadCounts((prev) => { const next = { ...prev }; delete next[f.userId]; return next; });
                    setOpen(false);
                  }
                  return (
                    <li key={f.friendshipId}>
                      <div
                        role="button"
                        tabIndex={0}
                        onClick={() => { if (unread > 0) { openChat(); } else { setSelectedFriend(f); } }}
                        onKeyDown={(e) => { if (e.key === 'Enter') { if (unread > 0) { openChat(); } else { setSelectedFriend(f); } } }}
                        className="w-full flex items-center gap-2.5 px-3.5 py-2.5 hover:bg-neutral-800/60 transition-colors cursor-pointer"
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
                          <p className={`text-[10px] ${
                            f.battleStatus === 'PLAYING' ? 'text-red-500' :
                            f.battleStatus === 'WAITING' ? 'text-amber-500' :
                            f.isPlayingQuiz ? 'text-blue-500' :
                            f.isOnline ? 'text-emerald-500' : 'text-neutral-600'
                          }`}>
                            {f.battleStatus === 'PLAYING' ? '⚔ 대결 중' :
                             f.battleStatus === 'WAITING' ? '⏳ 준비 중' :
                             f.isPlayingQuiz ? '📝 퀴즈 풀이 중' :
                             formatLastSeen(f.lastSeenAt, f.isOnline)}
                          </p>
                        </div>
                        {(f.isOnline || unread > 0) && (
                          <button
                            onClick={(e) => { e.stopPropagation(); openChat(); }}
                            className={`relative flex items-center justify-center w-7 h-7 rounded-full transition-colors flex-shrink-0 ${
                              unread > 0
                                ? 'bg-orange-500/20 border border-orange-500/50 text-orange-400 hover:bg-orange-500/30 hover:border-orange-400'
                                : 'bg-sky-500/15 border border-sky-500/30 text-sky-400 hover:bg-sky-500/30 hover:border-sky-400'
                            }`}
                            title="채팅"
                          >
                            <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                            </svg>
                            {unread > 0 && (
                              <span className="absolute -top-1 -right-1 min-w-[14px] h-3.5 bg-orange-500 text-white text-[8px] font-bold rounded-full flex items-center justify-center px-0.5 leading-none">
                                {unread > 9 ? '9+' : unread}
                              </span>
                            )}
                          </button>
                        )}
                      </div>
                    </li>
                  );
                })
              )}
            </ul>
          </div>
        )}

        <button
          onMouseDown={(e) => { e.preventDefault(); startDrag(e.clientY); }}
          onTouchStart={(e) => { startDrag(e.touches[0].clientY); }}
          onClick={() => {
            if (didDragRef.current) { didDragRef.current = false; return; }
            if (activeRoom && !open) {
              router.push(`/battle/${activeRoom.id}`);
              return;
            }
            setOpen((v) => !v);
            if (!open) setAddingFriend(false);
          }}
          className={`relative w-12 h-12 rounded-full flex items-center justify-center transition-colors shadow-lg touch-none ${
            activeRoom?.status === 'PLAYING'
              ? 'bg-red-500/20 border-2 border-red-500 text-red-400 hover:bg-red-500/30'
              : activeRoom?.status === 'WAITING'
              ? 'bg-amber-500/20 border-2 border-amber-500 text-amber-400 hover:bg-amber-500/30'
              : 'bg-[#1a1a1a] border border-neutral-700 text-neutral-400 hover:text-white hover:border-neutral-500'
          }`}
          aria-label={activeRoom ? '대결 진행 중 - 탭하여 이동' : '친구 목록'}
        >
          {activeRoom?.status === 'PLAYING' && (
            <span className="absolute inset-0 rounded-full border-2 border-red-500 animate-ping opacity-30" />
          )}
          {activeRoom ? (
            <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
              <path d="M14.5 17.5L3 6V3h3l11.5 11.5" />
              <path d="M13 19l2 2" />
              <path d="M19 13l2 2" />
              <path d="M14.5 6.5l3-3 3 3-3 3" />
              <path d="M6.5 14.5l-3 3 3 3 3-3" />
            </svg>
          ) : (
            <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 00-3-3.87" />
              <path d="M16 3.13a4 4 0 010 7.75" />
            </svg>
          )}
          {activeRoom ? (
            <span className={`absolute -top-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold border-2 border-[#0a0a0a] ${
              activeRoom.status === 'PLAYING' ? 'bg-red-500 text-white' : 'bg-amber-500 text-black'
            }`}>
              {activeRoom.status === 'PLAYING' ? '⚔' : '⏳'}
            </span>
          ) : totalUnread > 0 ? (
            <span className="absolute -top-1.5 -right-1.5 flex items-center gap-0.5 bg-orange-500 text-white rounded-full min-w-[20px] h-5 justify-center px-1.5 leading-none animate-pulse">
              <svg width={8} height={8} viewBox="0 0 24 24" fill="currentColor" className="flex-shrink-0">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
              <span className="text-[9px] font-bold">{totalUnread > 99 ? '99+' : totalUnread}</span>
            </span>
          ) : onlineCount > 0 ? (
            <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-emerald-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1 leading-none">
              {onlineCount}
            </span>
          ) : null}
        </button>
      </div>
    </>
  );
}
