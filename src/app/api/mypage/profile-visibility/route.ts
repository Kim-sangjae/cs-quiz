import { NextRequest, NextResponse } from 'next/server';
import { getServerUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { supabaseServer } from '@/lib/supabase-server';

export async function GET() {
  const user = await getServerUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const userData = await prisma.user.findUnique({
    where: { id: user.id },
    select: { profileVisibility: true, bio: true },
  });

  return NextResponse.json({ visibility: userData?.profileVisibility ?? 'PUBLIC', bio: userData?.bio ?? null });
}

export async function PATCH(req: NextRequest) {
  const user = await getServerUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { visibility } = await req.json() as { visibility?: string };
  if (!['PUBLIC', 'FRIENDS_ONLY', 'PRIVATE'].includes(visibility ?? '')) {
    return NextResponse.json({ error: 'Invalid visibility' }, { status: 400 });
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { profileVisibility: visibility as 'PUBLIC' | 'FRIENDS_ONLY' | 'PRIVATE' },
  });

  // 공개 프로필 페이지 실시간 갱신 신호
  try {
    const ch = supabaseServer.channel(`csora-profile-${user.id}`);
    await ch.send({ type: 'broadcast', event: 'visibility_changed', payload: {} });
    void supabaseServer.removeChannel(ch);
  } catch { /* ignore */ }

  return NextResponse.json({ ok: true });
}
