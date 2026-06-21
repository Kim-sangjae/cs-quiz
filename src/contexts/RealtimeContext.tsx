'use client';

import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useQueryClient } from '@tanstack/react-query';
import { supabaseBrowser } from '@/lib/supabase-browser';
import type { RealtimeChannel } from '@supabase/supabase-js';

export interface OnlineUser {
  userId: string;
  nickname: string;
}

interface RealtimeState {
  onlineUsers: OnlineUser[];
  realtimeActive: boolean;
}

const RealtimeContext = createContext<RealtimeState>({ onlineUsers: [], realtimeActive: false });

export function useRealtime() {
  return useContext(RealtimeContext);
}

export function RealtimeProvider({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const queryClient = useQueryClient();
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const [realtimeActive, setRealtimeActive] = useState(false);
  const presenceRef = useRef<RealtimeChannel | null>(null);
  const broadcastRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    if (status !== 'authenticated' || !session?.user?.id) return;

    const userId = session.user.id;
    const nickname = session.user.nickname ?? session.user.name ?? '사용자';

    const presenceChannel = supabaseBrowser.channel('online-users', {
      config: { presence: { key: userId } },
    });

    presenceChannel
      .on('presence', { event: 'sync' }, () => {
        const state = presenceChannel.presenceState<{ nickname: string }>();
        setOnlineUsers(
          Object.entries(state).map(([uid, presences]) => ({
            userId: uid,
            nickname: presences[0]?.nickname ?? uid,
          }))
        );
      })
      .subscribe(async (s) => {
        if (s === 'SUBSCRIBED') {
          await presenceChannel.track({ nickname });
          setRealtimeActive(true);
        } else if (s === 'CHANNEL_ERROR' || s === 'TIMED_OUT') {
          setRealtimeActive(false);
        }
      });

    presenceRef.current = presenceChannel;

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
      .on('broadcast', { event: 'friend_removed' }, () => {
        queryClient.invalidateQueries({ queryKey: ['friends'] });
      })
      .subscribe();

    broadcastRef.current = broadcastChannel;

    return () => {
      supabaseBrowser.removeChannel(presenceChannel);
      supabaseBrowser.removeChannel(broadcastChannel);
      setRealtimeActive(false);
    };
  }, [status, session?.user?.id, session?.user?.nickname, session?.user?.name, queryClient]);

  return (
    <RealtimeContext.Provider value={{ onlineUsers, realtimeActive }}>
      {children}
    </RealtimeContext.Provider>
  );
}
