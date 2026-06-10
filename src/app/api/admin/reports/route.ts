import { NextResponse } from 'next/server';
import { getServerUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const user = await getServerUser();
  if (!user || user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const reports = await prisma.report.findMany({
    where: { status: 'PENDING' },
    include: {
      question: {
        select: {
          id: true,
          category: true,
          question: true,
          status: true,
        },
      },
      reporter: { select: { nickname: true } },
    },
    orderBy: { createdAt: 'asc' },
  });

  // Group by questionId, sort by reportCount descending
  const map = new Map<string, {
    question: typeof reports[number]['question'];
    reportCount: number;
    reports: typeof reports;
  }>();

  for (const report of reports) {
    const key = report.questionId;
    if (!map.has(key)) {
      map.set(key, { question: report.question, reportCount: 0, reports: [] });
    }
    const entry = map.get(key)!;
    entry.reportCount += 1;
    entry.reports.push(report);
  }

  const grouped = Array.from(map.values()).sort((a, b) => b.reportCount - a.reportCount);

  return NextResponse.json(grouped);
}
