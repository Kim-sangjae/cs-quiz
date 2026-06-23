'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

interface LikeButtonProps {
  questionId: string;
  initialLiked: boolean;
  initialCount: number;
  isLoggedIn: boolean;
}

export default function LikeButton({
  questionId,
  initialLiked,
  initialCount,
  isLoggedIn,
}: LikeButtonProps) {
  const [liked, setLiked] = useState(initialLiked);
  const [count, setCount] = useState(initialCount);
  const queryClient = useQueryClient();
  const router = useRouter();

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/questions/${questionId}/like`, { method: 'POST' });
      if (!res.ok) throw new Error('Failed');
      return res.json() as Promise<{ liked: boolean; likeCount: number }>;
    },
    onMutate: () => {
      const prevLiked = liked;
      const prevCount = count;
      setLiked((v) => !v);
      setCount((v) => (liked ? v - 1 : v + 1));
      return { prevLiked, prevCount };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx) {
        setLiked(ctx.prevLiked);
        setCount(ctx.prevCount);
      }
    },
    onSuccess: (data) => {
      setLiked(data.liked);
      setCount(data.likeCount);
      queryClient.invalidateQueries({ queryKey: ['question', questionId] });
    },
  });

  function handleClick() {
    if (!isLoggedIn) {
      router.push(`/auth/login?callbackUrl=${encodeURIComponent(window.location.href)}`);
      return;
    }
    mutation.mutate();
  }

  return (
    <button
      onClick={handleClick}
      disabled={mutation.isPending}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-sm transition-colors ${
        liked
          ? 'border-yellow-500/50 bg-yellow-500/10 text-yellow-400'
          : 'border-neutral-800 bg-[#1a1a1a] text-neutral-400 hover:border-neutral-600 hover:text-white'
      } disabled:opacity-50 disabled:cursor-not-allowed`}
    >
      <svg
        width={16}
        height={16}
        viewBox="0 0 24 24"
        fill={liked ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth={1.5}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0z"
        />
      </svg>
      <span>북마크 {count > 0 && count}</span>
    </button>
  );
}
