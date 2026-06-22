import { NextResponse } from 'next/server';
import { getServerUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const user = await getServerUser();
  if (!user || user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const reports = await prisma.report.findMany({
    select: {
      id: true,
      reason: true,
      description: true,
      questionId: true,
      status: true,
      createdAt: true,
      question: { select: { id: true, category: true, question: true, status: true } },
      reporter: { select: { nickname: true } },
    },
    orderBy: { createdAt: 'asc' },
  });

  const map = new Map<string, {
    question: typeof reports[number]['question'];
    reportCount: number;
    latestReportAt: string;
    dismissed: boolean;
    reports: typeof reports;
  }>();

  for (const report of reports) {
    const key = report.questionId;
    if (!map.has(key)) {
      map.set(key, {
        question: report.question,
        reportCount: 0,
        latestReportAt: report.createdAt.toISOString(),
        dismissed: false,
        reports: [],
      });
    }
    const entry = map.get(key)!;
    entry.reportCount += 1;
    entry.latestReportAt = report.createdAt.toISOString();
    entry.reports.push(report);
    if (report.status === 'PENDING') {
      entry.dismissed = false;
    }
  }

  // dismissed = 해당 문제의 모든 신고가 REVIEWED 상태인 경우
  for (const [, entry] of map) {
    entry.dismissed = entry.reports.every((r) => r.status === 'REVIEWED');
  }

  const grouped = Array.from(map.values()).sort((a, b) => b.reportCount - a.reportCount);

  return NextResponse.json(grouped);
}
