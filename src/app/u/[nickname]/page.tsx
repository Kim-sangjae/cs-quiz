import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import { prisma } from '@/lib/prisma';
import { getServerUser } from '@/lib/auth';
import { BADGE_META } from '@/lib/badges';
import ProfileVisibilityListener from '@/components/ProfileVisibilityListener';

const CATEGORIES = ['ds', 'algo', 'os', 'network', 'db', 'arch', 'se'] as const;
type Cat = typeof CATEGORIES[number];

const CATEGORY_LABELS: Record<Cat, string> = {
  ds: '자료구조', algo: '알고리즘', os: '운영체제',
  network: '네트워크', db: '데이터베이스', arch: '컴퓨터 구조', se: '소프트웨어공학',
};

const LEVEL_INFO: Record<number, { name: string; cls: string }> = {
  1: { name: '입문',   cls: 'text-neutral-400 border-neutral-700' },
  2: { name: '학습',   cls: 'text-blue-400 border-blue-900/60' },
  3: { name: '숙련',   cls: 'text-emerald-400 border-emerald-900/60' },
  4: { name: '마스터', cls: 'text-yellow-400 border-yellow-700/60' },
};

function getLevel(total: number) {
  if (total >= 300) return 4;
  if (total >= 150) return 3;
  if (total >= 50) return 2;
  return 1;
}

