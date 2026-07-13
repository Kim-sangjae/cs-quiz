/**
 * XP·포인트 정합성 검증 스크립트
 *
 * 1) XP: 전체 기록으로 기대값 재계산 → User.xp와 비교 (라이브 지급 로직과 동일 공식)
 * 2) 포인트: PointTransaction delta 합계 → User.points와 비교
 *
 * 실행: npx tsx scripts/verify-xp.ts
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
  const [users, sessions, dailies, approved, rooms, pointSums] = await Promise.all([
    prisma.user.findMany({ select: { id: true, nickname: true, xp: true, points: true } }),
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
    prisma.pointTransaction.groupBy({ by: ['userId'], _sum: { delta: true } }),
  ]);

  const expected = new Map<string, number>();
  const add = (id: string | null, amount: number) => {
    if (id) expected.set(id, (expected.get(id) ?? 0) + amount);
  };
  for (const s of sessions) add(s.userId, XP_REWARDS.QUIZ_BASE + s.score * XP_REWARDS.QUIZ_PER_CORRECT);
  for (const d of dailies) add(d.userId, d._count._all * XP_REWARDS.DAILY);
  for (const q of approved) add(q.authorId, q._count._all * XP_REWARDS.QUESTION_APPROVED);
  for (const r of rooms) {
    add(r.hostId, r.hostScore > r.guestScore ? XP_REWARDS.BATTLE_WIN : r.hostScore < r.guestScore ? XP_REWARDS.BATTLE_LOSS : XP_REWARDS.BATTLE_TIE);
    add(r.guestId, r.guestScore > r.hostScore ? XP_REWARDS.BATTLE_WIN : r.guestScore < r.hostScore ? XP_REWARDS.BATTLE_LOSS : XP_REWARDS.BATTLE_TIE);
  }

  let xpOk = true;
  let pointsOk = true;
  console.log('=== XP 검증 (기대값 vs 실제) ===');
  for (const u of users) {
    const exp = expected.get(u.id) ?? 0;
    const match = exp === u.xp ? 'OK' : `MISMATCH (기대 ${exp})`;
    if (exp !== u.xp) xpOk = false;
    console.log(`  ${u.nickname ?? u.id}: xp=${u.xp} → ${match}`);
  }

  console.log('\n=== 포인트 검증 (거래 합계 vs 실제) ===');
  for (const u of users) {
    const sum = pointSums.find((p) => p.userId === u.id)?._sum.delta ?? 0;
    const match = sum === u.points ? 'OK' : `MISMATCH (거래합 ${sum})`;
    if (sum !== u.points) pointsOk = false;
    console.log(`  ${u.nickname ?? u.id}: points=${u.points} → ${match}`);
  }

  console.log(`\n결과: XP ${xpOk ? '정합' : '불일치 있음'} / 포인트 ${pointsOk ? '정합' : '불일치 있음'}`);
  if (!xpOk || !pointsOk) process.exitCode = 1;
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
