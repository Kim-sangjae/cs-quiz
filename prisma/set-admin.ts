import { config } from 'dotenv';
config({ path: '.env.local' });

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

async function main() {
  const users = await prisma.user.findMany({
    select: { id: true, email: true, nickname: true, role: true },
  });

  if (users.length === 0) {
    console.log('유저 없음. 먼저 Google 로그인을 해주세요.');
    return;
  }

  console.log('현재 유저 목록:');
  users.forEach((u) => console.log(`  ${u.email} | ${u.nickname} | ${u.role}`));

  const email = process.argv[2];
  if (!email) {
    console.log('\n사용법: npx tsx prisma/set-admin.ts <email>');
    return;
  }

  const result = await prisma.user.update({
    where: { email },
    data: { role: 'ADMIN' },
  });
  console.log(`\n✓ ${result.email} → ADMIN 설정 완료`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
