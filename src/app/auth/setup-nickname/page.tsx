'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { toast } from 'sonner';

const NICKNAME_REGEX = /^[a-zA-Z0-9가-힣]{2,12}$/;

function SetupNicknameForm() {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get('callbackUrl') ?? '/';
  const { update } = useSession();

  const [nickname, setNickname] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (callbackUrl !== '/') {
      toast('사이트에서 사용하실 닉네임을 설정해주세요.', { id: 'nickname-required' });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      if (res.status === 400) {
        const data = await res.json().catch(() => ({}));
        if (data.error === 'Inappropriate nickname') {
          setError('부적절한 닉네임입니다.');
        } else {
          setError('닉네임 형식이 올바르지 않습니다.');
        }
        return;
      }
      if (!res.ok) {
        setError('오류가 발생했습니다. 다시 시도해주세요.');
        return;
      }

      await update({ nickname });
      toast.success('닉네임이 설정되었습니다!');
      // router.push는 방금 setup-nickname으로 리다이렉트됐던 경로의 클라이언트 라우터 캐시를
      // 재사용해 제자리로 돌아올 수 있어, 미들웨어를 반드시 다시 타는 완전한 새로고침으로 이동
      window.location.href = callbackUrl === '/auth/setup-nickname' ? '/' : callbackUrl;
    } finally {
      setSubmitting(false);
    }
  }

  const validationMessage = () => {
    if (nickname.length === 0) return null;
    if (/[\s!@#$%^&*()\-_=+\[\]{};:'",.<>?/\\|`~]/.test(nickname)) return '공백이나 특수문자를 사용할 수 없습니다.';
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
        <p className="text-xs text-neutral-600 mb-6">CSORA</p>
        <h1 className="text-2xl font-bold text-white mb-1.5">닉네임을 설정해주세요</h1>
        <p className="text-sm text-neutral-500 mb-8">
          랭킹, 대결, 게시판에서 사용될 이름입니다. 나중에 변경할 수 있습니다.
        </p>
        <Suspense>
          <SetupNicknameForm />
        </Suspense>
        <p className="text-xs text-neutral-700 mt-4">2~12자, 영문·숫자·한글만 사용 가능</p>
      </div>
    </div>
  );
}
