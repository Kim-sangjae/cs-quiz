import { config } from 'dotenv';
config({ path: '.env.local' });

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

async function ensureFriendship(id1: string, id2: string) {
  const existing = await prisma.friendship.findFirst({
    where: { OR: [{ requesterId: id1, addresseeId: id2 }, { requesterId: id2, addresseeId: id1 }] },
  });
  if (existing) {
    if (existing.status !== 'ACCEPTED') {
      await prisma.friendship.update({ where: { id: existing.id }, data: { status: 'ACCEPTED' } });
      console.log(`✓ 친구 업데이트 (ACCEPTED): ${id1} ↔ ${id2}`);
    } else {
      console.log(`○ 이미 친구: ${id1} ↔ ${id2}`);
    }
    return;
  }
  await prisma.friendship.create({ data: { requesterId: id1, addresseeId: id2, status: 'ACCEPTED' } });
  console.log(`✓ 친구 생성: ${id1} ↔ ${id2}`);
}

async function main() {
  const admin = await prisma.user.findFirst({ where: { nickname: 'admin' } });
  const user11 = await prisma.user.findFirst({ where: { nickname: 'user11' } });

  if (!admin || !user11) {
    console.error('admin 또는 user11 계정을 찾을 수 없습니다.');
    process.exit(1);
  }

  // user12 생성 (없으면)
  let user12 = await prisma.user.findFirst({ where: { nickname: 'user12' } });
  if (!user12) {
    user12 = await prisma.user.create({
      data: { email: 'user12@dev.local', nickname: 'user12' },
    });
    console.log('✓ user12 생성:', user12.id);
  } else {
    console.log('○ user12 이미 존재:', user12.id);
  }

  // 3명 모두 친구 관계 설정
  await ensureFriendship(admin.id, user11.id);
  await ensureFriendship(admin.id, user12.id);
  await ensureFriendship(user11.id, user12.id);

  console.log('\n완료. 로그인 페이지에서 닉네임 "user12"로 dev 로그인하세요.');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
