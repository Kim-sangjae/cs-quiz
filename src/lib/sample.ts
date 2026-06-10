import type { Question } from '@/types';

export function sample(pool: Question[], n: number): Question[] {
  if (pool.length === 0) return [];

  const arr = [...pool];

  // Fisher-Yates shuffle
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }

  if (pool.length < n) {
    console.error(`[sample] pool size(${pool.length}) < requested(${n}). Returning full pool.`);
    return arr;
  }

  return arr.slice(0, n);
}
