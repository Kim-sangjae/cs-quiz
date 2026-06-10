import { prisma } from '@/lib/prisma';

export type RankEntry = {
  rank: number;
  userId: string;
  nickname: string;
  attemptCount: number;
  accuracy: number;
};

export type CategoryRankings = {
  ds: RankEntry[];
  algo: RankEntry[];
  os: RankEntry[];
  network: RankEntry[];
  db: RankEntry[];
  arch: RankEntry[];
};

type RawRow = {
  userId: string;
  category: string;
  attemptCount: number | bigint;
  correctCount: number | bigint;
  nickname: string | null;
};

const CATEGORIES = ['ds', 'algo', 'os', 'network', 'db', 'arch'] as const;

export async function buildRankings(): Promise<CategoryRankings> {
  const rows = await prisma.$queryRaw<RawRow[]>`
    SELECT
      qa."userId",
      q.category,
      COUNT(*)::int AS "attemptCount",
      SUM(CASE WHEN qa."isCorrect" THEN 1 ELSE 0 END)::int AS "correctCount",
      u.nickname
    FROM "QuestionAttempt" qa
    JOIN "Question" q ON qa."questionId" = q.id
    JOIN "User" u ON qa."userId" = u.id
    GROUP BY qa."userId", q.category, u.nickname
    HAVING COUNT(*) >= 10
    ORDER BY
      (SUM(CASE WHEN qa."isCorrect" THEN 1 ELSE 0 END)::float / COUNT(*)) DESC,
      COUNT(*) DESC
  `;

  const result = Object.fromEntries(
    CATEGORIES.map(cat => [cat, [] as RankEntry[]])
  ) as CategoryRankings;

  for (const cat of CATEGORIES) {
    result[cat] = rows
      .filter(r => r.category === cat)
      .slice(0, 5)
      .map((row, i) => ({
        rank: i + 1,
        userId: row.userId,
        nickname: row.nickname ?? '(닉네임 없음)',
        attemptCount: Number(row.attemptCount),
        accuracy: Number(row.correctCount) / Number(row.attemptCount),
      }));
  }

  return result;
}
