import Link from "next/link";
import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getServerUser } from "@/lib/auth";
import { buildRankings, getMyRanks, getHomepagePersonalization, getTopContributors, type CategoryRankings, type MyRankEntry, type HomepagePersonalization, type ContributorEntry } from "@/lib/rankings";
import RankingSection from "@/components/RankingSection";
import DailyChallenge from "@/components/DailyChallenge";
import OnlineCountBadge from "@/components/OnlineCountBadge";

const getCachedTotal = unstable_cache(
  () => prisma.question.count({ where: { status: { in: ['OFFICIAL', 'APPROVED'] } } }),
  ['question-total'],
  { revalidate: 30 }
);

const EMPTY_RANKINGS: CategoryRankings = {
  overall: [], ds: [], algo: [], os: [], network: [], db: [], arch: [], se: [],
};

const getCachedRankings = unstable_cache(buildRankings, ['rankings'], { revalidate: 60 });
const getCachedContributors = unstable_cache(getTopContributors, ['contributors'], { revalidate: 60 });
// getMyRanks는 userId 인자별로 별도 캐시 엔트리가 생성됨 (unstable_cache가 인자를 캐시 키에 포함)
const getCachedMyRanks = unstable_cache(getMyRanks, ['my-ranks'], { revalidate: 60 });

const CATEGORIES = [
  { key: 'ds',      label: '자료구조',    sub: '스택·큐·트리·그래프' },
  { key: 'algo',    label: '알고리즘',    sub: '정렬·탐색·DP·그리디' },
  { key: 'os',      label: '운영체제',    sub: '프로세스·메모리·스케줄링' },
  { key: 'network', label: '네트워크',    sub: 'TCP/IP·HTTP·DNS' },
  { key: 'db',      label: '데이터베이스', sub: 'SQL·인덱스·트랜잭션' },
  { key: 'arch',    label: '컴퓨터 구조', sub: 'CPU·캐시·파이프라인' },
  { key: 'se',      label: '소프트웨어공학', sub: '디자인패턴·애자일·테스트' },
];

