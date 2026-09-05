'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import type { CategoryRankings, RankEntry, MyRankEntry, ContributorEntry } from '@/lib/rankings';
import UserProfileModal from './UserProfileModal';

const CATEGORY_TABS: { key: keyof CategoryRankings; label: string }[] = [
  { key: 'overall', label: '전체' },
  { key: 'ds', label: 'DS' },
  { key: 'algo', label: 'Algo' },
  { key: 'os', label: 'OS' },
  { key: 'network', label: 'Network' },
  { key: 'db', label: 'DB' },
  { key: 'arch', label: 'Arch' },
  { key: 'se', label: 'SE' },
];

interface FriendRankEntry {
  rank: number;
  userId: string;
  nickname: string;
  isMe: boolean;
  totalAttempts: number;
  accuracy: number;
  isOnline: boolean;
}

interface RankingSectionProps {
  rankings: CategoryRankings;
  currentUserId: string | null;
  myRanks: Record<string, MyRankEntry>;
  contributors: ContributorEntry[];
}

const MEDAL = ['🥇', '🥈', '🥉'];

function FriendRankings({
  currentUserId,
  onProfileClick,
}: {
  currentUserId: string | null;
  onProfileClick: (userId: string, nickname: string) => void;
}) {
  const { data, isLoading } = useQuery<{ rankings: FriendRankEntry[] }>({
    queryKey: ['friends', 'rankings'],
    queryFn: () => fetch('/api/friends/rankings').then((r) => r.json()),
    enabled: currentUserId != null,
    staleTime: 60_000,
  });

  if (!currentUserId) {
    return <p className="text-sm text-neutral-500 py-4">로그인 후 이용할 수 있습니다.</p>;
  }
  if (isLoading) {
    return <div className="h-20 animate-pulse bg-neutral-800/50 rounded-lg" />;
  }
  const rankings = data?.rankings ?? [];
  if (rankings.length === 0) {
    return <p className="text-sm text-neutral-500 py-4">친구를 추가하면 친구 랭킹을 볼 수 있어요.</p>;
  }

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-neutral-500 text-left border-b border-neutral-800">
          <th className="pb-2 font-normal w-10">순위</th>
          <th className="pb-2 font-normal">닉네임</th>
          <th className="pb-2 font-normal text-right">시도</th>
          <th className="pb-2 font-normal text-right">정답률</th>
        </tr>
      </thead>
      <tbody>
        {rankings.map((entry) => (
          <tr
            key={entry.userId}
            className={`border-b border-neutral-800 last:border-0 ${entry.isMe ? 'bg-neutral-800/40' : ''}`}
          >
            <td className="py-2.5 text-neutral-500">{entry.rank}</td>
            <td className={`py-2.5 ${entry.isMe ? 'text-white font-medium' : 'text-neutral-300'}`}>
              <button
                onClick={() => onProfileClick(entry.userId, entry.nickname)}
                className="flex items-center gap-1.5 hover:text-white transition-colors text-left"
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                    entry.isOnline ? 'bg-emerald-500' : 'bg-neutral-700'
                  }`}
                />
                {entry.nickname}
                {entry.isMe && <span className="text-[10px] text-emerald-400 ml-1">(나)</span>}
              </button>
            </td>
            <td className="py-2.5 text-right text-neutral-400">{entry.totalAttempts.toLocaleString()}</td>
            <td className="py-2.5 text-right text-neutral-300">{(entry.accuracy * 100).toFixed(1)}%</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default function RankingSection({ rankings, currentUserId, myRanks, contributors }: RankingSectionProps) {
  const [activeTab, setActiveTab] = useState<keyof CategoryRankings | 'friends' | 'contributors'>('overall');
  const [profileModal, setProfileModal] = useState<{ userId: string; nickname: string } | null>(null);
  const [showRankInfo, setShowRankInfo] = useState(false);
  const isFriendsTab = activeTab === 'friends';
  const isContributorsTab = activeTab === 'contributors';
  const entries: RankEntry[] = (isFriendsTab || isContributorsTab) ? [] : (rankings[activeTab as keyof CategoryRankings] ?? []);
  const myRank = (isFriendsTab || isContributorsTab) ? null : (myRanks[activeTab as keyof CategoryRankings] ?? null);
  const isMeInTop = !isFriendsTab && !isContributorsTab && currentUserId != null && entries.some(e => e.userId === currentUserId);

  return (
    <section className="mt-12 border-t border-neutral-800 pt-8">
      {profileModal && (
        <UserProfileModal
          userId={profileModal.userId}
          nickname={profileModal.nickname}
          isSelf={currentUserId != null && profileModal.userId === currentUserId}
          showActions={currentUserId != null && profileModal.userId !== currentUserId}
          onClose={() => setProfileModal(null)}
        />
      )}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-1.5">
          <h2 className="text-sm font-medium text-neutral-400">
            {isContributorsTab ? '문제 기여자 TOP 5' : activeTab === 'overall' ? '전체 합산 TOP 30' : '카테고리별 TOP 30'}
          </h2>
          {!isContributorsTab && !isFriendsTab && (
            <div className="relative">
              <button
                onClick={() => setShowRankInfo((v) => !v)}
                className="text-neutral-600 hover:text-neutral-400 transition-colors"
                aria-label="랭킹 기준 안내"
              >
                <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" />
                </svg>
              </button>
              {showRankInfo && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowRankInfo(false)} />
                  <div className="absolute left-0 top-full mt-1.5 z-20 w-52 bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2.5 text-[11px] text-neutral-400 leading-relaxed shadow-xl">
                    <p className="text-neutral-200 font-medium mb-1">랭킹 집계 기준</p>
                    <p>• 문제 10개 이상 풀어야 집계됩니다</p>
                    <p>• 오답복습 모드는 제외됩니다</p>
                    <p>• 정답률 → 풀이 수 순으로 순위 결정</p>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
        {isContributorsTab && (
          <Link href="/leaderboard" className="text-xs text-neutral-600 hover:text-white transition-colors">전체 보기 →</Link>
        )}
      </div>
      <div className="flex gap-2 mb-4 flex-wrap">
        {CATEGORY_TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => { setActiveTab(tab.key); setProfileModal(null); }}
            className={`px-3 py-1 text-xs rounded border transition-colors ${
              activeTab === tab.key
                ? 'border-neutral-400 text-white bg-neutral-800'
                : 'border-neutral-800 text-neutral-500 hover:border-neutral-600 hover:text-neutral-300'
            }`}
          >
            {tab.label}
          </button>
        ))}
        <button
          onClick={() => { setActiveTab('friends'); setProfileModal(null); }}
          className={`px-3 py-1 text-xs rounded border transition-colors ${
            activeTab === 'friends'
              ? 'border-neutral-400 text-white bg-neutral-800'
              : 'border-neutral-800 text-neutral-500 hover:border-neutral-600 hover:text-neutral-300'
          }`}
        >
          친구
        </button>
        <button
          onClick={() => { setActiveTab('contributors'); setProfileModal(null); }}
          className={`px-3 py-1 text-xs rounded border transition-colors ${
            activeTab === 'contributors'
              ? 'border-amber-700 text-amber-300 bg-amber-950/40'
              : 'border-neutral-800 text-neutral-500 hover:border-neutral-600 hover:text-neutral-300'
          }`}
        >
          ✍️ 기여
        </button>
      </div>

      {isContributorsTab ? (
        <div>
          {contributors.length === 0 ? (
            <p className="text-sm text-neutral-500 py-4">아직 기여자가 없습니다</p>
          ) : (
            <div className="space-y-1">
              {contributors.map((c, i) => (
                <div
                  key={c.userId}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                    i < 3 ? 'bg-[#111111] border border-neutral-800/60' : 'border-b border-neutral-800/40 last:border-0'
                  }`}
                >
                  <span className="w-7 text-center flex-shrink-0">
                    {i < 3 ? (
                      <span className="text-base leading-none">{MEDAL[i]}</span>
                    ) : (
                      <span className="text-xs text-neutral-600 font-mono tabular-nums">{i + 1}</span>
                    )}
                  </span>
                  <button
                    onClick={() => setProfileModal({ userId: c.userId, nickname: c.nickname })}
                    className={`flex-1 text-sm truncate text-left hover:text-white transition-colors ${i < 3 ? 'text-white font-medium' : 'text-neutral-400'}`}
                  >
                    {c.nickname}
                  </button>
                  <div className="flex items-baseline gap-1">
                    <span className={`text-sm font-bold ${i < 3 ? 'text-emerald-400' : 'text-neutral-500'}`}>
                      {c.approved}
                    </span>
                    <span className="text-[11px] text-neutral-600">문제</span>
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="pt-4">
            <Link
              href="/board/submit"
              className="inline-flex items-center gap-1.5 text-xs text-neutral-600 hover:text-amber-400 transition-colors"
            >
              <span>문제 등록하고 기여자가 되기</span>
              <span>→</span>
            </Link>
          </div>
        </div>
      ) : isFriendsTab ? (
        <FriendRankings currentUserId={currentUserId} onProfileClick={(uid, nick) => setProfileModal({ userId: uid, nickname: nick })} />
      ) : entries.length === 0 ? (
        <p className="text-sm text-neutral-500 py-4">아직 랭킹 데이터가 없습니다</p>
      ) : (
        <>
        <div className="max-h-[248px] overflow-y-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-[#0a0a0a]">
            <tr className="text-neutral-500 text-left border-b border-neutral-800">
              <th className="pb-2 font-normal w-10">순위</th>
              <th className="pb-2 font-normal">닉네임</th>
              <th className="pb-2 font-normal text-right">시도</th>
              <th className="pb-2 font-normal text-right">정답률</th>
            </tr>
          </thead>
          <tbody>
            {entries.map(entry => {
              const isMe = currentUserId != null && entry.userId === currentUserId;
              return (
                <tr
                  key={entry.userId}
                  className={`border-b border-neutral-800 last:border-0 ${isMe ? 'bg-neutral-800/40' : ''}`}
                >
                  <td className="py-2.5 text-neutral-500">{entry.rank}</td>
                  <td className={`py-2.5 ${isMe ? 'text-white font-medium' : 'text-neutral-300'}`}>
                    <button
                      onClick={() => setProfileModal({ userId: entry.userId, nickname: entry.nickname })}
                      className="hover:text-white transition-colors text-left"
                    >
                      {entry.nickname}
                    </button>
                    {isMe && myRank && (
                      <span className="ml-2 text-[10px] text-emerald-500">
                        상위 {Math.ceil((myRank.rank / myRank.totalParticipants) * 100)}%
                      </span>
                    )}
                  </td>
                  <td className="py-2.5 text-right text-neutral-400">
                    {entry.attemptCount.toLocaleString()}
                  </td>
                  <td className="py-2.5 text-right text-neutral-300">
                    {(entry.accuracy * 100).toFixed(1)}%
                  </td>
                </tr>
              );
            })}
            {!isMeInTop && myRank && (
              <>
                <tr><td colSpan={4} className="py-1"><div className="border-t border-dashed border-neutral-700" /></td></tr>
                <tr className="bg-neutral-800/40">
                  <td className="py-2.5 text-neutral-500">{myRank.rank}</td>
                  <td className="py-2.5 text-white font-medium">
                    나
                    <span className="ml-2 text-[10px] text-emerald-500">
                      상위 {Math.ceil((myRank.rank / myRank.totalParticipants) * 100)}%
                    </span>
                  </td>
                  <td className="py-2.5 text-right text-neutral-400">
                    {myRank.attemptCount.toLocaleString()}
                  </td>
                  <td className="py-2.5 text-right text-neutral-300">
                    {(myRank.accuracy * 100).toFixed(1)}%
                  </td>
                </tr>
              </>
            )}
          </tbody>
        </table>
        </div>
        </>
      )}
    </section>
  );
}
