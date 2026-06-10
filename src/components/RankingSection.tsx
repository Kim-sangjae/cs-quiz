'use client';

import { useState } from 'react';
import type { CategoryRankings, RankEntry } from '@/lib/rankings';

const TABS: { key: keyof CategoryRankings; label: string }[] = [
  { key: 'ds', label: 'DS' },
  { key: 'algo', label: 'Algo' },
  { key: 'os', label: 'OS' },
  { key: 'network', label: 'Network' },
  { key: 'db', label: 'DB' },
  { key: 'arch', label: 'Arch' },
];

interface RankingSectionProps {
  rankings: CategoryRankings;
  currentUserId: string | null;
}

export default function RankingSection({ rankings, currentUserId }: RankingSectionProps) {
  const [activeTab, setActiveTab] = useState<keyof CategoryRankings>('ds');
  const entries: RankEntry[] = rankings[activeTab] ?? [];

  return (
    <section className="mt-12 border-t border-neutral-800 pt-8">
      <h2 className="text-sm font-medium text-neutral-400 mb-4">카테고리별 TOP 5</h2>
      <div className="flex gap-2 mb-4 flex-wrap">
        {TABS.map(tab => (
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
      </div>
      {entries.length === 0 ? (
        <p className="text-sm text-neutral-500 py-4">아직 랭킹 데이터가 없습니다</p>
      ) : (
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
                  className={`border-b border-neutral-800 last:border-0 ${
                    isMe ? 'bg-neutral-800/40' : ''
                  }`}
                >
                  <td className="py-2.5 text-neutral-500">{entry.rank}</td>
                  <td className={`py-2.5 ${isMe ? 'text-white font-medium' : 'text-neutral-300'}`}>
                    {entry.nickname}
                    {isMe && <span className="ml-2 text-xs text-neutral-500">(나)</span>}
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
          </tbody>
        </table>
      )}
    </section>
  );
}
