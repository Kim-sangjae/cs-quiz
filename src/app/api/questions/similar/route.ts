import { NextRequest, NextResponse } from 'next/server';
import { getServerUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { generateEmbedding, toVectorString } from '@/lib/embedding';

interface SimilarRow {
  id: string;
  question: string;
  category: string;
  sim: number;
}

export async function GET(req: NextRequest) {
  const user = await getServerUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const q = req.nextUrl.searchParams.get('q')?.trim() ?? '';
  if (q.length < 5) return NextResponse.json([]);

  try {
    const embedding = await generateEmbedding(q);
    const vectorStr = toVectorString(embedding);

    // 순수 벡터 유사도만 쓰면 "~의 목적은 무엇인가?" 같은 흔한 질문 형식이
    // 실제 주제(트리거 등)보다 더 큰 영향을 줘서 진짜 관련 문제가 밀려나는
    // 경우가 있어, pg_trgm 문자열 유사도(similarity)를 보조 지표로 섞어 재정렬
    const results = await prisma.$queryRaw<SimilarRow[]>`
      SELECT id, question, category,
        CAST(1 - (embedding <=> ${vectorStr}::vector) AS FLOAT) AS sim
      FROM "Question"
      WHERE status IN ('OFFICIAL', 'APPROVED')
        AND embedding IS NOT NULL
        AND 1 - (embedding <=> ${vectorStr}::vector) > 0.5
      ORDER BY (1 - (embedding <=> ${vectorStr}::vector)) * 0.7 + similarity(question, ${q}) * 0.3 DESC
      LIMIT 10
    `;

    return NextResponse.json(results);
  } catch {
    return NextResponse.json([]);
  }
}
