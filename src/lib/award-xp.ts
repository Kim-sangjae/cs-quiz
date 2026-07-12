import { prisma } from './prisma';
import { XP_REWARDS } from './user-level';

// 대전 종료 시 승/무/패에 따라 양쪽에 경험치 지급 (무효 대전 제외 후 호출)
export async function awardBattleXp(
  hostId: string,
  guestId: string,
  hostScore: number,
  guestScore: number,
): Promise<void> {
  const hostXp =
    hostScore > guestScore ? XP_REWARDS.BATTLE_WIN
    : hostScore < guestScore ? XP_REWARDS.BATTLE_LOSS
    : XP_REWARDS.BATTLE_TIE;
  const guestXp =
    guestScore > hostScore ? XP_REWARDS.BATTLE_WIN
    : guestScore < hostScore ? XP_REWARDS.BATTLE_LOSS
    : XP_REWARDS.BATTLE_TIE;
  await prisma.$transaction([
    prisma.user.update({ where: { id: hostId }, data: { xp: { increment: hostXp } } }),
    prisma.user.update({ where: { id: guestId }, data: { xp: { increment: guestXp } } }),
  ]);
}
