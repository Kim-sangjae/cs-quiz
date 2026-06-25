import Link from 'next/link';
import type { Metadata } from 'next';
import { prisma } from '@/lib/prisma';

export const metadata: Metadata = { title: '기여도 순위' };

export const revalidate = 60;

async function getContributors() {
  const rows = await prisma.question.groupBy({
    by: ['authorId'],
    where: { authorId: { not: null }, status: { in: ['OFFICIAL', 'APPROVED'] } },
    _count: { id: true },
    orderBy: { _count: { id: 'desc' } },
    take: 50,
  });

  const authorIds = rows.map((r) => r.authorId!);
  const users = await prisma.user.findMany({
    where: { id: { in: authorIds } },
    select: { id: true, nickname: true },
  });
  const userMap = Object.fromEntries(users.map((u) => [u.id, u.nickname]));

  return rows
    .filter((r) => r.authorId && userMap[r.authorId])
    .map((r) => ({
      userId: r.authorId!,
      nickname: userMap[r.authorId!] ?? '(알 수 없음)',
      approved: r._count.id,
    }));
}

async function getSubmitters() {
  const rows = await prisma.question.groupBy({
    by: ['authorId'],
    where: { authorId: { not: null } },
    _count: { id: true },
    orderBy: { _count: { id: 'desc' } },
    take: 50,
  });

  const authorIds = rows.map((r) => r.authorId!);
  const users = await prisma.user.findMany({
    where: { id: { in: authorIds } },
    select: { id: true, nickname: true },
  });
  const userMap = Object.fromEntries(users.map((u) => [u.id, u.nickname]));

  return rows
    .filter((r) => r.authorId && userMap[r.authorId])
    .map((r) => ({
      userId: r.authorId!,
      nickname: userMap[r.authorId!] ?? '(알 수 없음)',
      total: r._count.id,
    }));
}

const MEDAL = ['🥇', '🥈', '🥉'];

export default async function LeaderboardPage() {
  const [contributors, submitters] = await Promise.all([getContributors(), getSubmitters()]);

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="flex items-center gap-4 mb-6">
        <Link href="/" className="text-neutral-400 hover:text-white text-sm transition-colors">← 홈</Link>
        <h1 className="text-xl font-semibold text-white">기여도 순위</h1>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        {/* 채택 문제 수 */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <h2 className="text-sm font-semibold text-white">채택 문제</h2>
            <span className="text-xs text-neutral-600">승인된 문제 수 기준</span>
          </div>
          {contributors.length === 0 ? (
            <p className="text-xs text-neutral-600 py-4">아직 기여자가 없습니다.</p>
          ) : (
            <div className="space-y-2">
              {contributors.slice(0, 20).map((c, i) => (
                <div key={c.userId} className="bg-[#111111] border border-neutral-800 rounded-xl px-4 py-3 flex items-center gap-3">
                  <span className="w-6 text-center text-sm flex-shrink-0">
                    {i < 3 ? MEDAL[i] : <span className="text-xs text-neutral-600">{i + 1}</span>}
                  </span>
                  <span className="flex-1 text-sm text-white truncate">{c.nickname}</span>
                  <span className="text-sm font-bold text-emerald-400">{c.approved}개</span>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* 총 제출 수 */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <h2 className="text-sm font-semibold text-white">총 제출 수</h2>
            <span className="text-xs text-neutral-600">상태 무관 전체 제출</span>
          </div>
          {submitters.length === 0 ? (
            <p className="text-xs text-neutral-600 py-4">아직 제출자가 없습니다.</p>
          ) : (
            <div className="space-y-2">
              {submitters.slice(0, 20).map((s, i) => (
                <div key={s.userId} className="bg-[#111111] border border-neutral-800 rounded-xl px-4 py-3 flex items-center gap-3">
                  <span className="w-6 text-center text-sm flex-shrink-0">
                    {i < 3 ? MEDAL[i] : <span className="text-xs text-neutral-600">{i + 1}</span>}
                  </span>
                  <span className="flex-1 text-sm text-white truncate">{s.nickname}</span>
                  <span className="text-sm font-bold text-neutral-300">{s.total}개</span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <div className="mt-8 text-center">
        <Link
          href="/board/submit"
          className="inline-block rounded-lg bg-white text-black text-sm font-semibold px-5 py-2.5 hover:bg-neutral-200 transition-colors"
        >
          문제 등록하기
        </Link>
      </div>
    </div>
  );
}
