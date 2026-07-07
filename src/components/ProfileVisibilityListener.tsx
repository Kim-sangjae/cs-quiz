'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase-browser';

export default function ProfileVisibilityListener({ userId }: { userId: string }) {
  const router = useRouter();

  useEffect(() => {
    const ch = supabaseBrowser
      .channel(`csora-profile-${userId}`)
      .on('broadcast', { event: 'visibility_changed' }, () => {
        router.refresh();
      })
      .subscribe();

    return () => { void supabaseBrowser.removeChannel(ch); };
  }, [userId, router]);

  return null;
}
