'use client';

import { useSession } from 'next-auth/react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { usePathname } from 'next/navigation';
import { useScrollLock } from '@/lib/use-scroll-lock';

interface RejectedPayload {
  fromNickname: string;
}

interface Notification {
  id: string;
  type: string;
  payload: RejectedPayload;
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

export default function BattleRejectedAlert() {
  const { status } = useSession();
  const pathname = usePathname();
  const queryClient = useQueryClient();

  const { data } = useQuery<NotificationsResponse>({
    queryKey: ['notifications'],
    queryFn: fetchNotifications,
    refetchInterval: 5_000,
    enabled: status === 'authenticated',
  });

  const dismiss = useMutation({
    mutationFn: (id: string) =>
      fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const pending = (data?.notifications ?? []).find(
    (n) => n.type === 'BATTLE_REJECTED' && !n.isRead
  );

  useScrollLock(!!pending && !pathname.startsWith('/battle/'));

  // 배틀 페이지에서는 in-page 거절 모달이 처리하므로 전역 팝업 생략
  if (pathname.startsWith('/battle/')) return null;

  if (!pending) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" />
      <div className="relative w-full max-w-xs bg-[#111111] border border-neutral-700 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="flex flex-col items-center pt-7 pb-5 px-6 text-center">
          <div className="w-12 h-12 rounded-full bg-neutral-800 border border-neutral-700 flex items-center justify-center mb-3">
            <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="text-neutral-400">
              <circle cx="12" cy="12" r="10" /><path d="M15 9l-6 6M9 9l6 6" />
            </svg>
          </div>
          <p className="text-sm font-semibold text-white mb-1">대전 거절됨</p>
          <p className="text-sm text-neutral-400">
            <span className="text-white font-medium">{pending.payload.fromNickname}</span>님이<br />대전 신청을 거절하였습니다
          </p>
        </div>
        <div className="border-t border-neutral-800">
          <button
            onClick={() => dismiss.mutate(pending.id)}
            disabled={dismiss.isPending}
            className="w-full py-3.5 text-sm font-semibold text-white hover:bg-neutral-800/50 transition-colors disabled:opacity-40"
          >
            확인
          </button>
        </div>
      </div>
    </div>
  );
}
