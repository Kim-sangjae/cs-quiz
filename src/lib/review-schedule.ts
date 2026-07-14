import { prisma } from './prisma';
import { getKSTMidnight } from './kst';

const INTERVALS = [1, 3, 7, 30]; // days per step

function daysFromNow(n: number): Date {
  return getKSTMidnight(n);
}

export async function updateReviewSchedules(
  userId: string,
  answers: { questionId: string; isCorrect: boolean }[]
): Promise<void> {
  for (const { questionId, isCorrect } of answers) {
    if (!isCorrect) {
      await prisma.reviewSchedule.upsert({
        where: { userId_questionId: { userId, questionId } },
        update: { step: 0, nextReviewAt: daysFromNow(INTERVALS[0]) },
        create: { userId, questionId, step: 0, nextReviewAt: daysFromNow(INTERVALS[0]) },
      });
    } else {
      const existing = await prisma.reviewSchedule.findUnique({
        where: { userId_questionId: { userId, questionId } },
      });
      if (!existing) continue;
      if (existing.step >= INTERVALS.length - 1) {
        await prisma.reviewSchedule.delete({
          where: { userId_questionId: { userId, questionId } },
        });
      } else {
        const nextStep = existing.step + 1;
        await prisma.reviewSchedule.update({
          where: { userId_questionId: { userId, questionId } },
          data: { step: nextStep, nextReviewAt: daysFromNow(INTERVALS[nextStep]) },
        });
      }
    }
  }
}
