'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

const NICKNAME_REGEX = /^[a-zA-Z0-9가-힣]{2,12}$/;

function SetupNicknameForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get('callbackUrl') ?? '/';

  const [nickname, setNickname] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const isValid = NICKNAME_REGEX.test(nickname);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isValid || submitting) return;

    setSubmitting(true);
    setError('');

    try {
      const res = await fetch('/api/users/nickname', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nickname }),
      });

      if (res.status === 409) {
        setError('이미 사용 중인 닉네임입니다.');
        return;
      }
      if (!res.ok) {
        setError('오류가 발생했습니다. 다시 시도해주세요.');
        return;
      }

      router.push(callbackUrl);
    } finally {
      setSubmitting(false);
    }
  }

  const validationMessage = () => {
    if (nickname.length === 0) return null;
    if (nickname.length < 2) return '2자 이상 입력하세요.';
    if (nickname.length > 12) return '12자 이하로 입력하세요.';
    if (!NICKNAME_REGEX.test(nickname)) return '영문, 숫자, 한글만 사용할 수 있습니다.';
    return null;
  };

  const hint = validationMessage();

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <input
          type="text"
          value={nickname}
          onChange={(e) => {
            setNickname(e.target.value);
            setError('');
          }}
          placeholder="닉네임 입력"
          maxLength={12}
          className="w-full rounded-md border border-neutral-800 bg-[#1a1a1a] px-4 py-3 text-sm text-white placeholder-neutral-500 focus:border-neutral-600 focus:outline-none transition-colors"
        />
        {hint && (
          <p className="mt-1.5 text-xs text-neutral-500">{hint}</p>
        )}
        {error && (
          <p className="mt-1.5 text-xs text-red-400">{error}</p>
        )}
      </div>

      <button
        type="submit"
        disabled={!isValid || submitting}
        className="w-full rounded-md bg-white text-black text-sm font-medium px-6 py-2.5 hover:bg-neutral-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        {submitting ? '저장 중...' : '저장'}
      </button>
    </form>
  );
}

export default function SetupNicknamePage() {
  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-semibold text-white mb-2">닉네임 설정</h1>
        <p className="text-sm text-neutral-400 mb-8">
          2~12자, 영문·숫자·한글만 허용됩니다.
        </p>
        <Suspense>
          <SetupNicknameForm />
        </Suspense>
      </div>
    </div>
  );
}