export default async function Home() {
  const [user, rankings, contributors, total] = await Promise.all([
    getServerUser(),
    getCachedRankings().catch(() => EMPTY_RANKINGS),
    getCachedContributors().catch(() => [] as ContributorEntry[]),
    getCachedTotal().catch(() => 0),
  ]);
  const [myRanks, personalization] = user
    ? await Promise.all([
        getCachedMyRanks(user.id).catch(() => ({})),
        getHomepagePersonalization(user.id).catch(() => null),
      ])
    : [{} as Record<string, MyRankEntry>, null as HomepagePersonalization | null];

  return (
    <main className="min-h-screen px-4 py-12">
      <div className="max-w-2xl mx-auto">

        {/* Hero */}
        <div className="mb-10">
          <div className="flex items-center gap-2 mb-5 flex-wrap">
            <div className="inline-flex items-center gap-1.5 text-xs text-neutral-500 border border-neutral-800 rounded-full px-3 py-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              {total}문제 수록
            </div>
            <OnlineCountBadge />
          </div>

          <h1 className="text-4xl font-bold text-white tracking-tight mb-3">CSORA</h1>
          <p className="text-neutral-400 text-sm leading-relaxed mb-7 max-w-sm">
            CS 핵심 개념을 문제로 빠르게 점검하세요.
            틀린 문제는 자동으로 복습 예약되고, 친구와 실시간 1:1 대결도 즐길 수 있습니다.
          </p>

          <div className="flex items-center gap-3 flex-wrap">
            <Link
              href="/quiz"
              className="rounded-lg bg-white text-black text-sm font-semibold px-6 py-2.5 hover:bg-neutral-100 transition-all duration-200"
            >
              퀴즈 시작
            </Link>
            {user ? (
              <Link
                href="/mypage"
                className="rounded-lg border border-neutral-700 text-neutral-400 text-sm px-4 py-2.5 hover:border-neutral-500 hover:text-white transition-all duration-200"
              >
                내 기록
              </Link>
            ) : (
              <Link
                href="/auth/login"
                className="rounded-lg border border-neutral-700 text-neutral-400 text-sm px-4 py-2.5 hover:border-neutral-500 hover:text-white transition-all duration-200"
              >
                로그인
              </Link>
            )}
          </div>

          {/* 개인화 배너 */}
          {personalization && (
            <div className="mt-5 flex flex-col gap-2">
              {personalization.streak.status === 'yesterday' && personalization.streak.count > 0 && (
                <div className="flex items-center justify-between bg-amber-950/25 border border-amber-800/30 rounded-xl px-4 py-3">
                  <span className="text-sm text-amber-300">
                    🔥 {personalization.streak.count}일 연속 출석 중
                  </span>
                  <a href="#daily-challenge" className="text-xs text-amber-400 hover:text-amber-200 font-medium transition-colors">
                    오늘 문제 풀기 →
                  </a>
                </div>
              )}
              {personalization.streak.status === 'none' && (
                <div className="flex items-center justify-between bg-neutral-900/60 border border-neutral-800 rounded-xl px-4 py-3">
                  <span className="text-sm text-neutral-400">
                    오늘의 문제를 풀면 출석이 기록됩니다
                  </span>
                  <a href="#daily-challenge" className="text-xs text-neutral-400 hover:text-white font-medium transition-colors">
                    풀기 →
                  </a>
                </div>
              )}
              {personalization.streak.status === 'today' && personalization.streak.count > 1 && (
                <p className="text-xs text-emerald-500 px-1">
                  🔥 {personalization.streak.count}일 연속 출석 중
                </p>
              )}
              {personalization.weakCategory && (
                <div className="flex items-center justify-between bg-neutral-900/60 border border-neutral-800 rounded-xl px-4 py-3">
                  <span className="text-sm text-neutral-300">
                    약점 카테고리:{" "}
                    <span className="text-white font-medium">{personalization.weakCategory.label}</span>
                    <span className="text-neutral-600 ml-2 text-xs">
                      정답률 {(personalization.weakCategory.accuracy * 100).toFixed(0)}%
                    </span>
                  </span>
                  <Link
                    href={`/quiz/play?category=${personalization.weakCategory.category}`}
                    className="text-xs text-neutral-400 hover:text-white font-medium transition-colors"
                  >
                    집중 연습 →
                  </Link>
                </div>
              )}
            </div>
          )}
        </div>

        {/* 오늘의 문제 */}
        <DailyChallenge />

        {/* 카테고리 바로가기 */}
        <section className="mb-12 border-t border-neutral-800 pt-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-white">카테고리별 퀴즈</h2>
            <Link href="/quiz" className="text-xs text-neutral-500 hover:text-white transition-colors">전체 보기 →</Link>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {CATEGORIES.map((c) => (
              <Link
                key={c.key}
                href={`/quiz/play?category=${c.key}`}
                className="bg-[#111111] border border-neutral-800 rounded-lg px-4 py-3.5 hover:bg-[#181818] hover:border-neutral-700 transition-colors group"
              >
                <p className="text-sm font-medium text-white mb-0.5">{c.label}</p>
                <p className="text-[11px] text-neutral-500 group-hover:text-neutral-400 transition-colors">{c.sub}</p>
              </Link>
            ))}
          </div>
        </section>

        {/* 랭킹 */}
        <RankingSection rankings={rankings} currentUserId={user?.id ?? null} myRanks={myRanks} contributors={contributors} />

        {/* 하단 링크 */}
        <div className="mt-10 pt-6 border-t border-neutral-800 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-4">
            <Link href="/board" className="text-xs text-neutral-600 hover:text-neutral-400 transition-colors">게시판</Link>
            <Link href="/leaderboard" className="text-xs text-neutral-600 hover:text-neutral-400 transition-colors">기여도 순위</Link>
            <Link href="/about" className="text-xs text-neutral-600 hover:text-neutral-400 transition-colors">서비스 소개</Link>
          </div>
          {!user && (
            <span className="text-xs text-neutral-700">로그인하면 기록이 저장됩니다</span>
          )}
        </div>
      </div>
    </main>
  );
}
