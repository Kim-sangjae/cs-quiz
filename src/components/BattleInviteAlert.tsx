'use client';

import { useSession } from 'next-auth/react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';

const CATEGORY_LABEL: Record<string, string> = {
  ds: '자료구조', algo: '알고리즘', os: '운영체제',
  network: '네트워크', db: '데이터베이스', arch: '컴퓨터 구조',
};

interface BattleInvitePayload {
  fromNickname: string;
  roomId: string;
  category?: string;
}

interface Notification {
  id: string;
  type: string;
  payload: BattleInvitePayload;
  isRead: boolean;
}

interface NotificationsResponse {
  notifications: Notification[];
}

async function fetchNotifications(): Promise<NotificationsResponse> {
  const res = await fetch('/api/notifications');
  if (!res.ok) throw new Error('failed');
  return res.json() as Promise<NotificationsResponse>;
}

async function markRead(id: string): Promise<void> {
  await fetch('/api/notifications', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id }),
  });
}

export default function BattleInviteAlert() {
  const { status } = useSession();
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data } = useQuery<NotificationsResponse>({
    queryKey: ['notifications'],
    queryFn: fetchNotifications,
    refetchInterval: 5_000,
    enabled: status === 'authenticated',
  });

  const joinMutation = useMutation({
    mutationFn: async ({ notifId, roomId }: { notifId: string; roomId: string }) => {
      await markRead(notifId);
      const res = await fetch(`/api/battle/rooms/${roomId}/join`, { method: 'POST' });
      if (!res.ok) {
        const body = await res.json() as { error?: string };
        throw new Error(body.error ?? '오류가 발생했습니다');
      }
      return roomId;
    },
    onSuccess: (roomId) => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      router.push(`/battle/${roomId}`);
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ notifId, roomId }: { notifId: string; roomId: string }) => {
      await markRead(notifId);
      const res = await fetch(`/api/battle/rooms/${roomId}/reject`, { method: 'POST' });
      if (!res.ok) {
        const body = await res.json() as { error?: string };
        throw new Error(body.error ?? '오류가 발생했습니다');
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const pending = (data?.notifications ?? []).find(
    (n) => n.type === 'BATTLE_INVITE' && !n.isRead
  );

  if (!pending) return null;

  const payload = pending.payload;
  const isActing = joinMutation.isPending || rejectMutation.isPending;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" />
      <div className="relative w-full max-w-xs bg-[#111111] border border-neutral-700 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* 아이콘 + 타이틀 */}
        <div className="flex flex-col items-center pt-7 pb-4 px-6 text-center">
          <div className="w-12 h-12 rounded-full bg-neutral-800 border border-neutral-700 flex items-center justify-center mb-3">
            <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="text-white">
              <path d="M14.5 17.5L3 6V3h3l11.5 11.5" />
              <path d="M13 19l6-6" />
              <path d="M16 16l4 4" />
              <path d="M19 21l2-2" />
              <path d="M3 21l6-6" />
              <path d="M8 8l-5 5" />
              <path d="M2 2l1 1" />
            </svg>
          </div>
          <p className="text-sm font-semibold text-white mb-1">대전 신청</p>
          <p className="text-sm text-neutral-400">
            <span className="text-white font-medium">{payload.fromNickname}</span>님이{'\n'}대전을 신청했습니다
          </p>
          {payload.category && (
            <span className="mt-3 text-[11px] text-emerald-400 border border-emerald-800/60 rounded px-2 py-0.5">
              {CATEGORY_LABEL[payload.category] ?? payload.category}
            </span>
          )}
          {joinMutation.isError && (
            <p className="mt-2 text-xs text-red-400">
              {(joinMutation.error as Error).message}
            </p>
          )}
        </div>

        {/* 버튼 */}
        <div className="flex border-t border-neutral-800">
          <button
            onClick={() => rejectMutation.mutate({ notifId: pending.id, roomId: payload.roomId })}
            disabled={isActing}
            className="flex-1 py-3.5 text-sm text-neutral-500 hover:text-red-400 hover:bg-neutral-800/50 transition-colors disabled:opacity-40 border-r border-neutral-800"
          >
            {rejectMutation.isPending ? '...' : '거절하기'}
          </button>
          <button
            onClick={() => joinMutation.mutate({ notifId: pending.id, roomId: payload.roomId })}
            disabled={isActing}
            className="flex-1 py-3.5 text-sm font-semibold text-white hover:bg-neutral-800/50 transition-colors disabled:opacity-40"
          >
            {joinMutation.isPending ? '입장 중...' : '수락하기'}
          </button>
        </div>
      </div>
    </div>
  );
}
