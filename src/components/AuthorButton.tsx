'use client';

import { useState } from 'react';
import UserProfileModal from './UserProfileModal';

interface AuthorButtonProps {
  authorId: string;
  authorNickname: string;
  className?: string;
}

export default function AuthorButton({ authorId, authorNickname, className }: AuthorButtonProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  return (
    <>
      <div className="relative inline-block">
        <button
          onClick={() => setMenuOpen((v) => !v)}
          className={className ?? 'text-xs text-neutral-500 hover:text-neutral-300 transition-colors'}
        >
          {authorNickname}
        </button>
        {menuOpen && (
          <div className="absolute left-0 top-full mt-1 z-20 bg-[#1a1a1a] border border-neutral-700 rounded-lg shadow-xl overflow-hidden min-w-[148px]">
            <button
              onClick={() => { setMenuOpen(false); setProfileOpen(true); }}
              className="w-full text-left px-3 py-2 text-xs text-neutral-300 hover:bg-neutral-800 transition-colors"
            >
              프로필 보기
            </button>
            <a
              href={`/board?author=${encodeURIComponent(authorNickname)}`}
              onClick={() => setMenuOpen(false)}
              className="block w-full text-left px-3 py-2 text-xs text-neutral-300 hover:bg-neutral-800 transition-colors"
            >
              출제 문제 보러가기
            </a>
          </div>
        )}
      </div>
      {profileOpen && (
        <UserProfileModal
          userId={authorId}
          nickname={authorNickname}
          onClose={() => setProfileOpen(false)}
        />
      )}
    </>
  );
}
