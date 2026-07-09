import { NextRequest, NextResponse } from 'next/server';
import { getServerUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { writeLog } from '@/lib/audit';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getServerUser();
  if (!user || user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json() as { action: unknown };
  const { action } = body;

  const VALID_ACTIONS = ['set-admin', 'set-user', 'deactivate', 'reactivate', 'reset-stats'];
  if (!VALID_ACTIONS.includes(action as string)) {
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  }

  if (id === user.id && (action === 'set-user' || action === 'deactivate')) {
    return NextResponse.json({ error: 'Cannot demote or deactivate yourself' }, { status: 400 });
  }

  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  if (action === 'set-admin' || action === 'set-user') {
    const newRole = action === 'set-admin' ? 'ADMIN' : 'USER';
    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id },
        data: { role: newRole, tokenVersion: { increment: 1 } },
      });
      await tx.notification.create({
        data: {
          userId: id,
          type: 'ROLE_CHANGED',
          payload: { newRole },
          actionUrl: null,
        },
      });
    });
    writeLog({ actorId: user.id, actorRole: user.role, action: 'USER_ROLE_CHANGE', targetType: 'User', targetId: id, payload: { targetEmail: target.email, newRole } });
  } else if (action === 'deactivate') {
    if (target.deletedAt !== null) {
      return NextResponse.json({ error: 'Already deactivated' }, { status: 409 });
    }
    await prisma.user.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        tokenVersion: { increment: 1 },
      },
    });
    writeLog({ actorId: user.id, actorRole: user.role, action: 'USER_DEACTIVATE', targetType: 'User', targetId: id, payload: { targetEmail: target.email } });
  } else if (action === 'reactivate') {
    if (target.deletedAt === null) {
      return NextResponse.json({ error: 'User is not deactivated' }, { status: 409 });
    }
    await prisma.user.update({
      where: { id },
      data: { deletedAt: null },
    });
    writeLog({ actorId: user.id, actorRole: user.role, action: 'USER_REACTIVATE', targetType: 'User', targetId: id, payload: { targetEmail: target.email } });
  } else if (action === 'reset-stats') {
    if (id === user.id) {
      return NextResponse.json({ error: 'Cannot reset your own stats' }, { status: 400 });
    }
    await prisma.$transaction([
      prisma.quizSession.deleteMany({ where: { userId: id } }),
      prisma.questionAttempt.deleteMany({ where: { userId: id } }),
      prisma.userBadge.deleteMany({ where: { userId: id } }),
      prisma.dailyChallengeCompletion.deleteMany({ where: { userId: id } }),
      prisma.pointTransaction.deleteMany({ where: { userId: id } }),
      prisma.weeklyGoalClaim.deleteMany({ where: { userId: id } }),
      prisma.reviewSchedule.deleteMany({ where: { userId: id } }),
      prisma.user.update({
        where: { id },
        data: { points: 0, streakCount: 0, lastQuizDate: null },
      }),
    ]);
    writeLog({ actorId: user.id, actorRole: user.role, action: 'USER_RESET_STATS', targetType: 'User', targetId: id, payload: { targetEmail: target.email, targetNickname: target.nickname } });
  }

  return NextResponse.json({ ok: true });
}
