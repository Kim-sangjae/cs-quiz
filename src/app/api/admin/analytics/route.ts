import { NextRequest, NextResponse } from 'next/server';
import { getServerUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getKSTDateStr, getKSTMidnight } from '@/lib/kst';

function groupByKey(dates: string[], keyFn: (d: string) => string): Record<string, number> {
  const map: Record<string, number> = {};
  for (const d of dates) {
    const k = keyFn(d);
    map[k] = (map[k] ?? 0) + 1;
  }
  return map;
}

export async function GET(req: NextRequest) {
  const user = await getServerUser();
  if (!user || user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const period = (searchParams.get('period') ?? 'day') as 'day' | 'month' | 'year';
  const target = searchParams.get('target') ?? null;

  // 한국 기준(KST) 날짜 — 서버(Vercel)가 UTC로 돌아 new Date().toISOString()을 그대로
  // 쓰면 자정이 아니라 UTC 자정(=KST 오전 9시)에 "오늘"이 바뀌는 버그가 생김
  const today = getKSTDateStr();
  const twoMinutesAgo = new Date(Date.now() - 45 * 1000);

  let chartFrom: string;
  let chartTo: string;
  let keyFn: (date: string) => string;

  if (period === 'day') {
    chartFrom = new Date(Date.now() + 9 * 60 * 60 * 1000 - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    chartTo = today;
    keyFn = (date) => date;
  } else if (period === 'month') {
    const tm = target ?? today.slice(0, 7);
    const [y, m] = tm.split('-').map(Number);
    const lastDay = new Date(y, m, 0).getDate();
    chartFrom = `${tm}-01`;
    chartTo = `${tm}-${String(lastDay).padStart(2, '0')}`;
    keyFn = (date) => date;
  } else {
    const ty = target ?? today.slice(0, 4);
    chartFrom = `${ty}-01-01`;
    chartTo = `${ty}-12-31`;
    keyFn = (date) => date.slice(0, 7);
  }

  const [
    onlineNow,
    totalUsers,
    totalBattles,
    totalAttempts,
    questionStats,
    inquiryStats,
    pendingReports,
    reviewedReports,
    visitRows,
    sessionRows,
    categorySessions,
    newUsersInPeriod,
    todayVisitorRows,
    todayNewUserRows,
    chartNewUserRows,
    todayQuizRows,
  ] = await Promise.all([
    prisma.userPresence.count({ where: { lastSeenAt: { gte: twoMinutesAgo } } }),
    prisma.user.count({ where: { deletedAt: null } }),
    prisma.gameRoom.count({ where: { status: 'FINISHED' } }),
    prisma.quizSession.count(),
    prisma.question.groupBy({ by: ['status'], _count: { id: true } }),
    prisma.inquiry.groupBy({ by: ['status'], _count: { id: true } }),
    prisma.report.count({ where: { status: 'PENDING' } }),
    prisma.report.count({ where: { status: 'REVIEWED' } }),
    prisma.dailyVisit.findMany({
      where: { date: { gte: chartFrom, lte: chartTo } },
      select: { date: true },
    }),
    prisma.quizSession.findMany({
      where: {
        submittedAt: {
          gte: new Date(`${chartFrom}T00:00:00.000Z`),
          lte: new Date(`${chartTo}T23:59:59.999Z`),
        },
      },
      select: { submittedAt: true },
    }),
    prisma.quizSession.groupBy({
      by: ['category'],
      _count: { id: true },
      _avg: { score: true },
    }),
    // 기간 내 신규 가입자 수
    prisma.user.count({
      where: {
        createdAt: {
          gte: new Date(`${chartFrom}T00:00:00.000Z`),
          lte: new Date(`${chartTo}T23:59:59.999Z`),
        },
        deletedAt: null,
      },
    }),
    // 오늘 방문자 목록
    prisma.dailyVisit.findMany({
      where: { date: today },
      select: { user: { select: { nickname: true, email: true } } },
      orderBy: { userId: 'asc' },
    }),
    // 오늘 신규 가입자 목록 (KST 자정~자정)
    prisma.user.findMany({
      where: {
        createdAt: {
          gte: getKSTMidnight(),
          lt: getKSTMidnight(1),
        },
        deletedAt: null,
      },
      select: { nickname: true, email: true },
      orderBy: { createdAt: 'asc' },
    }),
    // 차트용 신규 가입자 (시계열)
    prisma.user.findMany({
      where: {
        createdAt: {
          gte: new Date(`${chartFrom}T00:00:00.000Z`),
          lte: new Date(`${chartTo}T23:59:59.999Z`),
        },
        deletedAt: null,
      },
      select: { createdAt: true },
    }),
    // 오늘 퀴즈 풀기 유저 목록 (KST 자정 기준)
    prisma.quizSession.findMany({
      where: { submittedAt: { gte: getKSTMidnight() } },
      select: { userId: true, user: { select: { nickname: true, email: true } } },
      orderBy: { submittedAt: 'asc' },
      take: 200,
    }),
  ]);

  const visitsByKey = groupByKey(visitRows.map((r) => r.date), keyFn);
  const attemptsByKey = groupByKey(
    sessionRows.map((r) => {
      // KST(UTC+9) 기준 날짜 계산
      const kst = new Date(r.submittedAt.getTime() + 9 * 60 * 60 * 1000);
      return kst.toISOString().slice(0, 10);
    }),
    keyFn
  );

  // 전체 범위 키 생성
  let allKeys: string[];
  if (period === 'year') {
    const ty = (target ?? today.slice(0, 4));
    allKeys = Array.from({ length: 12 }, (_, i) => `${ty}-${String(i + 1).padStart(2, '0')}`);
  } else {
    const rangeKeys: string[] = [];
    const cur = new Date(`${chartFrom}T00:00:00.000Z`);
    const end = new Date(`${chartTo}T00:00:00.000Z`);
    while (cur <= end) {
      rangeKeys.push(keyFn(cur.toISOString().slice(0, 10)));
      cur.setUTCDate(cur.getUTCDate() + 1);
    }
    allKeys = [...new Set(rangeKeys)].sort();
  }

  const chartVisits = allKeys.map((label) => ({ label, count: visitsByKey[label] ?? 0 }));
  const chartAttempts = allKeys.map((label) => ({ label, count: attemptsByKey[label] ?? 0 }));

  const newUsersByKey: Record<string, number> = {};
  for (const r of chartNewUserRows) {
    const kst = new Date(r.createdAt.getTime() + 9 * 60 * 60 * 1000);
    const k = keyFn(kst.toISOString().slice(0, 10));
    newUsersByKey[k] = (newUsersByKey[k] ?? 0) + 1;
  }
  const chartNewUsers = allKeys.map((label) => ({ label, count: newUsersByKey[label] ?? 0 }));

  const seenQuizUsers = new Set<string>();
  const todayQuizList: { nickname: string | null; email: string }[] = [];
  for (const r of todayQuizRows) {
    if (!seenQuizUsers.has(r.userId)) {
      seenQuizUsers.add(r.userId);
      todayQuizList.push({ nickname: r.user.nickname, email: r.user.email });
    }
  }

  const periodVisitors = period === 'day'
    ? visitsByKey[today] ?? 0
    : Object.values(visitsByKey).reduce((a, b) => a + b, 0);
  const periodAttempts = period === 'day'
    ? attemptsByKey[today] ?? 0
    : Object.values(attemptsByKey).reduce((a, b) => a + b, 0);

  const qMap = Object.fromEntries(questionStats.map((s) => [s.status, s._count.id]));
  const iMap = Object.fromEntries(inquiryStats.map((s) => [s.status, s._count.id]));

  const categoryStats = categorySessions.map((cs) => ({
    category: cs.category,
    attempts: cs._count.id,
  }));

  const todayVisitorList = todayVisitorRows.map((r) => ({
    nickname: r.user.nickname,
    email: r.user.email,
  }));

  const todayNewUserList = todayNewUserRows.map((r) => ({
    nickname: r.nickname,
    email: r.email,
  }));

  return NextResponse.json({
    onlineNow,
    periodVisitors,
    periodAttempts,
    newUsersInPeriod,
    totalUsers,
    totalBattles,
    totalAttempts,
    questionStats: {
      official: qMap.OFFICIAL ?? 0,
      approved: qMap.APPROVED ?? 0,
      pending: qMap.PENDING ?? 0,
      rejected: qMap.REJECTED ?? 0,
      blinded: qMap.BLINDED ?? 0,
    },
    inquiryStats: {
      pending: iMap.PENDING ?? 0,
      inProgress: iMap.IN_PROGRESS ?? 0,
      resolved: iMap.RESOLVED ?? 0,
    },
    reportStats: { pending: pendingReports, reviewed: reviewedReports },
    chartVisits,
    chartAttempts,
    chartNewUsers,
    categoryStats,
    todayVisitorList,
    todayNewUserList,
    todayQuizList,
  });
}
