'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSession } from 'next-auth/react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';

const CATEGORIES = [
  { key: 'ds', label: '자료구조' },
  { key: 'algo', label: '알고리즘' },
  { key: 'os', label: '운영체제' },
  { key: 'network', label: '네트워크' },
  { key: 'db', label: '데이터베이스' },
  { key: 'arch', label: '컴퓨터 구조' },
] as const;

interface ActiveRoom {
  id: string;
  status: 'WAITING' | 'PLAYING';
  category: string;
  host: { id: string; nickname: string | null };
  guest: { id: string; nickname: string | null } | null;
}

interface Friend {
  friendshipId: string;
  userId: string;
  nickname: string;
  isOnline: boolean;
}

function BattlePageInner() {
  const { status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();

  const inviteId = searchParams.get('invite');
  const [selectedFriendId, setSelectedFriendId] = useState<string | null>(inviteId);
  const [selectedCategory, setSelectedCategory] = useState<string>('ds');
  const [showInvite, setShowInvite] = useState(!!inviteId);

  useEffect(() => {
    if (inviteId) {
      setSelectedFriendId(inviteId);
      setShowInvite(true);
    }
  }, [inviteId]);

  const { data: roomsData } = useQuery<{ rooms: ActiveRoom[] }>({
    queryKey: ['battle', 'rooms'],
    queryFn: () => fetch('/api/battle/rooms').then((r) => r.json()),
    enabled: status === 'authenticated',
    refetchInterval: 10_000,
  });

  const { data: friendsData } = useQuery<{ friends: Friend[] }>({
    queryKey: ['friends'],
    queryFn: () => fetch('/api/friends').then((r) => r.json()),
    enabled: status === 'authenticated',
    staleTime: 30_000,
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
      setShowInvite(false);
      queryClient.invalidateQueries({ queryKey: ['battle', 'rooms'] });
      if (data.roomId) router.push(`/battle/${data.roomId}`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (status === 'loading') return null;

  if (status === 'unauthenticated') {
    return (
      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-12">
        <p className="text-sm text-neutral-500">로그인 후 이용할 수 있습니다.</p>
      </main>
    );
  }

  const rooms = roomsData?.rooms ?? [];
  const friends = friendsData?.friends ?? [];
  const selectedFriend = friends.find((f) => f.userId === selectedFriendId);

  const CATEGORY_LABEL: Record<string, string> = Object.fromEntries(CATEGORIES.map((c) => [c.key, c.label]));

  return (
    <main className="max-w-2xl mx-auto px-4 sm:px-6 py-10">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-base font-semibold text-white">대전 모드</h1>
        <button
          onClick={() => setShowInvite(true)}
          className="text-sm rounded-md bg-white text-black font-medium px-4 py-1.5 hover:bg-neutral-200 transition-colors"
        >
          대전 신청
        </button>
      </div>

      {/* 대전 신청 패널 */}
      {showInvite && (
        <div className="mb-6 bg-[#111111] border border-neutral-800 rounded-xl p-5">
          <p className="text-sm font-medium text-white mb-4">대전 신청하기</p>

          <div className="mb-4">
            <p className="text-xs text-neutral-500 mb-2">친구 선택</p>
            {friends.length === 0 ? (
              <p className="text-sm text-neutral-600">친구가 없습니다. 먼저 친구를 추가해보세요.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {friends.map((f) => (
                  <button
                    key={f.userId}
                    onClick={() => setSelectedFriendId(f.userId)}
                    className={`flex items-center gap-1.5 text-sm px-3 py-1.5 rounded border transition-colors ${
                      selectedFriendId === f.userId
                        ? 'border-neutral-400 text-white bg-neutral-800'
                        : 'border-neutral-800 text-neutral-400 hover:border-neutral-600 hover:text-neutral-200'
                    }`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${f.isOnline ? 'bg-emerald-500' : 'bg-neutral-700'}`} />
                    {f.nickname}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="mb-4">
            <p className="text-xs text-neutral-500 mb-2">카테고리 선택</p>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map((c) => (
                <button
                  key={c.key}
                  onClick={() => setSelectedCategory(c.key)}
                  className={`text-sm px-3 py-1.5 rounded border transition-colors ${
                    selectedCategory === c.key
                      ? 'border-neutral-400 text-white bg-neutral-800'
                      : 'border-neutral-800 text-neutral-400 hover:border-neutral-600 hover:text-neutral-200'
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => {
                if (!selectedFriendId) return toast.error('친구를 선택해주세요');
                createRoom.mutate({ friendId: selectedFriendId, category: selectedCategory });
              }}
              disabled={createRoom.isPending || !selectedFriendId}
              className="rounded-md bg-white text-black text-sm font-medium px-4 py-2 hover:bg-neutral-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {createRoom.isPending ? '신청 중...' : `${selectedFriend?.nickname ?? '선택된 친구'}에게 신청`}
            </button>
            <button
              onClick={() => setShowInvite(false)}
              className="text-sm text-neutral-500 hover:text-neutral-300 px-3 transition-colors"
            >
              취소
            </button>
          </div>
        </div>
      )}

      {/* 진행 중인 대전 목록 */}
      <div>
        <p className="text-xs text-neutral-500 mb-3">진행 중인 대전</p>
        {rooms.length === 0 ? (
          <p className="text-sm text-neutral-600">진행 중인 대전이 없습니다.</p>
        ) : (
          <ul className="space-y-2">
            {rooms.map((room) => (
              <li key={room.id}>
                <button
                  onClick={() => router.push(`/battle/${room.id}`)}
                  className="w-full text-left bg-[#111111] border border-neutral-800 rounded-xl p-4 hover:border-neutral-700 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded border ${
                        room.status === 'WAITING'
                          ? 'text-amber-400 border-amber-800/60'
                          : 'text-emerald-400 border-emerald-800/60'
                      }`}>
                        {room.status === 'WAITING' ? '대기 중' : '진행 중'}
                      </span>
                      <span className="text-sm text-neutral-300">
                        {CATEGORY_LABEL[room.category] ?? room.category}
                      </span>
                    </div>
                    <span className="text-xs text-neutral-500">
                      {room.host.nickname} vs {room.guest?.nickname ?? '?'}
                    </span>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}

export default function BattlePage() {
  return (
    <Suspense fallback={null}>
      <BattlePageInner />
    </Suspense>
  );
}
