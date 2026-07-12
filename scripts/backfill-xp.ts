/**
 * 기존 유저 XP 소급 백필 스크립트 (1회 실행)
 *
 * 과거 기록 기반으로 User.xp를 재계산해 덮어쓴다 (멱등):
 * - 퀴즈 세션(모든 모드): 10 + 정답당 1
 * - 오늘의 문제 완료: 20
 * - 승인된 등록 문제: 50
 * - 대전(무효 제외): 승 15 / 무 10 / 패 5
 *
 * 실행: npx tsx scripts/backfill-xp.ts
 */
import { config } from 'dotenv';
config({ path: '.env.local' });

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { XP_REWARDS } from '../src/lib/user-level';

const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

async function main() {
  const [users, sessions, dailies, approved, rooms] = await Promise.all([
    prisma.user.findMany({ select: { id: true, nickname: true } }),
    prisma.quizSession.findMany({ select: { userId: true, score: true } }),
    prisma.dailyChallengeCompletion.groupBy({ by: ['userId'], _count: { _all: true } }),
    prisma.question.groupBy({
      by: ['authorId'],
      where: { authorId: { not: null }, status: { in: ['APPROVED', 'OFFICIAL'] } },
      _count: { _all: true },
    }),
    prisma.gameRoom.findMany({
      where: { status: 'FINISHED', guestId: { not: null }, consecutiveAllSkip: { lt: 3 } },
      select: { hostId: true, guestId: true, hostScore: true, guestScore: true },
    }),
  ]);

  const xpMap = new Map<string, number>();
  const add = (id: string | null, amount: number) => {
    if (id) xpMap.set(id, (xpMap.get(id) ?? 0) + amount);
  };

  for (const s of sessions) add(s.userId, XP_REWARDS.QUIZ_BASE + s.score * XP_REWARDS.QUIZ_PER_CORRECT);
  for (const d of dailies) add(d.userId, d._count._all * XP_REWARDS.DAILY);
  for (const q of approved) add(q.authorId, q._count._all * XP_REWARDS.QUESTION_APPROVED);
  for (const r of rooms) {
    const hostXp =
      r.hostScore > r.guestScore ? XP_REWARDS.BATTLE_WIN
      : r.hostScore < r.guestScore ? XP_REWARDS.BATTLE_LOSS
      : XP_REWARDS.BATTLE_TIE;
    const guestXp =
      r.guestScore > r.hostScore ? XP_REWARDS.BATTLE_WIN
      : r.guestScore < r.hostScore ? XP_REWARDS.BATTLE_LOSS
      : XP_REWARDS.BATTLE_TIE;
    add(r.hostId, hostXp);
    add(r.guestId, guestXp);
  }

  console.log(`유저 ${users.length}명 XP 백필 시작\n`);
  for (const u of users) {
    const xp = xpMap.get(u.id) ?? 0;
    await prisma.user.update({ where: { id: u.id }, data: { xp } });
    console.log(`  ${u.nickname ?? u.id}: ${xp} XP`);
  }
  console.log('\n완료');
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
