'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { supabaseBrowser } from '@/lib/supabase-browser';
import { ChatMessage } from '@/lib/chat-store';
import { useScrollLock } from '@/lib/use-scroll-lock';

interface Props {
  myId: string;
  friend: { userId: string; nickname: string };
  isOnline: boolean;
  onClose: () => void;
}

const MAX_LENGTH = 200;

export default function ChatWindow({ myId, friend, isOnline, onClose }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState('');
  const [channelReady, setChannelReady] = useState(false);
  const [friendOffline, setFriendOffline] = useState(!isOnline);
  const [keyboardOffset, setKeyboardOffset] = useState(0);
  const [vvHeight, setVvHeight] = useState<number | null>(null);
  const channelRef = useRef<ReturnType<typeof supabaseBrowser.channel> | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // 채팅창 열린 동안 뒷 배경 스크롤 방지
  useScrollLock(true);

  // visualViewport로 소프트 키보드 감지 (Samsung Browser 포함)
  const handleViewport = useCallback(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    setVvHeight(vv.height);
    setKeyboardOffset(Math.max(0, window.innerHeight - vv.height - vv.offsetTop));
  }, []);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    handleViewport();
    vv.addEventListener('resize', handleViewport);
    vv.addEventListener('scroll', handleViewport);
    return () => {
      vv.removeEventListener('resize', handleViewport);
      vv.removeEventListener('scroll', handleViewport);
    };
  }, [handleViewport]);

  const channelName = `csora-chat-${[myId, friend.userId].sort().join('-')}`;

  // DB에서 대화 기록 로드
  useEffect(() => {
    setLoading(true);
    setMessages([]);
    fetch(`/api/chat/messages?friendId=${friend.userId}`)
      .then((r) => r.json())
      .then((data: { messages: ChatMessage[] }) => setMessages(data.messages))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [friend.userId]);

  // isOnline prop 변경 감지 (재로그인 시 복구 포함)
  useEffect(() => {
    setFriendOffline(!isOnline);
  }, [isOnline]);

  // Supabase Broadcast 구독 (실시간 수신 + 상대방 오프라인 감지)
  useEffect(() => {
    const ch = supabaseBrowser
      .channel(channelName)
      .on('broadcast', { event: 'message' }, ({ payload }: { payload: ChatMessage }) => {
        if (payload.senderId === myId) return;
        setMessages((prev) => [...prev, payload]);
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') setChannelReady(true);
      });
    channelRef.current = ch;

    // 상대방 로그아웃 감지 채널
    const notifCh = supabaseBrowser
      .channel(`csora-chat-notif-${friend.userId}`)
      .on('broadcast', { event: 'user_offline' }, () => {
        setFriendOffline(true);
      })
      .subscribe();

    return () => {
      void supabaseBrowser.removeChannel(ch);
      void supabaseBrowser.removeChannel(notifCh);
    };
  }, [channelName, myId, friend.userId]);

  useEffect(() => {
    if (!loading) bottomRef.current?.scrollIntoView({ behavior: 'instant' });
  }, [loading]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  useEffect(() => {
    if (!loading) inputRef.current?.focus();
  }, [friend.userId, loading]);

  async function send() {
    const raw = input.trim();
    if (!raw || !channelReady) return;
    setInput('');

    // DB 저장 (비속어 마스킹은 서버에서 처리)
    const res = await fetch('/api/chat/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ receiverId: friend.userId, content: raw }),
    });
    if (!res.ok) return;
    const { message } = await res.json() as { message: ChatMessage };

    // 로컬 상태 즉시 반영
    setMessages((prev) => [...prev, message]);

    // 상대방 채팅 채널에 실시간 전송
    await channelRef.current?.send({ type: 'broadcast', event: 'message', payload: message });

    // 상대방 알림 채널에 전송 (채팅창 미열림 시 뱃지용)
    const notifCh = supabaseBrowser.channel(`csora-chat-notif-${friend.userId}`);
    try {
      await notifCh.send({ type: 'broadcast', event: 'chat_message', payload: message });
    } finally {
      void supabaseBrowser.removeChannel(notifCh);
    }
  }

  const chatBottom = keyboardOffset > 0 ? `${keyboardOffset + 8}px` : 'max(10.5rem, calc(env(safe-area-inset-bottom, 0px) + 10.5rem))';
  const chatHeight = keyboardOffset > 0
    ? `min(340px, calc(${vvHeight ?? 0}px - 5rem))`
    : 'min(340px, calc(100dvh - 12rem))';

  return (
    <>
    {/* 바깥 클릭 시 닫기 */}
    <div className="fixed inset-0 z-[48]" onClick={onClose} />
    <div
      className="fixed right-4 z-[49] flex flex-col bg-[#0f0f0f] border border-neutral-800 rounded-xl shadow-2xl w-72 max-w-[calc(100vw-2rem)]"
      style={{ bottom: chatBottom, height: chatHeight }}
    >
      {/* 헤더 */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-neutral-800 flex-shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-6 h-6 rounded-full bg-neutral-800 border border-neutral-700 flex items-center justify-center text-[10px] font-bold text-neutral-400 flex-shrink-0">
            {friend.nickname[0]?.toUpperCase() ?? '?'}
          </div>
          <span className="text-xs font-medium text-white truncate">{friend.nickname}</span>
          {!channelReady && !loading && (
            <span className="text-[10px] text-neutral-600 flex-shrink-0">연결 중...</span>
          )}
        </div>
        <button
          onClick={onClose}
          className="flex-shrink-0 text-neutral-600 hover:text-white transition-colors ml-2"
          aria-label="채팅 닫기"
        >
          <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* 메시지 목록 */}
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1.5">
        {/* 안내 문구 */}
        <div className="flex items-center justify-center gap-1 py-1.5 mb-1 border-b border-amber-500/20 bg-amber-500/5 rounded-md">
          <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="text-amber-500/80 flex-shrink-0">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          <p className="text-[10px] text-amber-500/80">로그아웃 시 채팅 기록이 삭제됩니다</p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-6">
            <span className="text-[11px] text-neutral-600">불러오는 중...</span>
          </div>
        ) : messages.length === 0 ? (
          <p className="text-[11px] text-neutral-600 text-center pt-4">대화를 시작해보세요</p>
        ) : (
          messages.map((m) => {
            const isMe = m.senderId === myId;
            return (
              <div key={m.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] px-2.5 py-1.5 rounded-lg text-xs leading-relaxed break-words ${
                  isMe ? 'bg-blue-600 text-white' : 'bg-neutral-800 text-neutral-200'
                }`}>
                  {m.content}
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* 오프라인 배너 */}
      {friendOffline && (
        <div className="px-3 py-2 border-t border-neutral-800 bg-neutral-900/80 flex items-center gap-1.5 flex-shrink-0">
          <span className="w-1.5 h-1.5 rounded-full bg-neutral-600 flex-shrink-0" />
          <p className="text-[11px] text-neutral-500">{friend.nickname}님이 오프라인 상태입니다</p>
        </div>
      )}

      {/* 입력창 */}
      {!friendOffline && (
        <div className="px-2.5 py-2 border-t border-neutral-800 flex gap-2 flex-shrink-0">
          <input
            ref={inputRef}
            type="text"
            enterKeyHint="send"
            value={input}
            onChange={(e) => setInput(e.target.value.slice(0, MAX_LENGTH))}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
                e.preventDefault();
                void send();
              }
            }}
            placeholder="메시지 입력..."
            className="flex-1 min-w-0 bg-neutral-800 border border-neutral-700 rounded-md px-2.5 py-1.5 text-xs text-white placeholder-neutral-600 focus:outline-none focus:border-neutral-500 transition-colors"
          />
          <button
            onClick={() => void send()}
            disabled={!input.trim() || !channelReady}
            className="flex-shrink-0 text-xs bg-white text-black font-medium rounded-md px-2.5 py-1.5 hover:bg-neutral-200 disabled:opacity-40 transition-colors"
          >
            전송
          </button>
        </div>
      )}
    </div>
    </>
  );
}
