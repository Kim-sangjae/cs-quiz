'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import type { CategoryRankings, RankEntry, MyRankEntry, ContributorEntry } from '@/lib/rankings';

interface RankUserProfile {
  nickname: string;
  level: number;
  totalAttempts: number;
  accuracy: number;
  battleTotal: number;
  battleWins: number;
  profileVisibility: string;
}

function RankProfileModal({ userId, nickname, onClose }: { userId: string; nickname: string; onClose: () => void }) {
  const { data, isLoading } = useQuery<RankUserProfile>({
    queryKey: ['rank-profile', userId],
    queryFn: () => fetch(`/api/users/${userId}/profile`).then((r) => r.json()),
    staleTime: 60_000,
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px]" />
      <div
        className="relative w-full max-w-xs bg-[#111111] border border-neutral-800 rounded-2xl overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-3 right-3 p-1.5 rounded text-neutral-600 hover:text-white hover:bg-neutral-800 transition-colors"
        >
          <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
        <div className="flex flex-col items-center pt-8 pb-5 px-5">
          <div className="w-14 h-14 rounded-full bg-neutral-800 border border-neutral-700 flex items-center justify-center mb-3">
            <span className="text-lg font-semibold text-neutral-300">{(nickname[0] ?? '?').toUpperCase()}</span>
          </div>
          <p className="text-base font-semibold text-white">{nickname}</p>
          {isLoading ? (
            <div className="h-4 w-20 bg-neutral-800 rounded animate-pulse mt-1" />
          ) : data ? (
            <p className="text-xs text-neutral-500 mt-1">Lv.{data.level}</p>
          ) : null}
        </div>
        {!isLoading && data && (
          <div className="border-t border-neutral-800 px-5 py-4 space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-neutral-500">총 시도</span>
              <span className="text-neutral-300">{data.totalAttempts.toLocaleString()}회</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-neutral-500">정답률</span>
              <span className="text-neutral-300">{(data.accuracy * 100).toFixed(1)}%</span>
            </div>
            {data.battleTotal > 0 && (
              <div className="flex justify-between text-xs">
                <span className="text-neutral-500">대전 승률</span>
                <span className="text-neutral-300">{Math.round((data.battleWins / data.battleTotal) * 100)}%</span>
              </div>
            )}
          </div>
        )}
        {!isLoading && data?.profileVisibility !== 'PRIVATE' && (
          <div className="border-t border-neutral-800 px-4 py-3">
            <a
              href={`/u/${encodeURIComponent(nickname)}`}
              className="block w-full text-center text-xs text-neutral-400 hover:text-white border border-neutral-800 hover:border-neutral-600 rounded-lg py-2 transition-colors"
            >
              프로필 상세보기 →
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

const CATEGORY_TABS: { key: keyof CategoryRankings; label: string }[] = [
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

function FriendRankings({ currentUserId }: { currentUserId: string | null }) {
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
              <span className="flex items-center gap-1.5">
                <span
                  className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                    entry.isOnline ? 'bg-emerald-500' : 'bg-neutral-700'
                  }`}
                />
                {entry.nickname}
              </span>
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
  const [activeTab, setActiveTab] = useState<keyof CategoryRankings | 'friends' | 'contributors'>('ds');
  const [profileModal, setProfileModal] = useState<{ userId: string; nickname: string } | null>(null);
  const isFriendsTab = activeTab === 'friends';
  const isContributorsTab = activeTab === 'contributors';
  const entries: RankEntry[] = (isFriendsTab || isContributorsTab) ? [] : (rankings[activeTab as keyof CategoryRankings] ?? []);
  const myRank = (isFriendsTab || isContributorsTab) ? null : (myRanks[activeTab as keyof CategoryRankings] ?? null);
  const isMeInTop5 = !isFriendsTab && !isContributorsTab && currentUserId != null && entries.some(e => e.userId === currentUserId);

  return (
    <section className="mt-12 border-t border-neutral-800 pt-8">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-medium text-neutral-400">
          {isContributorsTab ? '문제 기여자 TOP 5' : '카테고리별 TOP 5'}
        </h2>
        {isContributorsTab && (
          <Link href="/leaderboard" className="text-xs text-neutral-600 hover:text-white transition-colors">전체 보기 →</Link>
        )}
      </div>
      <div className="flex gap-2 mb-4 flex-wrap">
        {CATEGORY_TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
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
          onClick={() => setActiveTab('friends')}
          className={`px-3 py-1 text-xs rounded border transition-colors ${
            activeTab === 'friends'
              ? 'border-neutral-400 text-white bg-neutral-800'
              : 'border-neutral-800 text-neutral-500 hover:border-neutral-600 hover:text-neutral-300'
          }`}
        >
          친구
        </button>
        <button
          onClick={() => setActiveTab('contributors')}
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
                  <span className={`flex-1 text-sm truncate ${i < 3 ? 'text-white font-medium' : 'text-neutral-400'}`}>
                    {c.nickname}
                  </span>
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
        <FriendRankings currentUserId={currentUserId} />
      ) : entries.length === 0 ? (
        <p className="text-sm text-neutral-500 py-4">아직 랭킹 데이터가 없습니다</p>
      ) : (
        <>
        {profileModal && (
          <RankProfileModal
            userId={profileModal.userId}
            nickname={profileModal.nickname}
            onClose={() => setProfileModal(null)}
          />
        )}
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
            {!isMeInTop5 && myRank && (
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
        </>
      )}
    </section>
  );
}
