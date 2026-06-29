import { config } from 'dotenv';
config({ path: '.env.local' });

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

// Seed uses DIRECT_URL (port 5432) to bypass pgbouncer restrictions
const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

async function main() {
  const count = await prisma.question.count({ where: { status: 'OFFICIAL' } });
  console.log(`✓ DB에 OFFICIAL 문제 ${count}개 확인됨. 별도 시딩 불필요.`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