interface PageProps {
  params: Promise<{ nickname: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { nickname } = await params;
  const decoded = decodeURIComponent(nickname);
  return {
    title: `${decoded} — CSORA`,
    description: `${decoded}님의 CS 퀴즈 프로필`,
  };
}

export default async function PublicProfilePage({ params }: PageProps) {
  const { nickname: encodedNickname } = await params;
  const nickname = decodeURIComponent(encodedNickname);

  const [viewer, user] = await Promise.all([
    getServerUser(),
    prisma.user.findUnique({
      where: { nickname },
      select: {
        id: true,
        nickname: true,
        createdAt: true,
        streakCount: true,
        deletedAt: true,
        profileVisibility: true,
        badges: {
          select: { badge: true, earnedAt: true },
          orderBy: { earnedAt: 'asc' },
        },
      },
    }),
  ]);

  if (!user || user.deletedAt) notFound();

  // 접근 제어
  if (user.profileVisibility === 'PRIVATE') {
    if (!viewer || viewer.id !== user.id) notFound();
  } else if (user.profileVisibility === 'FRIENDS_ONLY') {
    if (!viewer || viewer.id === user.id) {
      // 본인은 통과
    } else {
      const friendship = await prisma.friendship.findFirst({
        where: {
          status: 'ACCEPTED',
          OR: [
            { requesterId: viewer.id, addresseeId: user.id },
            { requesterId: user.id, addresseeId: viewer.id },
          ],
        },
      });
      if (!friendship) notFound();
    }
  }

  const [attempts, totalSessions, approvedCount, recentSessions] = await Promise.all([
    prisma.questionAttempt.findMany({
      where: { userId: user.id },
      select: { isCorrect: true, question: { select: { category: true } } },
    }),
    prisma.quizSession.count({ where: { userId: user.id } }),
    prisma.question.count({ where: { authorId: user.id, status: { in: ['APPROVED', 'OFFICIAL'] } } }),
    prisma.quizSession.findMany({
      where: { userId: user.id },
      select: { category: true, score: true, mode: true, submittedAt: true },
      orderBy: { submittedAt: 'desc' },
      take: 10,
    }),
  ]);

  // 카테고리별 집계
  const catStats: Record<string, { total: number; correct: number }> = {};
  let allTotal = 0, allCorrect = 0;
  for (const a of attempts) {
    const cat = a.question.category;
    if (!catStats[cat]) catStats[cat] = { total: 0, correct: 0 };
    catStats[cat].total++;
    if (a.isCorrect) catStats[cat].correct++;
    allTotal++;
    if (a.isCorrect) allCorrect++;
  }
  const overallAccuracy = allTotal > 0 ? Math.round((allCorrect / allTotal) * 100) : null;

  const joinedAt = new Date(user.createdAt).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long' });

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <ProfileVisibilityListener userId={user.id} />
      <Link href="/" className="text-sm text-neutral-500 hover:text-white transition-colors">← 홈</Link>

      {/* 프로필 헤더 */}
      <div className="mt-6 mb-8 flex items-start gap-4">
        <div className="w-14 h-14 rounded-full bg-neutral-800 border border-neutral-700 flex items-center justify-center flex-shrink-0 text-xl font-bold text-neutral-300">
          {nickname.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-semibold text-white truncate">{nickname}</h1>
          <p className="text-sm text-neutral-500 mt-0.5">{joinedAt} 가입</p>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2">
            {user.streakCount > 0 && (
              <span className="text-xs text-amber-400">🔥 {user.streakCount}일 스트릭</span>
            )}
            {overallAccuracy !== null && (
              <span className="text-xs text-neutral-400">
                전체 정답률 <span className="text-white font-medium">{overallAccuracy}%</span>
              </span>
            )}
            <span className="text-xs text-neutral-400">
              퀴즈 <span className="text-white font-medium">{totalSessions}</span>회
            </span>
            {approvedCount > 0 && (
              <a
                href={`/board?author=${encodeURIComponent(nickname)}`}
                className="text-xs text-neutral-400 hover:text-white transition-colors"
              >
                문제 기여 <span className="text-white font-medium">{approvedCount}</span>개 →
              </a>
            )}
          </div>
        </div>
      </div>

      {/* 카테고리별 현황 */}
      <section className="mb-8">
        <h2 className="text-sm font-semibold text-white mb-3">카테고리별 현황</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {CATEGORIES.map((cat) => {
            const s = catStats[cat] ?? { total: 0, correct: 0 };
            const level = getLevel(s.total);
            const info = LEVEL_INFO[level];
            const accuracy = s.total > 0 ? Math.round((s.correct / s.total) * 100) : null;
            const accColor =
              accuracy === null ? 'text-neutral-600' :
              accuracy >= 80 ? 'text-emerald-400' :
              accuracy >= 60 ? 'text-yellow-400' : 'text-red-400';
            return (
              <div key={cat} className="bg-[#111111] border border-neutral-800 rounded-lg px-4 py-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-neutral-400">{CATEGORY_LABELS[cat]}</span>
                  <span className={`text-[10px] font-bold border rounded px-1.5 py-0.5 ${info.cls}`}>
                    {info.name}
                  </span>
                </div>
                <div className="flex items-baseline gap-1.5">
                  <span className={`text-sm font-semibold ${accColor}`}>
                    {accuracy !== null ? `${accuracy}%` : '–'}
                  </span>
                  {s.total > 0 && (
                    <span className="text-[10px] text-neutral-600">{s.total}회</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* 배지 */}
      {user.badges.length > 0 && (
        <section className="mb-8">
          <h2 className="text-sm font-semibold text-white mb-3">
            획득 배지
            <span className="ml-1.5 text-neutral-500 font-normal">{user.badges.length}개</span>
          </h2>
          <div className="flex flex-wrap gap-2">
            {user.badges.map(({ badge }) => {
              const meta = BADGE_META[badge as keyof typeof BADGE_META];
              if (!meta) return null;
              return (
                <div
                  key={badge}
                  title={`${meta.label} — ${meta.description}`}
                  className="bg-[#111111] border border-neutral-800 rounded-lg px-3 py-2 flex items-center gap-2"
                >
                  <span className="text-base leading-none">{meta.icon}</span>
                  <span className="text-xs text-neutral-400">{meta.label}</span>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* 최근 퀴즈 기록 */}
      {recentSessions.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-white mb-3">최근 퀴즈 기록</h2>
          <div className="space-y-2">
            {recentSessions.map((s, i) => {
              const scoreColor = s.score >= 17 ? 'text-emerald-400' : s.score >= 12 ? 'text-yellow-400' : 'text-red-400';
              const modeLabel = s.mode === 'timed' ? '시간제한' : s.mode === 'review' ? '오답복습' : null;
              return (
                <div
                  key={i}
                  className="bg-[#111111] border border-neutral-800 rounded-lg px-4 py-3 flex items-center justify-between"
                >
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs text-neutral-500 border border-neutral-800 rounded px-2 py-0.5">
                      {CATEGORY_LABELS[s.category as Cat] ?? s.category}
                    </span>
                    {modeLabel && (
                      <span className={`text-[10px] font-medium rounded-full px-1.5 py-0.5 ${
                        s.mode === 'timed'
                          ? 'text-amber-400 bg-amber-400/10 border border-amber-400/20'
                          : 'text-blue-400 bg-blue-400/10 border border-blue-400/20'
                      }`}>
                        {modeLabel}
                      </span>
                    )}
                    <span className="text-[11px] text-neutral-600">
                      {new Date(s.submittedAt).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })}
                    </span>
                  </div>
                  <span className={`text-sm font-bold tabular-nums ${scoreColor}`}>
                    {s.score}
                    <span className="text-neutral-600 font-normal text-xs"> / 20</span>
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {recentSessions.length === 0 && user.badges.length === 0 && (
        <div className="text-center py-12 text-neutral-500 text-sm">
          아직 활동 기록이 없습니다.
        </div>
      )}
    </div>
  );
}
