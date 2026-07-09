import { prisma } from '@/lib/prisma';

export type RankEntry = {
  rank: number;
  userId: string;
  nickname: string;
  attemptCount: number;
  accuracy: number;
};

export type CategoryRankings = {
  overall: RankEntry[];
  ds: RankEntry[];
  algo: RankEntry[];
  os: RankEntry[];
  network: RankEntry[];
  db: RankEntry[];
  arch: RankEntry[];
  se: RankEntry[];
};

type RawRow = {
  userId: string;
  category: string;
  attemptCount: number | bigint;
  correctCount: number | bigint;
  nickname: string | null;
};

const CATEGORIES = ['ds', 'algo', 'os', 'network', 'db', 'arch', 'se'] as const;

export type MyRankEntry = {
  rank: number;
  accuracy: number;
  attemptCount: number;
  totalParticipants: number;
} | null;

export async function getMyRanks(
  userId: string
): Promise<Record<string, MyRankEntry>> {
  const rows = await prisma.$queryRaw<
    { category: string; rank: bigint; attemptCount: number; correctCount: number; totalParticipants: bigint }[]
  >`
    WITH ranked AS (
      SELECT
        qa."userId",
        q.category,
        COUNT(*)::int AS "attemptCount",
        SUM(CASE WHEN qa."isCorrect" THEN 1 ELSE 0 END)::int AS "correctCount",
        RANK() OVER (
          PARTITION BY q.category
          ORDER BY
            (SUM(CASE WHEN qa."isCorrect" THEN 1 ELSE 0 END)::float / NULLIF(COUNT(*), 0)) DESC,
            COUNT(*) DESC
        ) AS rank,
        COUNT(*) OVER (PARTITION BY q.category) AS "totalParticipants"
      FROM "QuestionAttempt" qa
      JOIN "Question" q ON qa."questionId" = q.id
      JOIN "QuizSession" qs ON qa."sessionId" = qs.id AND qs.mode != 'review'
      GROUP BY qa."userId", q.category
      HAVING COUNT(*) >= 10
    )
    SELECT category, rank, "attemptCount", "correctCount", "totalParticipants"
    FROM ranked
    WHERE "userId" = ${userId}
  `;

  const result: Record<string, MyRankEntry> = {};
  for (const cat of CATEGORIES) result[cat] = null;
  for (const row of rows) {
    result[row.category] = {
      rank: Number(row.rank),
      accuracy: Number(row.correctCount) / Number(row.attemptCount),
      attemptCount: Number(row.attemptCount),
      totalParticipants: Number(row.totalParticipants),
    };
  }
  return result;
}

const CATEGORY_LABEL: Record<string, string> = {
  ds: '자료구조', algo: '알고리즘', os: '운영체제',
  network: '네트워크', db: '데이터베이스', arch: '컴퓨터 구조',
};

export type HomepagePersonalization = {
  streak: { count: number; status: 'today' | 'yesterday' | 'none' };
  weakCategory: { category: string; label: string; accuracy: number } | null;
};

export async function getHomepagePersonalization(userId: string): Promise<HomepagePersonalization> {
  const [dbUser, categoryStats] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { streakCount: true, lastQuizDate: true },
    }),
    prisma.$queryRaw<{ category: string; attemptCount: number; correctCount: number }[]>`
      SELECT
        q.category,
        COUNT(*)::int AS "attemptCount",
        SUM(CASE WHEN qa."isCorrect" THEN 1 ELSE 0 END)::int AS "correctCount"
      FROM "QuestionAttempt" qa
      JOIN "Question" q ON qa."questionId" = q.id
      WHERE qa."userId" = ${userId}
      GROUP BY q.category
      HAVING COUNT(*) >= 5
    `,
  ]);

  const today = new Date().toISOString().slice(0, 10);
  const yesterdayDate = new Date(today);
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yesterday = yesterdayDate.toISOString().slice(0, 10);

  const streakCount = dbUser?.streakCount ?? 0;
  let streakStatus: 'today' | 'yesterday' | 'none' = 'none';
  if (dbUser?.lastQuizDate) {
    const lastDate = dbUser.lastQuizDate.toISOString().slice(0, 10);
    if (lastDate === today) streakStatus = 'today';
    else if (lastDate === yesterday) streakStatus = 'yesterday';
  }

  let weakCategory: HomepagePersonalization['weakCategory'] = null;
  if (categoryStats.length > 0) {
    const sorted = categoryStats
      .map((r) => ({ category: r.category, accuracy: Number(r.correctCount) / Number(r.attemptCount) }))
      .sort((a, b) => a.accuracy - b.accuracy);
    if (sorted[0].accuracy < 0.8) {
      weakCategory = {
        category: sorted[0].category,
        label: CATEGORY_LABEL[sorted[0].category] ?? sorted[0].category,
        accuracy: sorted[0].accuracy,
      };
    }
  }

  return { streak: { count: streakCount, status: streakStatus }, weakCategory };
}

