import { config } from 'dotenv';
config({ path: '.env.local' });

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { questions } from '../src/data/questions';

// Seed uses DIRECT_URL (port 5432) to bypass pgbouncer restrictions
const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('기존 OFFICIAL 문제 삭제 후 재삽입...');
  await prisma.question.deleteMany({ where: { status: 'OFFICIAL' } });

  const data = questions.map((q) => ({
    authorId: null,
    category: q.category,
    question: q.question,
    options: q.options,
    answer: q.answer,
    explanation: q.explanation,
    status: 'OFFICIAL' as const,
  }));

  await prisma.question.createMany({ data });
  console.log(`✓ ${data.length}개 문제 시딩 완료`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
