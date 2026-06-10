'use client';

import { useState, useEffect } from 'react';
import { useSession, signOut } from 'next-auth/react';
import Link from 'next/link';

const NICKNAME_REGEX = /^[a-zA-Z0-9가-힣]{2,12}$/;

export default function SettingsPage() {
  const { data: session, update } = useSession();
  const [nickname, setNickname] = useState('');
  const [initialNickname, setInitialNickname] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    const current = session?.user?.nickname ?? '';
    setNickname(current);
    setInitialNickname(current);
  }, [session?.user?.nickname]);

  const isChanged = nickname !== initialNickname;
  const isValid = NICKNAME_REGEX.test(nickname);
  const canSave = isChanged && isValid;

  async function handleSave() {
    setStatus('loading');
    setErrorMsg('');

    try {
      const res = await fetch('/api/users/nickname', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nickname }),
      });

      if (res.ok) {
        await update({ nickname });
        setInitialNickname(nickname);
        setStatus('success');
      } else if (res.status === 409) {
        setErrorMsg('이미 사용 중인 닉네임입니다');
        setStatus('error');
      } else {
        setErrorMsg('저장에 실패했습니다');
        setStatus('error');
      }
    } catch {
      setErrorMsg('저장에 실패했습니다');
      setStatus('error');
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="flex items-center gap-4 mb-8">
        <Link
          href="/mypage"
          className="text-neutral-400 hover:text-white text-sm transition-colors"
        >
          ← 마이페이지
        </Link>
        <h1 className="text-xl font-semibold text-white">계정 설정</h1>
      </div>

      <div className="bg-[#111111] border border-neutral-800 rounded-lg p-6 mb-4">
        <h2 className="text-sm font-medium text-white mb-4">닉네임 변경</h2>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-neutral-500 block mb-1.5">닉네임</label>
            <input
              type="text"
              value={nickname}
              onChange={(e) => {
                setNickname(e.target.value);
                setStatus('idle');
                setErrorMsg('');
              }}
              placeholder="2~12자, 영문/숫자/한글"
              className="w-full bg-[#1a1a1a] border border-neutral-800 rounded-md px-3 py-2.5 text-sm text-white placeholder-neutral-600 focus:outline-none focus:border-neutral-600"
            />
            <p className="text-xs text-neutral-600 mt-1">2~12자, 영문/숫자/한글만 사용 가능합니다</p>
          </div>

          {status === 'success' && (
            <p className="text-xs text-green-500">닉네임이 변경되었습니다</p>
          )}
          {status === 'error' && errorMsg && (
            <p className="text-xs text-red-400">{errorMsg}</p>
          )}

          <button
            onClick={handleSave}
            disabled={!canSave || status === 'loading'}
            className="rounded-md bg-white text-black text-sm font-medium px-6 py-2.5 hover:bg-neutral-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {status === 'loading' ? '저장 중...' : '저장'}
          </button>
        </div>
      </div>

      <div className="bg-[#111111] border border-neutral-800 rounded-lg p-6">
        <h2 className="text-sm font-medium text-white mb-4">로그아웃</h2>
        <p className="text-xs text-neutral-500 mb-4">
          로그아웃하면 현재 기기에서 로그인 상태가 해제됩니다
        </p>
        <button
          onClick={() => signOut({ callbackUrl: '/' })}
          className="rounded-md border border-neutral-700 text-sm text-neutral-300 px-5 py-2.5 hover:border-neutral-500 hover:text-white transition-colors"
        >
          로그아웃
        </button>
      </div>
    </div>
  );
}
