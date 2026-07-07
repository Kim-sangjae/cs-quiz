'use client';

import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { BADGE_META } from '@/lib/badges';
import type { BadgeType } from '@/lib/badges';
import { supabaseBrowser } from '@/lib/supabase-browser';

const CATEGORIES = [
  { key: 'all', label: '전체' },
  { key: 'ds', label: '자료구조' },
  { key: 'algo', label: '알고리즘' },
  { key: 'os', label: '운영체제' },
  { key: 'network', label: '네트워크' },
  { key: 'db', label: '데이터베이스' },
  { key: 'arch', label: '컴퓨터 구조' },
  { key: 'se', label: '소프트웨어공학' },
] as const;

interface ProfileData {
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
  profileVisibility: string;
  maskedEmail: string | null;
  approvedCount: number;
  bio: string | null;
}

const USER_REPORT_REASONS = [
  { value: 'INAPPROPRIATE_NICKNAME', label: '부적절한 닉네임' },
  { value: 'OTHER', label: '기타' },
] as const;
type ReportReason = typeof USER_REPORT_REASONS[number]['value'];

interface FriendActions {
  battleStatus: 'WAITING' | 'PLAYING' | null;
  isPlayingQuiz?: boolean;
  onBattle: (category: string) => void;
  onRemove: () => void;
}

interface UserProfileModalProps {
  userId: string;
  nickname: string;
  isOnline?: boolean;
  isFriend?: boolean;
  isSelf?: boolean;
  showActions?: boolean;
  onClose: () => void;
  onAddFriend?: () => Promise<void>;
  friendActions?: FriendActions;
}

