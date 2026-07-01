'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { BADGE_META } from '@/lib/badges';
import type { BadgeType } from '@/lib/badges';

interface OnlineUser {
  id: string;
  nickname: string;
  isFriend: boolean;
  isSelf: boolean;
}

interface UserProfile {
  nickname: string;
  level: number;
  totalAttempts: number;
  accuracy: number;
  battleWins: number;
  battleTies: number;
  battleLosses: number;
  battleTotal: number;
  isOnline: boolean;
  badges: string[];
}

function battleRecord(p: UserProfile): string {
  if (p.battleTotal === 0) return '-';
  const parts = [`${p.battleWins}승`];
  if (p.battleTies > 0) parts.push(`${p.battleTies}무`);
  parts.push(`${p.battleLosses}패`);
  return parts.join(' ');
}

const USER_REPORT_REASONS = [
  { value: 'INAPPROPRIATE_NICKNAME', label: '부적절한 닉네임' },
  { value: 'OTHER', label: '기타' },
] as const;
type ReportReason = typeof USER_REPORT_REASONS[number]['value'];

function ProfileModal({
  user,
  profile,
  loading,
  friendRequested,
  addingFriend,
  onClose,
  onAddFriend,
}: {
  user: OnlineUser;
  profile: UserProfile | null;
  loading: boolean;
  friendRequested: boolean;
  addingFriend: boolean;
  onClose: () => void;
  onAddFriend: () => void;
}) {
  const [hoveredBadge, setHoveredBadge] = useState<string | null>(null);
  const [badgeTooltipPos, setBadgeTooltipPos] = useState<{ x: number; y: number } | null>(null);
  const [reporting, setReporting] = useState(false);
  const [reportReason, setReportReason] = useState<ReportReason>('INAPPROPRIATE_NICKNAME');
  const [reportDesc, setReportDesc] = useState('');
  const [reportDone, setReportDone] = useState(false);
  const [reportLoading, setReportLoading] = useState(false);

  async function handleReport() {
    if (reportLoading) return;
    setReportLoading(true);
    try {
      const res = await fetch(`/api/users/${user.id}/report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: reportReason, description: reportDesc || undefined }),
      });
      if (res.ok || res.status === 409) setReportDone(true);
    } catch {}
    setReportLoading(false);
  }

  return (
    <div className="fixed inset-0 z-[202] flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px]" />
      <div
        className="relative w-full max-w-xs bg-[#111111] border border-neutral-800 rounded-2xl overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 닫기 */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 p-1.5 rounded text-neutral-600 hover:text-white hover:bg-neutral-800 transition-colors"
        >
          <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>

        {/* 아바타 + 닉네임 */}
        <div className="flex flex-col items-center pt-8 pb-5 px-5">
          <div className="relative mb-3">
            <div className="w-16 h-16 rounded-full bg-neutral-800 border border-neutral-700 flex items-center justify-center">
              <span className="text-xl font-semibold text-neutral-300">
                {(user.nickname[0] ?? '?').toUpperCase()}
              </span>
            </div>
            <span className="absolute bottom-0.5 right-0.5 w-3.5 h-3.5 rounded-full border-2 border-[#111111] bg-emerald-500" />
          </div>
          <div className="flex items-center gap-1.5">
            <p className="text-base font-semibold text-white">{user.nickname}</p>
            {!user.isSelf && (
              <button
                onClick={() => { setReporting(true); setReportDone(false); }}
                className="p-1 rounded text-neutral-500 hover:text-red-400 transition-colors"
                title="신고"
              >
                <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2v2"/><path d="M4.93 4.93l1.41 1.41"/><path d="M19.07 4.93l-1.41 1.41"/>
                  <path d="M8 11a4 4 0 018 0v3H8v-3z"/><path d="M5 15h14"/><path d="M9 19a3 3 0 006 0"/>
                </svg>
              </button>
            )}
          </div>
          <div className="flex items-center gap-2 mt-1">
            {loading ? (
              <div className="h-4 w-20 bg-neutral-800 rounded animate-pulse" />
            ) : profile ? (
              <>
                <span className="text-xs text-neutral-500">Lv.{profile.level}</span>
                {(user.isSelf || user.isFriend) && (
                  <>
                    <span className="text-neutral-700">·</span>
                    <span className="text-xs text-emerald-400">{user.isSelf ? '나' : '친구'}</span>
                  </>
                )}
                <span className="text-neutral-700">·</span>
                <span className="text-xs text-emerald-500">접속 중</span>
              </>
            ) : null}
          </div>
        </div>

        {/* 스탯 */}
        <div className="border-t border-neutral-800 px-5 py-4">
          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-4 bg-neutral-800 rounded animate-pulse" />
              ))}
            </div>
          ) : profile ? (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs text-neutral-500">정답률</span>
                <span className="text-sm font-medium text-neutral-200">
                  {profile.totalAttempts > 0 ? `${(profile.accuracy * 100).toFixed(1)}%` : '-'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-neutral-500">총 시도</span>
                <span className="text-sm font-medium text-neutral-200">
                  {profile.totalAttempts > 0 ? `${profile.totalAttempts.toLocaleString()}문제` : '-'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-neutral-500">대전 전적</span>
                <span className="text-sm font-medium text-neutral-200">{battleRecord(profile)}</span>
              </div>
            </div>
          ) : (
            <p className="text-xs text-neutral-600 text-center py-2">프로필을 불러올 수 없습니다</p>
          )}
        </div>

        {/* 업적 */}
        {profile && profile.badges.length > 0 && (
          <div className="border-t border-neutral-800 px-5 py-3.5">
            <p className="text-[10px] text-neutral-500 mb-2">달성한 업적</p>
            <div className="flex flex-wrap gap-1.5">
              {profile.badges.map((badge) => {
                const meta = BADGE_META[badge as BadgeType];
                if (!meta) return null;
                return (
                  <span
                    key={badge}
                    className="text-lg cursor-default select-none"
                    onMouseEnter={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      setBadgeTooltipPos({ x: rect.left + rect.width / 2, y: rect.top });
                      setHoveredBadge(badge);
                    }}
                    onMouseLeave={() => {
                      setHoveredBadge(null);
                      setBadgeTooltipPos(null);
                    }}
                  >
                    {meta.icon}
                  </span>
                );
              })}
            </div>
          </div>
        )}

        {/* 친구 추가 버튼 */}
        {!user.isSelf && !user.isFriend && (
          <div className="border-t border-neutral-800 px-4 py-3">
            {friendRequested ? (
              <p className="text-xs text-emerald-400 text-center py-1">친구 요청을 보냈습니다 ✓</p>
            ) : (
              <button
                onClick={onAddFriend}
                disabled={addingFriend || loading || !profile}
                className="w-full rounded-lg bg-white text-black text-xs font-semibold py-2.5 hover:bg-neutral-200 disabled:opacity-50 transition-colors"
              >
                {addingFriend ? '요청 중...' : '친구 추가'}
              </button>
            )}
          </div>
        )}

        {/* 신고 오버레이 */}
        {!user.isSelf && reporting && (
          <div className="absolute inset-0 bg-[#111111]/95 rounded-2xl flex flex-col justify-center px-5 py-6 z-10">
            {reportDone ? (
              <div className="flex flex-col items-center gap-3 text-center">
                <svg width={28} height={28} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="text-emerald-400">
                  <path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><path d="M22 4L12 14.01l-3-3"/>
                </svg>
                <p className="text-sm text-neutral-300">신고가 접수되었습니다.</p>
                <button
                  onClick={() => { setReporting(false); setReportDesc(''); setReportReason('INAPPROPRIATE_NICKNAME'); }}
                  className="mt-1 text-xs text-neutral-500 hover:text-white underline"
                >
                  닫기
                </button>
              </div>
            ) : (
              <>
                <p className="text-sm font-medium text-white mb-4">{user.nickname} 신고</p>
                <div className="space-y-2 mb-4">
                  {USER_REPORT_REASONS.map((r) => (
                    <label key={r.value} className="flex items-center gap-2.5 cursor-pointer group">
                      <input
                        type="radio"
                        name="reportReason"
                        value={r.value}
                        checked={reportReason === r.value}
                        onChange={() => setReportReason(r.value)}
                        className="accent-red-500"
                      />
                      <span className="text-sm text-neutral-300 group-hover:text-white">{r.label}</span>
                    </label>
                  ))}
                </div>
                <textarea
                  value={reportDesc}
                  onChange={(e) => setReportDesc(e.target.value)}
                  placeholder="추가 설명 (선택)"
                  maxLength={200}
                  rows={3}
                  className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-xs text-neutral-200 placeholder-neutral-600 resize-none focus:outline-none focus:border-neutral-500 mb-4"
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleReport}
                    disabled={reportLoading}
                    className="flex-1 rounded-lg bg-red-600 text-white text-xs font-semibold py-2.5 hover:bg-red-500 disabled:opacity-50 transition-colors"
                  >
                    {reportLoading ? '제출 중...' : '신고'}
                  </button>
                  <button
                    onClick={() => { setReporting(false); setReportDesc(''); setReportReason('INAPPROPRIATE_NICKNAME'); }}
                    className="flex-1 rounded-lg bg-neutral-800 text-neutral-300 text-xs font-semibold py-2.5 hover:bg-neutral-700 transition-colors"
                  >
                    취소
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* 배지 말풍선 툴팁 */}
        {hoveredBadge && badgeTooltipPos && BADGE_META[hoveredBadge as BadgeType] && (
          <div
            className="fixed z-[9999] pointer-events-none"
            style={{
              left: badgeTooltipPos.x,
              top: badgeTooltipPos.y - 8,
              transform: 'translate(-50%, -100%)',
            }}
          >
            <div className="w-48 bg-neutral-900 border border-neutral-700 rounded-xl px-3 py-2.5 shadow-2xl">
              <p className="text-[11px] font-semibold text-white leading-tight whitespace-normal">
                {BADGE_META[hoveredBadge as BadgeType].icon} {BADGE_META[hoveredBadge as BadgeType].label}
              </p>
              <p className="text-[10px] text-neutral-400 mt-1 leading-snug whitespace-normal">
                {BADGE_META[hoveredBadge as BadgeType].description}
              </p>
            </div>
            <div className="flex justify-center">
              <div className="w-2.5 h-2.5 bg-neutral-900 border-r border-b border-neutral-700 rotate-45 -mt-1.5" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function OnlineCountBadge() {
  const { status } = useSession();
  const router = useRouter();
  const [count, setCount] = useState<number | null>(null);
  const [showPanel, setShowPanel] = useState(false);
  const [users, setUsers] = useState<OnlineUser[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [selectedUser, setSelectedUser] = useState<OnlineUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [friendRequested, setFriendRequested] = useState(false);
  const [addingFriend, setAddingFriend] = useState(false);

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

  const openPanel = useCallback(async () => {
    if (status !== 'authenticated') { router.push('/auth/login'); return; }
    setShowPanel(true);
    setUsersLoading(true);
    try {
      const res = await fetch('/api/stats/online-users');
      if (res.ok) {
        const data = await res.json() as { users: OnlineUser[]; totalCount: number };
        setUsers(data.users);
        setCount(data.totalCount);
      }
    } catch {}
    setUsersLoading(false);
  }, [status, router]);

  const selectUser = useCallback(async (user: OnlineUser) => {
    setSelectedUser(user);
    setProfile(null);
    setFriendRequested(false);
    setProfileLoading(true);
    try {
      const res = await fetch(`/api/users/${user.id}/profile`);
      if (res.ok) setProfile(await res.json() as UserProfile);
    } catch {}
    setProfileLoading(false);
  }, []);

  const addFriend = useCallback(async () => {
    if (!selectedUser || addingFriend) return;
    setAddingFriend(true);
    try {
      const res = await fetch('/api/friends', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nickname: selectedUser.nickname }),
      });
      if (res.ok) setFriendRequested(true);
    } catch {}
    setAddingFriend(false);
  }, [selectedUser, addingFriend]);

  const closePanel = useCallback(() => {
    setShowPanel(false);
    setSelectedUser(null);
    setProfile(null);
  }, []);

  if (count === null || count === 0) return null;

  return (
    <>
      <button
        onClick={openPanel}
        className="inline-flex items-center gap-1.5 text-xs text-neutral-400 border border-neutral-800 rounded-full px-3 py-1 hover:text-neutral-200 hover:border-neutral-600 transition-colors cursor-pointer"
      >
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
        현재 {count}명 접속 중
      </button>

      {/* 배경 오버레이 (슬라이드 패널용) */}
      <div
        className={`fixed inset-0 z-[200] transition-opacity duration-200 ${showPanel && !selectedUser ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
        style={{ background: 'rgba(0,0,0,0.55)' }}
        onClick={closePanel}
      />

      {/* 접속자 목록 슬라이드 패널 */}
      <div
        className={`fixed top-0 right-0 h-full z-[201] w-72 bg-[#111111] border-l border-neutral-800 shadow-2xl flex flex-col transition-transform duration-200 ${showPanel ? 'translate-x-0' : 'translate-x-full'}`}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-800 flex-shrink-0">
          <p className="text-sm font-semibold text-white">접속 중 ({count}명)</p>
          <button onClick={closePanel} className="p-1 rounded text-neutral-600 hover:text-white hover:bg-neutral-800 transition-colors">
            <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {usersLoading ? (
            <div className="space-y-px pt-1">
              {[1, 2, 3].map((i) => <div key={i} className="h-14 bg-neutral-800/40 animate-pulse" />)}
            </div>
          ) : users.length === 0 ? (
            <p className="text-xs text-neutral-600 py-8 text-center">접속자 없음</p>
          ) : (
            <ul>
              {users.map((u) => (
                <li key={u.id}>
                  <button
                    onClick={() => selectUser(u)}
                    className="w-full flex items-center gap-2.5 px-3.5 py-2.5 hover:bg-neutral-800/60 transition-colors text-left border-b border-neutral-800/40 last:border-0"
                  >
                    <div className="relative flex-shrink-0">
                      <div className="w-8 h-8 rounded-full bg-neutral-800 border border-neutral-700 flex items-center justify-center">
                        <span className="text-xs font-medium text-neutral-400">
                          {(u.nickname[0] ?? '?').toUpperCase()}
                        </span>
                      </div>
                      <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-[#111111]" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-neutral-200 truncate">{u.nickname}</p>
                      <p className="text-[10px] text-emerald-500">접속 중</p>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {u.isSelf && (
                        <span className="text-[10px] text-neutral-500 border border-neutral-700 rounded-full px-1.5 py-0.5">나</span>
                      )}
                      {u.isFriend && !u.isSelf && (
                        <span className="text-[10px] text-emerald-400 border border-emerald-500/30 rounded-full px-1.5 py-0.5">친구</span>
                      )}
                      <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="text-neutral-700"><path d="M9 18l6-6-6-6" /></svg>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* 프로필 모달 (목록 위에 별도 창) */}
      {selectedUser && (
        <ProfileModal
          user={selectedUser}
          profile={profile}
          loading={profileLoading}
          friendRequested={friendRequested}
          addingFriend={addingFriend}
          onClose={() => { setSelectedUser(null); setProfile(null); }}
          onAddFriend={addFriend}
        />
      )}
    </>
  );
}
