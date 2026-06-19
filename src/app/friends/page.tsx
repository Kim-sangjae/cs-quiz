'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import Link from 'next/link';

interface Friend {
  friendshipId: string;
  userId: string;
  nickname: string;
  isOnline: boolean;
}

interface FriendRequest {
  id: string;
  userId: string;
  nickname: string;
}

interface RequestsData {
  received: FriendRequest[];
  sent: FriendRequest[];
}

type Tab = 'friends' | 'requests';

export default function FriendsPage() {
  const { status } = useSession();
  const [tab, setTab] = useState<Tab>('friends');
  const [nickname, setNickname] = useState('');
  const queryClient = useQueryClient();

  const { data: friendsData, isLoading: loadingFriends } = useQuery<{ friends: Friend[] }>({
    queryKey: ['friends'],
    queryFn: () => fetch('/api/friends').then((r) => r.json()),
    enabled: status === 'authenticated',
    refetchInterval: 30_000,
  });

  const { data: requestsData, isLoading: loadingRequests } = useQuery<RequestsData>({
    queryKey: ['friends', 'requests'],
    queryFn: () => fetch('/api/friends/requests').then((r) => r.json()),
    enabled: status === 'authenticated',
    refetchInterval: 30_000,
  });

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
      queryClient.invalidateQueries({ queryKey: ['friends'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const respondRequest = useMutation({
    mutationFn: ({ id, action }: { id: string; action: 'accept' | 'reject' }) =>
      fetch(`/api/friends/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      }).then(async (r) => {
        if (!r.ok) throw new Error('오류가 발생했습니다');
        return r.json();
      }),
    onSuccess: (_, { action }) => {
      toast.success(action === 'accept' ? '친구 요청을 수락했습니다' : '친구 요청을 거절했습니다');
      queryClient.invalidateQueries({ queryKey: ['friends'] });
      queryClient.invalidateQueries({ queryKey: ['friends', 'requests'] });
    },
    onError: () => toast.error('오류가 발생했습니다'),
  });

  const removeFriend = useMutation({
    mutationFn: (id: string) =>
      fetch(`/api/friends/${id}`, { method: 'DELETE' }).then(async (r) => {
        if (!r.ok) throw new Error('오류가 발생했습니다');
        return r.json();
      }),
    onSuccess: () => {
      toast.success('친구를 삭제했습니다');
      queryClient.invalidateQueries({ queryKey: ['friends'] });
    },
    onError: () => toast.error('오류가 발생했습니다'),
  });

  if (status === 'loading') return null;

  if (status === 'unauthenticated') {
    return (
      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-12">
        <p className="text-sm text-neutral-500">로그인 후 이용할 수 있습니다.</p>
      </main>
    );
  }

  const friends = friendsData?.friends ?? [];
  const received = requestsData?.received ?? [];
  const sent = requestsData?.sent ?? [];
  const pendingCount = received.length;

  return (
    <main className="max-w-2xl mx-auto px-4 sm:px-6 py-10">
      <h1 className="text-base font-semibold text-white mb-6">친구</h1>

      {/* 친구 추가 */}
      <div className="mb-6">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (nickname.trim()) addFriend.mutate(nickname.trim());
          }}
          className="flex gap-2"
        >
          <input
            type="text"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            placeholder="닉네임으로 친구 추가"
            className="flex-1 bg-[#111111] border border-neutral-800 rounded-md px-3 py-2 text-sm text-white placeholder-neutral-600 focus:outline-none focus:border-neutral-600"
          />
          <button
            type="submit"
            disabled={addFriend.isPending || !nickname.trim()}
            className="rounded-md bg-white text-black text-sm font-medium px-4 py-2 hover:bg-neutral-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
          >
            {addFriend.isPending ? '전송 중...' : '요청 보내기'}
          </button>
        </form>
      </div>

      {/* 탭 */}
      <div className="flex gap-1 mb-4 border-b border-neutral-800">
        <button
          onClick={() => setTab('friends')}
          className={`px-4 py-2 text-sm transition-colors ${
            tab === 'friends'
              ? 'text-white border-b-2 border-white -mb-px'
              : 'text-neutral-500 hover:text-neutral-300'
          }`}
        >
          친구 목록 {friends.length > 0 && <span className="text-neutral-500 text-xs">({friends.length})</span>}
        </button>
        <button
          onClick={() => setTab('requests')}
          className={`px-4 py-2 text-sm transition-colors relative ${
            tab === 'requests'
              ? 'text-white border-b-2 border-white -mb-px'
              : 'text-neutral-500 hover:text-neutral-300'
          }`}
        >
          요청
          {pendingCount > 0 && (
            <span className="ml-1.5 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[16px] h-4 inline-flex items-center justify-center px-1">
              {pendingCount}
            </span>
          )}
        </button>
      </div>

      {/* 친구 목록 탭 */}
      {tab === 'friends' && (
        <>
          {loadingFriends ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-12 bg-neutral-800/50 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : friends.length === 0 ? (
            <p className="text-sm text-neutral-500 py-6">
              아직 친구가 없습니다. 닉네임으로 친구를 추가해보세요.
            </p>
          ) : (
            <ul className="space-y-1">
              {friends.map((f) => (
                <li
                  key={f.friendshipId}
                  className="flex items-center justify-between py-3 border-b border-neutral-800 last:border-0"
                >
                  <div className="flex items-center gap-2.5">
                    <span
                      className={`w-2 h-2 rounded-full flex-shrink-0 ${
                        f.isOnline ? 'bg-emerald-500' : 'bg-neutral-700'
                      }`}
                    />
                    <span className="text-sm text-neutral-200">{f.nickname}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/battle?invite=${f.userId}`}
                      className="text-xs text-neutral-400 border border-neutral-800 rounded px-2.5 py-1 hover:border-neutral-600 hover:text-white transition-colors"
                    >
                      대전 신청
                    </Link>
                    <button
                      onClick={() => removeFriend.mutate(f.friendshipId)}
                      disabled={removeFriend.isPending}
                      className="text-xs text-neutral-600 hover:text-red-400 transition-colors px-2 py-1"
                    >
                      삭제
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {/* 요청 탭 */}
      {tab === 'requests' && (
        <div className="space-y-6">
          <div>
            <p className="text-xs text-neutral-500 mb-3">받은 요청</p>
            {loadingRequests ? (
              <div className="h-12 bg-neutral-800/50 rounded-lg animate-pulse" />
            ) : received.length === 0 ? (
              <p className="text-sm text-neutral-600">받은 요청이 없습니다</p>
            ) : (
              <ul className="space-y-1">
                {received.map((r) => (
                  <li key={r.id} className="flex items-center justify-between py-3 border-b border-neutral-800 last:border-0">
                    <span className="text-sm text-neutral-200">{r.nickname}</span>
                    <div className="flex gap-2">
                      <button
                        onClick={() => respondRequest.mutate({ id: r.id, action: 'accept' })}
                        disabled={respondRequest.isPending}
                        className="text-xs text-emerald-400 border border-emerald-800/60 rounded px-2.5 py-1 hover:border-emerald-600 transition-colors disabled:opacity-50"
                      >
                        수락
                      </button>
                      <button
                        onClick={() => respondRequest.mutate({ id: r.id, action: 'reject' })}
                        disabled={respondRequest.isPending}
                        className="text-xs text-neutral-500 border border-neutral-800 rounded px-2.5 py-1 hover:border-neutral-600 hover:text-neutral-300 transition-colors disabled:opacity-50"
                      >
                        거절
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <p className="text-xs text-neutral-500 mb-3">보낸 요청</p>
            {sent.length === 0 ? (
              <p className="text-sm text-neutral-600">보낸 요청이 없습니다</p>
            ) : (
              <ul className="space-y-1">
                {sent.map((s) => (
                  <li key={s.id} className="flex items-center justify-between py-3 border-b border-neutral-800 last:border-0">
                    <span className="text-sm text-neutral-200">{s.nickname}</span>
                    <span className="text-xs text-neutral-600">대기 중</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
