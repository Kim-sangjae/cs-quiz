/**
 * 배포 전 개발 데이터 초기화 스크립트
 *
 * 유지: Question 내용, User 계정, Account/Session(NextAuth), BlockedWord
 * 초기화: 퀴즈 기록, 북마크, 랭킹, 포인트, 업적, 대결, 채팅, 알림, 감사로그 등
 */
import { config } from 'dotenv';
config({ path: '.env.local' });

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('⚠️  개발 데이터 초기화 시작...\n');

  await prisma.$transaction(async (tx) => {
    // FK 의존 순서대로 삭제

    const commentReports = await tx.commentReport.deleteMany({});
    console.log(`  댓글 신고: ${commentReports.count}개 삭제`);

    const comments = await tx.questionComment.deleteMany({});
    console.log(`  댓글: ${comments.count}개 삭제`);

    const notes = await tx.questionNote.deleteMany({});
    console.log(`  문제 노트: ${notes.count}개 삭제`);

    const reviews = await tx.reviewSchedule.deleteMany({});
    console.log(`  오답복습 스케줄: ${reviews.count}개 삭제`);

    const weeklyClaims = await tx.weeklyGoalClaim.deleteMany({});
    console.log(`  주간 목표 클레임: ${weeklyClaims.count}개 삭제`);

    const points = await tx.pointTransaction.deleteMany({});
    console.log(`  포인트 내역: ${points.count}개 삭제`);

    const badges = await tx.userBadge.deleteMany({});
    console.log(`  뱃지: ${badges.count}개 삭제`);

    const chats = await tx.chatMessage.deleteMany({});
    console.log(`  채팅: ${chats.count}개 삭제`);

    const userReports = await tx.userReport.deleteMany({});
    console.log(`  유저 신고: ${userReports.count}개 삭제`);

    const auditLogs = await tx.auditLog.deleteMany({});
    console.log(`  감사 로그: ${auditLogs.count}개 삭제`);

    const errorLogs = await tx.errorLog.deleteMany({});
    console.log(`  에러 로그: ${errorLogs.count}개 삭제`);

    const challengeCompletions = await tx.dailyChallengeCompletion.deleteMany({});
    console.log(`  데일리 챌린지 기록: ${challengeCompletions.count}개 삭제`);

    const challengeStats = await tx.dailyChallengeStat.deleteMany({});
    console.log(`  데일리 챌린지 통계: ${challengeStats.count}개 삭제`);

    const visits = await tx.dailyVisit.deleteMany({});
    console.log(`  방문 기록: ${visits.count}개 삭제`);

    const presences = await tx.userPresence.deleteMany({});
    console.log(`  접속 현황: ${presences.count}개 삭제`);

    const notifications = await tx.notification.deleteMany({});
    console.log(`  알림: ${notifications.count}개 삭제`);

    const friendships = await tx.friendship.deleteMany({});
    console.log(`  친구 관계: ${friendships.count}개 삭제`);

    const gameRooms = await tx.gameRoom.deleteMany({});
    console.log(`  대결방: ${gameRooms.count}개 삭제`);

    const inquiries = await tx.inquiry.deleteMany({});
    console.log(`  문의: ${inquiries.count}개 삭제`);

    const reports = await tx.report.deleteMany({});
    console.log(`  문제 신고: ${reports.count}개 삭제`);

    // QuestionAttempt → QuizSession 순서 (FK 의존)
    const attempts = await tx.questionAttempt.deleteMany({});
    console.log(`  문제 시도 기록: ${attempts.count}개 삭제`);

    const likes = await tx.like.deleteMany({});
    console.log(`  북마크: ${likes.count}개 삭제`);

    const folders = await tx.bookmarkFolder.deleteMany({});
    console.log(`  북마크 폴더: ${folders.count}개 삭제`);

    const sessions = await tx.quizSession.deleteMany({});
    console.log(`  퀴즈 세션: ${sessions.count}개 삭제`);

    // User 통계 필드 초기화 (계정은 유지)
    const users = await tx.user.updateMany({
      data: { points: 0, streakCount: 0, lastQuizDate: null },
    });
    console.log(`  유저 통계 초기화: ${users.count}명`);

    // Question 통계 초기화 (문제 내용은 유지)
    const questions = await tx.question.updateMany({
      data: { attemptCount: 0, correctCount: 0 },
    });
    console.log(`  문제 통계 초기화: ${questions.count}개`);
  });

  console.log('\n✅ 초기화 완료');
  console.log('   유지: Question 내용, User 계정, BlockedWord');
}

main()
  .catch((e) => { console.error('❌ 오류:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
