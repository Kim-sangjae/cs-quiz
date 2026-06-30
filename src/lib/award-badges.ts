import { prisma } from '@/lib/prisma';
import type { BadgeType } from '@/lib/badges';

export async function awardBadges(userId: string, candidates: BadgeType[]): Promise<void> {
  if (candidates.length === 0) return;
  const existing = await prisma.userBadge.findMany({
    where: { userId, badge: { in: candidates } },
    select: { badge: true },
  });
  const existingSet = new Set(existing.map((e) => e.badge));
  const toCreate = candidates.filter((b) => !existingSet.has(b));
  for (const badge of toCreate) {
    await prisma.userBadge.create({ data: { userId, badge } });
    await prisma.notification.create({
      data: { userId, type: 'BADGE_EARNED', payload: { badge }, actionUrl: '/mypage' },
    });
  }
}

export async function checkBattleBadges(hostId: string, guestId: string): Promise<void> {
  for (const userId of [hostId, guestId]) {
    const rooms = await prisma.gameRoom.findMany({
      where: {
        status: 'FINISHED',
        consecutiveAllSkip: { lt: 3 }, // void 제외
        OR: [{ hostId: userId }, { guestId: userId }],
      },
      select: { hostId: true, hostScore: true, guestScore: true },
    });
    const wins = rooms.filter((r) => {
      const myScore = r.hostId === userId ? r.hostScore : (r.guestScore ?? 0);
      const oppScore = r.hostId === userId ? (r.guestScore ?? 0) : r.hostScore;
      return myScore > oppScore;
    }).length;
    const candidates: BadgeType[] = [];
    if (rooms.length >= 1) candidates.push('BATTLE_FIRST');
    if (wins >= 1) candidates.push('BATTLE_WIN_1');
    if (wins >= 10) candidates.push('BATTLE_WIN_10');
    if (wins >= 30) candidates.push('BATTLE_WIN_30');
    await awardBadges(userId, candidates);
  }
}

export async function checkQuestionBadges(authorId: string): Promise<void> {
  const approvedCount = await prisma.question.count({
    where: { authorId, status: 'APPROVED' },
  });
  const candidates: BadgeType[] = [];
  if (approvedCount >= 1) candidates.push('APPROVED_1');
  if (approvedCount >= 5) candidates.push('APPROVED_5');
  if (approvedCount >= 10) candidates.push('APPROVED_10');
  if (approvedCount >= 20) candidates.push('APPROVED_20');
  await awardBadges(authorId, candidates);
}
