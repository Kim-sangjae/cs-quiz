import { supabaseServer } from './supabase-server';

export async function broadcastToUser(userId: string, event: string, payload: Record<string, unknown>) {
  const channel = supabaseServer.channel(`user:${userId}`);
  await channel.send({ type: 'broadcast', event, payload });
  await supabaseServer.removeChannel(channel);
}
