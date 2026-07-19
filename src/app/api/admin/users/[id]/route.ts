import { NextRequest, NextResponse } from 'next/server';
import { getServerUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { writeLog } from '@/lib/audit';
import { totalXpForLevel, MAX_LEVEL } from '@/lib/user-level';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getServerUser();
  if (!user || user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json() as { action: unknown; level?: unknown };
  const { action, level } = body;

  const VALID_ACTIONS = ['set-admin', 'set-user', 'deactivate', 'reactivate', 'reset-stats', 'set-level'];
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
    // FK 제약 준수: QuestionAttempt(→QuizSession) 먼저 삭제
    await prisma.$transaction([
      prisma.questionAttempt.deleteMany({ where: { userId: id } }),
      prisma.quizSession.deleteMany({ where: { userId: id } }),
      prisma.userBadge.deleteMany({ where: { userId: id } }),
      prisma.dailyChallengeCompletion.deleteMany({ where: { userId: id } }),
      prisma.pointTransaction.deleteMany({ where: { userId: id } }),
      prisma.weeklyGoalClaim.deleteMany({ where: { userId: id } }),
      prisma.reviewSchedule.deleteMany({ where: { userId: id } }),
      prisma.user.update({
        where: { id },
        data: { points: 0, xp: 0, streakCount: 0, lastQuizDate: null },
      }),
    ]);
    writeLog({ actorId: user.id, actorRole: user.role, action: 'USER_RESET_STATS', targetType: 'User', targetId: id, payload: { targetEmail: target.email, targetNickname: target.nickname } });
  } else if (action === 'set-level') {
    const targetLevel = typeof level === 'number' ? Math.floor(level) : NaN;
    if (!Number.isFinite(targetLevel) || targetLevel < 1 || targetLevel > MAX_LEVEL) {
      return NextResponse.json({ error: `레벨은 1~${MAX_LEVEL} 사이여야 합니다` }, { status: 400 });
    }
    const xp = totalXpForLevel(targetLevel);
    await prisma.user.update({ where: { id }, data: { xp } });
    writeLog({ actorId: user.id, actorRole: user.role, action: 'USER_SET_LEVEL', targetType: 'User', targetId: id, payload: { targetEmail: target.email, targetNickname: target.nickname, level: targetLevel, xp } });
  }

  return NextResponse.json({ ok: true });
}

// 계정 완전 삭제 (비활성화와 달리 되돌릴 수 없음). QuizSession/QuestionAttempt/Notification/
// Like/Inquiry/Report/hostedRooms는 User FK가 RESTRICT라 명시적으로 먼저 지워야 함.
// 작성한 문제(Question.authorId)/댓글 등은 SET NULL 또는 CASCADE로 DB가 자동 처리.
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getServerUser();
  if (!user || user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;
  if (id === user.id) {
    return NextResponse.json({ error: 'Cannot delete yourself' }, { status: 400 });
  }

  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  await prisma.$transaction([
    prisma.questionAttempt.deleteMany({ where: { userId: id } }),
    prisma.quizSession.deleteMany({ where: { userId: id } }),
    prisma.notification.deleteMany({ where: { userId: id } }),
    prisma.like.deleteMany({ where: { userId: id } }),
    prisma.inquiry.deleteMany({ where: { userId: id } }),
    prisma.report.deleteMany({ where: { reporterId: id } }),
    prisma.gameRoom.deleteMany({ where: { hostId: id } }),
    prisma.user.delete({ where: { id } }),
  ]);

  writeLog({
    actorId: user.id,
    actorRole: user.role,
    action: 'USER_DELETE',
    targetType: 'User',
    targetId: id,
    payload: { targetEmail: target.email, targetNickname: target.nickname },
  });

  return NextResponse.json({ ok: true });
}