export type ContributorEntry = {
  userId: string;
  nickname: string;
  approved: number;
};

export async function getTopContributors(): Promise<ContributorEntry[]> {
  const rows = await prisma.question.groupBy({
    by: ['authorId'],
    where: { authorId: { not: null }, status: { in: ['OFFICIAL', 'APPROVED'] } },
    _count: { id: true },
    orderBy: { _count: { id: 'desc' } },
    take: 5,
  });
  const authorIds = rows.map((r) => r.authorId!);
  const users = await prisma.user.findMany({
    where: { id: { in: authorIds } },
    select: { id: true, nickname: true },
  });
  const userMap = Object.fromEntries(users.map((u) => [u.id, u.nickname]));
  return rows
    .filter((r) => r.authorId && userMap[r.authorId])
    .map((r) => ({ userId: r.authorId!, nickname: userMap[r.authorId!] ?? '(알 수 없음)', approved: r._count.id }));
}

type OverallRawRow = {
  userId: string;
  nickname: string | null;
  attemptCount: number | bigint;
  correctCount: number | bigint;
};

export async function buildRankings(): Promise<CategoryRankings> {
  const [rows, overallRows] = await Promise.all([
    prisma.$queryRaw<RawRow[]>`
      WITH ranked AS (
        SELECT
          qa."userId",
          q.category,
          COUNT(*)::int AS "attemptCount",
          SUM(CASE WHEN qa."isCorrect" THEN 1 ELSE 0 END)::int AS "correctCount",
          u.nickname,
          ROW_NUMBER() OVER (
            PARTITION BY q.category
            ORDER BY
              (SUM(CASE WHEN qa."isCorrect" THEN 1 ELSE 0 END)::float / NULLIF(COUNT(*), 0)) DESC,
              COUNT(*) DESC
          ) AS rn
        FROM "QuestionAttempt" qa
        JOIN "Question" q ON qa."questionId" = q.id
        JOIN "User" u ON qa."userId" = u.id
        JOIN "QuizSession" qs ON qa."sessionId" = qs.id AND qs.mode != 'review'
        GROUP BY qa."userId", q.category, u.nickname
        HAVING COUNT(*) >= 10
      )
      SELECT "userId", category, "attemptCount", "correctCount", nickname
      FROM ranked
      WHERE rn <= 5
      ORDER BY category, rn
    `,
    prisma.$queryRaw<OverallRawRow[]>`
      WITH totals AS (
        SELECT
          qa."userId",
          u.nickname,
          COUNT(*)::int AS "attemptCount",
          SUM(CASE WHEN qa."isCorrect" THEN 1 ELSE 0 END)::int AS "correctCount",
          ROW_NUMBER() OVER (
            ORDER BY
              (SUM(CASE WHEN qa."isCorrect" THEN 1 ELSE 0 END)::float / NULLIF(COUNT(*), 0)) DESC,
              COUNT(*) DESC
          ) AS rn
        FROM "QuestionAttempt" qa
        JOIN "User" u ON qa."userId" = u.id
        JOIN "QuizSession" qs ON qa."sessionId" = qs.id AND qs.mode != 'review'
        GROUP BY qa."userId", u.nickname
        HAVING COUNT(*) >= 10
      )
      SELECT "userId", nickname, "attemptCount", "correctCount"
      FROM totals
      WHERE rn <= 5
      ORDER BY rn
    `,
  ]);

  const result = Object.fromEntries(
    (['overall', ...CATEGORIES] as const).map(cat => [cat, [] as RankEntry[]])
  ) as CategoryRankings;

  result.overall = overallRows.map((row, i) => ({
    rank: i + 1,
    userId: row.userId,
    nickname: row.nickname ?? '(닉네임 없음)',
    attemptCount: Number(row.attemptCount),
    accuracy: Number(row.correctCount) / Number(row.attemptCount),
  }));

  for (const cat of CATEGORIES) {
    result[cat] = rows
      .filter(r => r.category === cat)
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
