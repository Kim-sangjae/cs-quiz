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

export async function checkQuestionBadges(authorId: string): Promise<void> {
  const approvedCount = await prisma.question.count({
    where: { authorId, status: 'APPROVED' },
  });
  const candidates: BadgeType[] = [];
  if (approvedCount >= 1) candidates.push('APPROVED_1');
  if (approvedCount >= 5) candidates.push('APPROVED_5');
  if (approvedCount >= 10) candidates.push('APPROVED_10');
  await awardBadges(authorId, candidates);
}
