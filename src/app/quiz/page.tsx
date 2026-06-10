import Link from "next/link";
import { getServerUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const CATEGORY_LABELS: Record<string, string> = {
  ds: "자료구조",
  algo: "알고리즘",
  os: "운영체제",
  network: "네트워크",
  db: "데이터베이스",
  arch: "컴퓨터 구조",
};

const CATEGORIES = ["ds", "algo", "os", "network", "db", "arch"] as const;

async function getCounts(): Promise<Record<string, number>> {
  const rows = await prisma.question.groupBy({
    by: ["category"],
    where: { status: { in: ["OFFICIAL", "APPROVED"] } },
    _count: { _all: true },
  });

  const counts: Record<string, number> = {
    all: 0,
    ds: 0,
    algo: 0,
    os: 0,
    network: 0,
    db: 0,
    arch: 0,
  };

  for (const row of rows) {
    const cat = row.category as string;
    const n = row._count._all;
    counts[cat] = n;
    counts.all += n;
  }

  return counts;
}

async function getUserAccuracy(
  userId: string
): Promise<Record<string, number | null>> {
  const result: Record<string, number | null> = {};
  for (const cat of CATEGORIES) {
    result[cat] = null;
  }
  result.all = null;

  const rows = await prisma.questionAttempt.groupBy({
    by: ["questionId"],
    where: { userId },
    _count: { _all: true },
    _sum: { isCorrect: true } as never,
  });

  if (rows.length === 0) return result;

  // Per-category accuracy from Question join
  const attempts = await prisma.questionAttempt.findMany({
    where: { userId },
    select: { isCorrect: true, question: { select: { category: true } } },
  });

  const catStats: Record<string, { total: number; correct: number }> = {};
  let allTotal = 0;
  let allCorrect = 0;

  for (const a of attempts) {
    const cat = a.question.category;
    if (!catStats[cat]) catStats[cat] = { total: 0, correct: 0 };
    catStats[cat].total++;
    if (a.isCorrect) catStats[cat].correct++;
    allTotal++;
    if (a.isCorrect) allCorrect++;
  }

  for (const cat of CATEGORIES) {
    const s = catStats[cat];
    result[cat] = s ? Math.round((s.correct / s.total) * 100) : null;
  }
  result.all = allTotal > 0 ? Math.round((allCorrect / allTotal) * 100) : null;

  return result;
}

export default async function QuizSelectPage() {
  const [counts, user] = await Promise.all([getCounts(), getServerUser()]);
  const accuracy = user ? await getUserAccuracy(user.id) : null;

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-semibold text-white mb-2">퀴즈 시작</h1>
      <p className="text-sm text-neutral-400 mb-8">
        카테고리를 선택하거나 전체 문제에서 랜덤으로 30문제를 풀어보세요.
      </p>

      {/* ALL 카드 */}
      <div className="mb-4">
        <QuizCard
          label="전체"
          cat="all"
          count={counts.all}
          accuracy={accuracy?.all ?? null}
          minRequired={30}
        />
      </div>

      {/* 카테고리 6개 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {CATEGORIES.map((cat) => (
          <QuizCard
            key={cat}
            label={CATEGORY_LABELS[cat]}
            cat={cat}
            count={counts[cat]}
            accuracy={accuracy?.[cat] ?? null}
            minRequired={10}
          />
        ))}
      </div>
    </div>
  );
}

function QuizCard({
  label,
  cat,
  count,
  accuracy,
  minRequired,
}: {
  label: string;
  cat: string;
  count: number;
  accuracy: number | null;
  minRequired: number;
}) {
  const disabled = count < minRequired;

  if (disabled) {
    return (
      <div className="bg-[#111111] border border-neutral-800 rounded-lg p-5 opacity-50 cursor-not-allowed">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-medium text-neutral-300">{label}</p>
            <p className="text-xs text-neutral-500 mt-1">{count}문제</p>
          </div>
          <span className="text-xs text-neutral-600 border border-neutral-800 rounded px-2 py-0.5">
            최소 {minRequired}개 필요
          </span>
        </div>
      </div>
    );
  }

  return (
    <Link
      href={`/quiz/play?category=${cat}`}
      className="block bg-[#111111] border border-neutral-800 rounded-lg p-5 hover:border-neutral-600 hover:bg-[#1a1a1a] transition-colors"
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-white">{label}</p>
          <p className="text-xs text-neutral-500 mt-1">{count}문제</p>
        </div>
        {accuracy !== null && (
          <span className="text-xs text-neutral-400 border border-neutral-800 rounded px-2 py-0.5">
            내 정답률 {accuracy}%
          </span>
        )}
      </div>
    </Link>
  );
}
