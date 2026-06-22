'use client';

import { useEffect, useState } from 'react';

export default function OnlineCountBadge() {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchCount() {
      try {
        const res = await fetch('/api/stats/online');
        if (!res.ok) return;
        const data = await res.json() as { count: number };
        if (!cancelled) setCount(data.count);
      } catch {}
    }

    fetchCount();
    const id = setInterval(fetchCount, 30_000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  if (count === null || count === 0) return null;

  return (
    <div className="inline-flex items-center gap-1.5 text-xs text-neutral-500 border border-neutral-800 rounded-full px-3 py-1">
      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
      현재 {count}명 접속 중
    </div>
  );
}