export default function UserProfileModal({
  userId,
  nickname,
  isOnline,
  isFriend,
  isSelf,
  showActions = false,
  onClose,
  onAddFriend,
  friendActions,
}: UserProfileModalProps) {
  const queryClient = useQueryClient();
  const [friendRequested, setFriendRequested] = useState(false);
  const [addingFriend, setAddingFriend] = useState(false);
  const [hoveredBadge, setHoveredBadge] = useState<string | null>(null);
  const [badgeTooltipPos, setBadgeTooltipPos] = useState<{ x: number; y: number } | null>(null);
  const [reporting, setReporting] = useState(false);
  const [reportReason, setReportReason] = useState<ReportReason>('INAPPROPRIATE_NICKNAME');
  const [reportDesc, setReportDesc] = useState('');
  const [reportDone, setReportDone] = useState(false);
  const [reportLoading, setReportLoading] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [battleStep, setBattleStep] = useState(false);
  const [battleCategory, setBattleCategory] = useState('ds');

  const { data: profile, isLoading } = useQuery<ProfileData>({
    queryKey: ['user-profile', userId],
    queryFn: async () => {
      const r = await fetch(`/api/users/${userId}/profile`);
      if (!r.ok) throw new Error('fetch failed');
      return r.json() as Promise<ProfileData>;
    },
    staleTime: 0,
    retry: false,
  });

  // visibility 변경 실시간 반영
  useEffect(() => {
    const ch = supabaseBrowser
      .channel(`csora-profile-modal-${userId}`)
      .on('broadcast', { event: 'visibility_changed' }, () => {
        void queryClient.invalidateQueries({ queryKey: ['user-profile', userId] });
      })
      .subscribe();
    return () => { void supabaseBrowser.removeChannel(ch); };
  }, [userId, queryClient]);

  async function handleReport() {
    if (reportLoading) return;
    setReportLoading(true);
    try {
      const res = await fetch(`/api/users/${userId}/report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: reportReason, description: reportDesc || undefined }),
      });
      if (res.ok || res.status === 409) setReportDone(true);
    } catch {}
    setReportLoading(false);
  }

  const online = isOnline ?? profile?.isOnline ?? false;
  const visibility = profile?.profileVisibility ?? 'PUBLIC';
  const canShowActions = showActions && !isSelf;
  const hasFriendActions = !!friendActions;

  return (
    <div className="fixed inset-0 z-[202] flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px]" />
      <div
        className="relative w-full max-w-xs bg-[#111111] border border-neutral-800 rounded-2xl overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-3 right-3 p-1.5 rounded text-neutral-600 hover:text-white hover:bg-neutral-800 transition-colors z-10"
        >
          <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>

        {/* 대전 신청 카테고리 선택 step */}
        {battleStep && friendActions && (
          <>
            <div className="px-5 pt-6 pb-4">
              <button onClick={() => setBattleStep(false)} className="text-xs text-neutral-500 hover:text-neutral-300 mb-4 flex items-center gap-1">
                <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M15 18l-6-6 6-6" /></svg>
                뒤로
              </button>
              <p className="text-sm font-medium text-white mb-1">{nickname}에게 대전 신청</p>
              <p className="text-xs text-neutral-500 mb-4">카테고리를 선택하세요</p>
              <div className="grid grid-cols-2 gap-2">
                {CATEGORIES.map((c) => (
                  <button
                    key={c.key}
                    onClick={() => setBattleCategory(c.key)}
                    className={`text-xs px-3 py-2 rounded-lg border transition-colors ${
                      battleCategory === c.key
                        ? 'border-neutral-400 text-white bg-neutral-800'
                        : 'border-neutral-800 text-neutral-500 hover:border-neutral-600 hover:text-neutral-300'
                    }`}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="border-t border-neutral-800 px-4 py-3">
              <button
                onClick={() => { friendActions.onBattle(battleCategory); onClose(); }}
                className="w-full rounded-lg bg-white text-black text-xs font-semibold py-2.5 hover:bg-neutral-200 transition-colors"
              >
                신청하기
              </button>
            </div>
          </>
        )}

        {!battleStep && (
          <>
            {/* 아바타 + 닉네임 */}
            <div className="flex flex-col items-center pt-8 pb-5 px-5">
              <div className="relative mb-3">
                <div className="w-16 h-16 rounded-full bg-neutral-800 border border-neutral-700 flex items-center justify-center">
                  <span className="text-xl font-semibold text-neutral-300">
                    {(nickname[0] ?? '?').toUpperCase()}
                  </span>
                </div>
                {online && (
                  <span className="absolute bottom-0.5 right-0.5 w-3.5 h-3.5 rounded-full border-2 border-[#111111] bg-emerald-500" />
                )}
              </div>
              <div className="flex items-center gap-1.5">
                <p className="text-base font-semibold text-white">{nickname}</p>
                {canShowActions && (
                  <button
                    onClick={() => { setReporting(true); setReportDone(false); }}
                    className="p-1 rounded text-neutral-500 hover:text-red-400 transition-colors"
                    title="신고"
                  >
                    <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 2v2" />
                      <path d="M5.636 4.636l1.414 1.414" />
                      <path d="M16.95 6.05l1.414-1.414" />
                      <path d="M2 12h2" />
                      <path d="M20 12h2" />
                      <path d="M9 12a3 3 0 1 0 6 0 3 3 0 0 0-6 0z" />
                      <rect x="6" y="15" width="12" height="3" rx="1" />
                    </svg>
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2 mt-1 flex-wrap justify-center">
                {isLoading ? (
                  <div className="h-4 w-20 bg-neutral-800 rounded animate-pulse" />
                ) : profile ? (
                  <>
                    <span className="text-xs text-neutral-500">Lv.{profile.level}</span>
                    {profile.maskedEmail && (
                      <>
                        <span className="text-neutral-700">·</span>
                        <span className="text-xs text-neutral-600">{profile.maskedEmail}</span>
                      </>
                    )}
                    {(isSelf || isFriend) && (
                      <>
                        <span className="text-neutral-700">·</span>
                        <span className="text-xs text-emerald-400">{isSelf ? '나' : '친구'}</span>
                      </>
                    )}
                    {online && (
                      <>
                        <span className="text-neutral-700">·</span>
                        <span className="text-xs text-emerald-500">접속 중</span>
                      </>
                    )}
                  </>
                ) : null}
              </div>
              {profile?.bio && (
                <p className="mt-2 text-xs text-neutral-500 text-center italic">&ldquo;{profile.bio}&rdquo;</p>
              )}
            </div>

            {/* 스탯 */}
            <div className="border-t border-neutral-800 px-5 py-4">
              {isLoading ? (
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
                  {profile.battleTotal > 0 && (
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-neutral-500">대전 전적</span>
                      <span className="text-sm font-medium text-neutral-200">
                        {profile.battleWins}승 {profile.battleTies > 0 ? `${profile.battleTies}무 ` : ''}{profile.battleLosses}패
                      </span>
                    </div>
                  )}
                  {profile.approvedCount > 0 && (
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-neutral-500">출제한 문제</span>
                      <a
                        href={`/board?author=${encodeURIComponent(nickname)}`}
                        className="text-sm font-medium text-neutral-200 hover:text-white underline underline-offset-2 decoration-neutral-600"
                      >
                        {profile.approvedCount}개 →
                      </a>
                    </div>
                  )}
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
                        onMouseLeave={() => { setHoveredBadge(null); setBadgeTooltipPos(null); }}
                      >
                        {meta.icon}
                      </span>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 공개 프로필 링크 */}
            {!isLoading && visibility !== 'PRIVATE' && (
              <div className="border-t border-neutral-800 px-4 py-3">
                <a
                  href={`/u/${encodeURIComponent(nickname)}`}
                  className="block w-full text-center text-xs text-neutral-400 hover:text-white border border-neutral-800 hover:border-neutral-600 rounded-lg py-2 transition-colors"
                >
                  프로필 상세보기 →
                </a>
              </div>
            )}

            {/* FriendActions - 대전/삭제 */}
            {hasFriendActions && !confirmRemove && (
              <div className="border-t border-neutral-800 px-4 py-3 flex gap-2">
                {friendActions.battleStatus === 'PLAYING' && (
                  <div className="flex-1 rounded-lg bg-red-500/10 border border-red-500/30 px-3 py-2.5 text-center">
                    <p className="text-xs text-red-400 font-medium">⚔ 대결 진행 중</p>
                  </div>
                )}
                {friendActions.battleStatus === 'WAITING' && (
                  <div className="flex-1 rounded-lg bg-amber-500/10 border border-amber-500/30 px-3 py-2.5 text-center">
                    <p className="text-xs text-amber-400 font-medium">⏳ 대결 준비 중</p>
                  </div>
                )}
                {!friendActions.battleStatus && friendActions.isPlayingQuiz && (
                  <div className="flex-1 rounded-lg bg-blue-500/10 border border-blue-500/30 px-3 py-2.5 text-center">
                    <p className="text-xs text-blue-400 font-medium">📝 퀴즈 풀이 중</p>
                  </div>
                )}
                {!friendActions.battleStatus && !friendActions.isPlayingQuiz && online && (
                  <button
                    onClick={() => setBattleStep(true)}
                    className="flex-1 rounded-lg bg-white text-black text-xs font-semibold py-2.5 hover:bg-neutral-200 transition-colors"
                  >
                    대전 신청
                  </button>
                )}
                <button
                  onClick={() => setConfirmRemove(true)}
                  className={`${(!friendActions.battleStatus && !friendActions.isPlayingQuiz && online) ? '' : 'flex-1'} rounded-lg border border-neutral-800 text-xs text-neutral-500 py-2.5 px-3 hover:border-red-900 hover:text-red-400 transition-colors`}
                >
                  친구 삭제
                </button>
              </div>
            )}

            {/* 친구 삭제 확인 */}
            {hasFriendActions && confirmRemove && (
              <div className="border-t border-neutral-800 px-4 py-3 space-y-2">
                <p className="text-xs text-neutral-400 text-center">{nickname}님을 친구 목록에서 삭제할까요?</p>
                <div className="flex gap-2">
                  <button
                    onClick={() => { friendActions.onRemove(); onClose(); }}
                    className="flex-1 rounded-lg bg-red-500/15 border border-red-500/30 text-xs text-red-400 font-medium py-2 hover:bg-red-500/25 transition-colors"
                  >
                    삭제
                  </button>
                  <button
                    onClick={() => setConfirmRemove(false)}
                    className="flex-1 rounded-lg border border-neutral-700 text-xs text-neutral-400 py-2 hover:text-white transition-colors"
                  >
                    취소
                  </button>
                </div>
              </div>
            )}

            {/* 친구 추가 버튼 (friendActions 없을 때만) */}
            {!hasFriendActions && canShowActions && !isFriend && onAddFriend && (
              <div className="border-t border-neutral-800 px-4 py-3">
                {friendRequested ? (
                  <p className="text-xs text-emerald-400 text-center py-1">친구 요청을 보냈습니다 ✓</p>
                ) : (
                  <button
                    onClick={async () => {
                      if (addingFriend) return;
                      setAddingFriend(true);
                      await onAddFriend();
                      setFriendRequested(true);
                      setAddingFriend(false);
                    }}
                    disabled={addingFriend || isLoading || !profile}
                    className="w-full rounded-lg bg-white text-black text-xs font-semibold py-2.5 hover:bg-neutral-200 disabled:opacity-50 transition-colors"
                  >
                    {addingFriend ? '요청 중...' : '친구 추가'}
                  </button>
                )}
              </div>
            )}

            {/* 신고 오버레이 */}
            {canShowActions && reporting && (
              <div className="absolute inset-0 bg-[#111111]/95 rounded-2xl flex flex-col justify-center px-5 py-6 z-10">
                {reportDone ? (
                  <div className="flex flex-col items-center gap-3 text-center">
                    <svg width={28} height={28} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="text-emerald-400">
                      <path d="M22 11.08V12a10 10 0 11-5.93-9.14" /><path d="M22 4L12 14.01l-3-3" />
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
                    <p className="text-sm font-medium text-white mb-4">{nickname} 신고</p>
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
          </>
        )}

        {/* 배지 툴팁 */}
        {hoveredBadge && badgeTooltipPos && BADGE_META[hoveredBadge as BadgeType] && (
          <div
            className="fixed z-[9999] pointer-events-none"
            style={{ left: badgeTooltipPos.x, top: badgeTooltipPos.y - 8, transform: 'translate(-50%, -100%)' }}
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
