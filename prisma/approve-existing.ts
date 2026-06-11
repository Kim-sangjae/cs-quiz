import { config } from 'dotenv';
config({ path: '.env.local' });

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

async function main() {
  const admin = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
  if (!admin) {
    console.error('관리자 계정 없음. 먼저 Google 로그인 후 role을 ADMIN으로 변경하세요.');
    process.exit(1);
  }
  console.log(`관리자: ${admin.nickname ?? admin.email}`);

  const pending = await prisma.question.updateMany({
    where: { status: 'PENDING' },
    data: { status: 'APPROVED', authorId: admin.id },
  });
  console.log(`✓ PENDING → APPROVED: ${pending.count}개`);

  const approved = await prisma.question.updateMany({
    where: { status: 'APPROVED', authorId: null },
    data: { authorId: admin.id },
  });
  console.log(`✓ APPROVED authorId 설정: ${approved.count}개`);

  const official = await prisma.question.updateMany({
    where: { status: 'OFFICIAL', authorId: null },
    data: { authorId: admin.id },
  });
  console.log(`✓ OFFICIAL authorId 설정: ${official.count}개`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
