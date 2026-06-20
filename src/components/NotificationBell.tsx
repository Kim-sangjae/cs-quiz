'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

interface NotificationPayload {
  questionId?: string;
  questionTitle?: string;
  rejectionReason?: string;
  newRole?: string;
  inquiryTitle?: string;
  category?: string;
  prevLevel?: number;
  newLevel?: number;
  levelName?: string;
  fromNickname?: string;
  roomId?: string;
  friendshipId?: string;
}

interface Notification {
  id: string;
  type: 'QUESTION_APPROVED' | 'QUESTION_REJECTED' | 'ROLE_CHANGED' | 'INQUIRY_REPLIED' | 'LEVEL_UP' | 'FRIEND_REQUEST' | 'FRIEND_ACCEPTED' | 'BATTLE_INVITE' | 'BATTLE_REJECTED';
  payload: NotificationPayload;
  actionUrl: string | null;
  isRead: boolean;
  createdAt: string;
}

interface NotificationsResponse {
  notifications: Notification[];
  unreadCount: number;
}

function getNotificationMessage(n: Notification): string {
  const payload = n.payload;
  if (n.type === 'QUESTION_APPROVED') return `'${payload.questionTitle}' 문제가 승인되었습니다.`;
  if (n.type === 'QUESTION_REJECTED') return `'${payload.questionTitle}' 문제가 거절되었습니다. 사유: ${payload.rejectionReason ?? ''}`;
  if (n.type === 'ROLE_CHANGED') return payload.newRole === 'ADMIN' ? '관리자 권한이 부여되었습니다.' : '일반 사용자로 권한이 변경되었습니다.';
  if (n.type === 'INQUIRY_REPLIED') return `'${payload.inquiryTitle}' 문의에 답변이 등록되었습니다.`;
  if (n.type === 'LEVEL_UP') return `${payload.levelName ?? ''} 달성! Lv.${payload.prevLevel} → Lv.${payload.newLevel}으로 레벨업했습니다.`;
  if (n.type === 'FRIEND_REQUEST') return `${payload.fromNickname ?? '누군가'}님이 친구 요청을 보냈습니다.`;
  if (n.type === 'FRIEND_ACCEPTED') return `${payload.fromNickname ?? '누군가'}님이 친구 요청을 수락했습니다.`;
  if (n.type === 'BATTLE_INVITE') return `${payload.fromNickname ?? '누군가'}님이 대전을 신청했습니다.`;
  if (n.type === 'BATTLE_REJECTED') return `${payload.fromNickname ?? '누군가'}님이 대전 신청을 거절했습니다.`;
  return '새 알림이 있습니다.';
}

async function fetchNotifications(): Promise<NotificationsResponse> {
  const res = await fetch('/api/notifications');
  if (!res.ok) throw new Error('Failed to fetch notifications');
  return res.json();
}

async function markRead(id?: string): Promise<void> {
  await fetch('/api/notifications', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id }),
  });
}

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [pendingFriendship, setPendingFriendship] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data } = useQuery<NotificationsResponse>({
    queryKey: ['notifications'],
    queryFn: fetchNotifications,
    refetchInterval: 60_000,
  });

  const markReadMutation = useMutation({
    mutationFn: markRead,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const friendshipMutation = useMutation({
    mutationFn: ({ friendshipId, action }: { friendshipId: string; action: 'accept' | 'reject' }) =>
      fetch(`/api/friends/${friendshipId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      }).then(async (r) => {
        if (!r.ok) throw new Error('오류가 발생했습니다');
        return r.json();
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['friends'] });
      setPendingFriendship(null);
    },
  });

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const BATTLE_TYPES = new Set(['BATTLE_INVITE', 'BATTLE_REJECTED']);
  const notifications = (data?.notifications ?? []).filter((n) => !BATTLE_TYPES.has(n.type));
  const unreadCount = notifications.filter((n) => !n.isRead).length;
  const badgeCount = Math.min(unreadCount, 99);

  function handleNotificationClick(n: Notification) {
    if (n.type === 'FRIEND_REQUEST') return;
    if (!n.isRead) markReadMutation.mutate(n.id);
    setOpen(false);
    if (n.actionUrl) router.push(n.actionUrl);
  }

  function handleMarkAllRead() {
    markReadMutation.mutate(undefined);
  }

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative p-1.5 text-neutral-400 hover:text-white transition-colors"
        aria-label="알림"
      >
        <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
          <path d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {badgeCount > 0 && (
          <span className="absolute top-0 right-0 min-w-[16px] h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-0.5 leading-none">
            {badgeCount > 99 ? '99+' : badgeCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 max-w-[calc(100vw-2rem)] bg-[#111111] border border-neutral-800 rounded-lg shadow-lg z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-800">
            <span className="text-sm font-medium text-white">알림</span>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="text-xs text-neutral-400 hover:text-white transition-colors"
              >
                모두 읽음
              </button>
            )}
          </div>

          <ul className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <li className="px-4 py-6 text-center text-sm text-neutral-500">
                알림이 없습니다
              </li>
            ) : (
              notifications.map((n) => (
                <li key={n.id} className={`border-b border-neutral-800 last:border-b-0 ${!n.isRead ? 'bg-[#161616]' : ''}`}>
                  {n.type === 'FRIEND_REQUEST' && n.payload.friendshipId ? (
                    <div className="px-4 py-3">
                      <div className="flex items-start gap-3 mb-2">
                        <span className="mt-1.5 flex-shrink-0 w-1.5 h-1.5 rounded-full bg-blue-500" />
                        <span className="text-sm text-neutral-100 font-medium leading-snug">
                          {getNotificationMessage(n)}
                        </span>
                      </div>
                      <div className="flex gap-2 pl-4">
                        <button
                          onClick={() => {
                            setPendingFriendship(n.payload.friendshipId!);
                            friendshipMutation.mutate({ friendshipId: n.payload.friendshipId!, action: 'accept' });
                          }}
                          disabled={friendshipMutation.isPending && pendingFriendship === n.payload.friendshipId}
                          className="flex-1 text-xs font-medium rounded bg-white text-black py-1.5 hover:bg-neutral-200 transition-colors disabled:opacity-50"
                        >
                          수락
                        </button>
                        <button
                          onClick={() => {
                            setPendingFriendship(n.payload.friendshipId!);
                            friendshipMutation.mutate({ friendshipId: n.payload.friendshipId!, action: 'reject' });
                          }}
                          disabled={friendshipMutation.isPending && pendingFriendship === n.payload.friendshipId}
                          className="flex-1 text-xs font-medium rounded border border-neutral-700 text-neutral-400 py-1.5 hover:border-neutral-500 hover:text-white transition-colors disabled:opacity-50"
                        >
                          거절
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => handleNotificationClick(n)}
                      className="w-full text-left px-4 py-3 text-sm transition-colors hover:bg-[#1a1a1a] flex items-start gap-3"
                    >
                      <span className={`mt-1.5 flex-shrink-0 w-1.5 h-1.5 rounded-full ${!n.isRead ? 'bg-blue-500' : 'bg-transparent'}`} />
                      <span className={!n.isRead ? 'text-neutral-100 font-medium' : 'text-neutral-500'}>
                        {getNotificationMessage(n)}
                      </span>
                    </button>
                  )}
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
