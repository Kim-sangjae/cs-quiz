'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { signIn } from 'next-auth/react';
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
      signIn('google');
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
          ? 'border-red-500/50 bg-red-500/10 text-red-400'
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
          d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z"
        />
      </svg>
      <span>{count}</span>
    </button>
  );
}
