'use client';

import { useState, useEffect, useRef } from 'react';
import { supabaseBrowser } from '@/lib/supabase-browser';
import { loadMessages, appendMessage, ChatMessage } from '@/lib/chat-store';

interface Props {
  myId: string;
  myNickname: string;
  friend: { userId: string; nickname: string };
  onClose: () => void;
}

const MAX_LENGTH = 200;

export default function ChatWindow({ myId, myNickname, friend, onClose }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>(() => loadMessages(myId, friend.userId));
  const [input, setInput] = useState('');
  const [channelReady, setChannelReady] = useState(false);
  const channelRef = useRef<ReturnType<typeof supabaseBrowser.channel> | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const channelName = `csora-chat-${[myId, friend.userId].sort().join('-')}`;

  useEffect(() => {
    const ch = supabaseBrowser
      .channel(channelName)
      .on('broadcast', { event: 'message' }, ({ payload }: { payload: ChatMessage }) => {
        if (payload.senderId === myId) return;
        appendMessage(myId, friend.userId, payload);
        setMessages(loadMessages(myId, friend.userId));
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') setChannelReady(true);
      });
    channelRef.current = ch;
    return () => { void supabaseBrowser.removeChannel(ch); };
  }, [channelName, myId, friend.userId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'instant' });
  }, [friend.userId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  useEffect(() => {
    inputRef.current?.focus();
  }, [friend.userId]);

  async function send() {
    const text = input.trim();
    if (!text || !channelReady) return;
    const msg: ChatMessage = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      senderId: myId,
      senderNickname: myNickname,
      content: text,
      sentAt: Date.now(),
    };
    setInput('');
    appendMessage(myId, friend.userId, msg);
    setMessages(loadMessages(myId, friend.userId));
    await channelRef.current?.send({ type: 'broadcast', event: 'message', payload: msg });
  }

  return (
    <div
      className="fixed right-4 z-[49] flex flex-col bg-[#0f0f0f] border border-neutral-800 rounded-xl shadow-2xl w-72 max-w-[calc(100vw-2rem)]"
      style={{ bottom: 'max(10.5rem, calc(env(safe-area-inset-bottom, 0px) + 10.5rem))', height: '340px' }}
    >
      {/* 헤더 */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-neutral-800 flex-shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-6 h-6 rounded-full bg-neutral-800 border border-neutral-700 flex items-center justify-center text-[10px] font-bold text-neutral-400 flex-shrink-0">
            {friend.nickname[0]?.toUpperCase() ?? '?'}
          </div>
          <span className="text-xs font-medium text-white truncate">{friend.nickname}</span>
          {!channelReady && (
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
        {messages.length === 0 ? (
          <p className="text-[11px] text-neutral-600 text-center pt-6">대화를 시작해보세요</p>
        ) : (
          messages.map((m) => {
            const isMe = m.senderId === myId;
            return (
              <div key={m.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] px-2.5 py-1.5 rounded-lg text-xs leading-relaxed break-words ${
                  isMe
                    ? 'bg-white text-black'
                    : 'bg-neutral-800 text-neutral-200'
                }`}>
                  {m.content}
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* 입력창 */}
      <div className="px-2.5 py-2 border-t border-neutral-800 flex gap-2 flex-shrink-0">
        <input
          ref={inputRef}
          type="text"
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
    </div>
  );
}
