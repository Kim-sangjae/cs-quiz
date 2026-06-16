import Link from "next/link";
import { unstable_cache } from "next/cache";
import { questions } from "@/data/questions";
import { getServerUser } from "@/lib/auth";
import { buildRankings, getMyRanks, type CategoryRankings, type MyRankEntry } from "@/lib/rankings";
import RankingSection from "@/components/RankingSection";

const total = questions.length;

const EMPTY_RANKINGS: CategoryRankings = {
  ds: [], algo: [], os: [], network: [], db: [], arch: [],
};

const getCachedRankings = unstable_cache(buildRankings, ['rankings'], { revalidate: 60 });

const FEATURES = [
  {
    icon: (
      <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
      </svg>
    ),
    title: "CS 퀴즈",
    desc: "자료구조·알고리즘·OS·네트워크·DB·컴퓨터 구조 6개 영역에서 30문제를 랜덤으로 출제합니다. 카테고리별로 선택해서 풀 수도 있습니다.",
  },
  {
    icon: (
      <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
        <path d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
      </svg>
    ),
    title: "커뮤니티 게시판",
    desc: "누구나 CS 문제를 직접 등록할 수 있습니다. 좋아요로 좋은 문제를 추천하고, 관리자 승인을 거친 문제는 퀴즈 풀에 추가됩니다.",
  },
  {
    icon: (
      <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
    title: "랭킹",
    desc: "카테고리별 정답률 TOP 5를 확인하세요. 마이페이지에서 내 풀이 기록과 카테고리별 약점도 분석할 수 있습니다.",
  },
];

export default async function Home() {
  const [user, rankings] = await Promise.all([
    getServerUser(),
    getCachedRankings().catch(() => EMPTY_RANKINGS),
  ]);
  const myRanks = user ? await getMyRanks(user.id).catch(() => ({})) : {};

  return (
    <main className="min-h-screen px-4 py-14">
      <div className="max-w-2xl mx-auto">

        {/* Hero */}
        <div className="mb-12">
          <div className="inline-flex items-center gap-1.5 text-xs text-neutral-500 border border-neutral-800 rounded-full px-3 py-1 mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            전체 {total}문제 · 6개 카테고리
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight mb-3">CS Quiz</h1>
          <p className="text-neutral-400 text-base leading-relaxed mb-8">
            CS 기초 지식을 30문제로 점검하세요.<br />
            취업 준비, 실력 점검, 복습 모두 가능합니다.
          </p>
          <div className="flex items-center gap-3 flex-wrap">
            <Link
              href="/quiz"
              className="rounded-md bg-white text-black text-sm font-semibold px-6 py-2.5 hover:bg-neutral-200 transition-colors"
            >
              문제 풀기 시작
            </Link>
            {!user && (
              <span className="text-xs text-neutral-600">로그인하면 기록이 저장됩니다</span>
            )}
          </div>
        </div>

        {/* 소개 */}
        <section className="mb-12 border-t border-neutral-800 pt-10">
          <h2 className="text-sm font-medium text-neutral-400 mb-6">이런 걸 할 수 있어요</h2>
          <div className="space-y-4">
            {FEATURES.map((f) => (
              <div key={f.title} className="flex gap-4 bg-[#111111] border border-neutral-800 rounded-xl p-5">
                <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-neutral-800 flex items-center justify-center text-neutral-400">
                  {f.icon}
                </div>
                <div>
                  <p className="text-sm font-medium text-white mb-1">{f.title}</p>
                  <p className="text-xs text-neutral-500 leading-relaxed">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* 랭킹 */}
        <RankingSection rankings={rankings} currentUserId={user?.id ?? null} myRanks={myRanks} />
      </div>
    </main>
  );
}
