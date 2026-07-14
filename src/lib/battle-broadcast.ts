import { supabaseServer } from './supabase-server';

// PLAYING 상태에서 이 시간 이상 문제가 안 바뀌면(양쪽 이탈 등) 무효 종료 처리
export const STALE_QUESTION_MS = 5 * 60 * 1000;

export async function broadcastBattleUpdate(roomId: string): Promise<void> {
  try {
    const channel = supabaseServer.channel(`battle-room-${roomId}`);
    await channel.send({ type: 'broadcast', event: 'room_updated', payload: {} });
    await supabaseServer.removeChannel(channel);
  } catch { /* ignore */ }
}

// 친구 패널용: 대결 참여자 목록이 바뀔 때(시작/종료) 모든 구독자에게 신호
export async function broadcastBattleStatusChange(): Promise<void> {
  try {
    const channel = supabaseServer.channel('battle-status-updates');
    await channel.send({ type: 'broadcast', event: 'battle_status_changed', payload: {} });
    await supabaseServer.removeChannel(channel);
  } catch { /* ignore */ }
}
