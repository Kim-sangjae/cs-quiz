const PREFIX = 'csora_chat_';
const MAX = 300;

export interface ChatMessage {
  id: string;
  senderId: string;
  senderNickname: string;
  content: string;
  sentAt: number;
}

function storageKey(a: string, b: string) {
  return PREFIX + [a, b].sort().join('_');
}

export function loadMessages(a: string, b: string): ChatMessage[] {
  try {
    const raw = localStorage.getItem(storageKey(a, b));
    return raw ? (JSON.parse(raw) as ChatMessage[]) : [];
  } catch { return []; }
}

export function appendMessage(a: string, b: string, msg: ChatMessage): void {
  const msgs = loadMessages(a, b);
  msgs.push(msg);
  if (msgs.length > MAX) msgs.splice(0, msgs.length - MAX);
  try {
    localStorage.setItem(storageKey(a, b), JSON.stringify(msgs));
  } catch { /* quota exceeded — ignore */ }
}

export function clearAllChats(): void {
  const keys: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k?.startsWith(PREFIX)) keys.push(k);
  }
  keys.forEach((k) => localStorage.removeItem(k));
}
