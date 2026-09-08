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
  const questions = await prisma.$queryRaw<{ id: string; question: string; options: unknown; answer: number }[]>`
    SELECT id, question, options, answer FROM "Question"
    WHERE status IN ('OFFICIAL', 'APPROVED')
  `;

  let success = 0;
  let failed = 0;

  for (const q of questions) {
    try {
      // embedding: 실시간 입력 힌트용 — 문제 텍스트만
      const embedding = await generateEmbedding(q.question);
      const vectorStr = toVectorString(embedding);
      await prisma.$executeRaw`
        UPDATE "Question" SET embedding = ${vectorStr}::vector WHERE id = ${q.id}
      `;
      // embeddingFull: 관리자 승인 화면 2차검증용 — 문제+정답 결합
      const opts = q.options as string[];
      const answerText = opts?.[q.answer] ?? '';
      const embeddingFull = await generateEmbedding(answerText ? `${q.question} ${answerText}` : q.question);
      const vectorFullStr = toVectorString(embeddingFull);
      await prisma.$executeRaw`
        UPDATE "Question" SET "embeddingFull" = ${vectorFullStr}::vector WHERE id = ${q.id}
      `;
      success++;
    } catch {
      failed++;
    }
  }

  return NextResponse.json({ total: questions.length, success, failed });
}
