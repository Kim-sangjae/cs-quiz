import { NextResponse } from 'next/server';
import { getServerUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { generateEmbedding, toVectorString } from '@/lib/embedding';

export async function POST() {
  const user = await getServerUser();
  if (!user || user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // 임베딩을 전부 재생성하기 위해 NULL 조건 제거
  const questions = await prisma.$queryRaw<{ id: string; question: string }[]>`
    SELECT id, question FROM "Question"
    WHERE status IN ('OFFICIAL', 'APPROVED')
  `;

  let success = 0;
  let failed = 0;

  for (const q of questions) {
    try {
      // 검색 시점(사용자가 입력 중인 문제 텍스트만)과 인코딩을 맞추기 위해 문제 텍스트만 사용
      const embedding = await generateEmbedding(q.question);
      const vectorStr = toVectorString(embedding);
      await prisma.$executeRaw`
        UPDATE "Question" SET embedding = ${vectorStr}::vector WHERE id = ${q.id}
      `;
      success++;
    } catch {
      failed++;
    }
  }

  return NextResponse.json({ total: questions.length, success, failed });
}
