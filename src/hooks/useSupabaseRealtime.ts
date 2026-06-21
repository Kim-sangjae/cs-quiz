'use client';

import { useEffect, useRef, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useQueryClient } from '@tanstack/react-query';
import { supabaseBrowser } from '@/lib/supabase-browser';
import type { RealtimeChannel } from '@supabase/supabase-js';

export interface OnlineUser {
  userId: string;
  nickname: string;
}

interface UseSupabaseRealtimeReturn {
  onlineUsers: OnlineUser[];
  realtimeActive: boolean;
}

export function useSupabaseRealtime(): UseSupabaseRealtimeReturn {
  const { data: session, status } = useSession();
  const queryClient = useQueryClient();
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const [realtimeActive, setRealtimeActive] = useState(false);
  const presenceChannelRef = useRef<RealtimeChannel | null>(null);
  const broadcastChannelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    if (status !== 'authenticated' || !session?.user?.id) return;

    const userId = session.user.id;
    const nickname = session.user.nickname ?? session.user.name ?? '사용자';

    // Presence 채널 — 온라인 유저 목록
    const presenceChannel = supabaseBrowser.channel('online-users', {
      config: { presence: { key: userId } },
    });

    presenceChannel
      .on('presence', { event: 'sync' }, () => {
        const state = presenceChannel.presenceState<{ nickname: string }>();
        const users: OnlineUser[] = Object.entries(state).map(([uid, presences]) => ({
          userId: uid,
          nickname: presences[0]?.nickname ?? uid,
        }));
        setOnlineUsers(users);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await presenceChannel.track({ nickname });
          setRealtimeActive(true);
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          setRealtimeActive(false);
        }
      });

    presenceChannelRef.current = presenceChannel;

    // Broadcast 채널 — 내 전용 이벤트 수신
    const broadcastChannel = supabaseBrowser.channel(`user:${userId}`);

    broadcastChannel
      .on('broadcast', { event: 'friend_request' }, () => {
        queryClient.invalidateQueries({ queryKey: ['notifications'] });
      })
      .on('broadcast', { event: 'friend_accepted' }, () => {
        queryClient.invalidateQueries({ queryKey: ['notifications'] });
        queryClient.invalidateQueries({ queryKey: ['friends'] });
      })
      .on('broadcast', { event: 'friend_rejected' }, () => {
        queryClient.invalidateQueries({ queryKey: ['notifications'] });
      })
      .subscribe();

    broadcastChannelRef.current = broadcastChannel;

    return () => {
      supabaseBrowser.removeChannel(presenceChannel);
      supabaseBrowser.removeChannel(broadcastChannel);
      setRealtimeActive(false);
    };
  }, [status, session?.user?.id, session?.user?.nickname, session?.user?.name, queryClient]);

  return { onlineUsers, realtimeActive };
}
