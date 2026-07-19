import { NextRequest, NextResponse } from 'next/server';
import { getServerUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { generateEmbedding, toVectorString } from '@/lib/embedding';
import { extractSearchTokens, rareTokenBoost, getSynonyms, buildSynonymLookup } from '@/lib/similar-search';

interface CandidateRow {
  id: string;
  question: string;
  category: string;
  sim: number;
  trgm: number;
}

export async function GET(req: NextRequest) {
  const user = await getServerUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const q = req.nextUrl.searchParams.get('q')?.trim() ?? '';
  if (q.length < 2) return NextResponse.json([]);

  try {
    const embedding = await generateEmbedding(q);
    const vectorStr = toVectorString(embedding);
    const tokens = extractSearchTokens(q);

    // 관리자가 추가한 동의어 그룹을 기본 사전과 합쳐서 사용
    const dbGroups = await prisma.synonymGroup.findMany({ include: { terms: true } });
    const lookup = buildSynonymLookup(dbGroups.map((g) => g.terms.map((t) => t.term)));

    // 코퍼스 내 각 토큰의 등장 빈도 (드문 토큰일수록 재정렬 시 더 큰 가중치)
    // 한/영 동의어(예: 트리거/trigger)로 등록된 표기는 모두 합쳐서 센다
    const corpusCounts: Record<string, number> = {};
    await Promise.all(
      tokens.map(async (t) => {
        corpusCounts[t] = await prisma.question.count({
          where: {
            OR: getSynonyms(t, lookup).map((s) => ({ question: { contains: s, mode: 'insensitive' as const } })),
            status: { in: ['OFFICIAL', 'APPROVED'] },
          },
        });
      })
    );

    // 후보군은 넉넉히 확보(임계값 낮춤) - 순수 벡터 유사도만으로는 "~의
    // 목적은 무엇인가?" 같은 흔한 질문 형식이 실제 주제보다 점수에 더 큰
    // 영향을 줘서, "트리거"처럼 드문 핵심 단어가 있는 진짜 관련 문제가
    // 벡터 임계값 밖으로 밀려나는 경우가 있음
    const candidates = await prisma.$queryRaw<CandidateRow[]>`
      SELECT id, question, category,
        CAST(1 - (embedding <=> ${vectorStr}::vector) AS FLOAT) AS sim,
        CAST(similarity(question, ${q}) AS FLOAT) AS trgm
      FROM "Question"
      WHERE status IN ('OFFICIAL', 'APPROVED')
        AND embedding IS NOT NULL
        AND 1 - (embedding <=> ${vectorStr}::vector) > 0.35
      LIMIT 100
    `;

    // 벡터 유사도 + 문자열 유사도 + 희귀 토큰 매칭 가중치를 합산해 재정렬
    const results = candidates
      .map((c) => ({
        id: c.id,
        question: c.question,
        category: c.category,
        sim: c.sim,
        score: c.sim * 0.5 + c.trgm * 0.2 + rareTokenBoost(c.question, tokens, corpusCounts, lookup) * 0.3,
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 10)
      .map(({ id, question, category, sim }) => ({ id, question, category, sim }));

    return NextResponse.json(results);
  } catch {
    return NextResponse.json([]);
  }
}
