import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { generateEmbedding, toVectorString } from '@/lib/embedding';

interface SimilarRow {
  id: string;
  question: string;
  category: string;
  sim: number;
}

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q')?.trim() ?? '';
  if (q.length < 5) return NextResponse.json([]);

  try {
    const embedding = await generateEmbedding(q);
    const vectorStr = toVectorString(embedding);

    const results = await prisma.$queryRaw<SimilarRow[]>`
      SELECT id, question, category,
        CAST(1 - (embedding <=> ${vectorStr}::vector) AS FLOAT) AS sim
      FROM "Question"
      WHERE status IN ('OFFICIAL', 'APPROVED')
        AND embedding IS NOT NULL
        AND 1 - (embedding <=> ${vectorStr}::vector) > 0.5
      ORDER BY embedding <=> ${vectorStr}::vector
      LIMIT 3
    `;

    return NextResponse.json(results);
  } catch {
    return NextResponse.json([]);
  }
}
