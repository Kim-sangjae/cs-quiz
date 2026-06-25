import { supabaseServer } from './supabase-server';

export async function broadcastBattleUpdate(roomId: string): Promise<void> {
  try {
    const channel = supabaseServer.channel(`battle-room-${roomId}`);
    await channel.send({ type: 'broadcast', event: 'room_updated', payload: {} });
    await supabaseServer.removeChannel(channel);
  } catch { /* ignore */ }
}
