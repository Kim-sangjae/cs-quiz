import { NextResponse } from 'next/server';
import { getServerUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const user = await getServerUser();
  if (!user || user.role !== 'ADMIN') {
    return NextResponse.json({ total: 0, newTotal: 0, lastSeenAt: null });
  }

  const admin = await prisma.user.findUnique({
    where: { id: user.id },
    select: { adminLastSeenAt: true },
  });
  const lastSeenAt = admin?.adminLastSeenAt ?? null;
  const since = lastSeenAt ?? new Date(0);

  const [questions, reports, inquiries, userReports, newQuestions, newReports, newInquiries, newUserReports] = await Promise.all([
    prisma.question.count({ where: { status: 'PENDING' } }),
    prisma.report.groupBy({ by: ['questionId'], where: { status: 'PENDING' } }).then((r) => r.length),
    prisma.inquiry.count({ where: { status: 'PENDING', adminReply: null } }),
    prisma.userReport.count({ where: { status: 'PENDING' } }),
    prisma.question.count({ where: { status: 'PENDING', createdAt: { gt: since } } }),
    prisma.report.groupBy({ by: ['questionId'], where: { status: 'PENDING', createdAt: { gt: since } } }).then((r) => r.length),
    prisma.inquiry.count({ where: { status: 'PENDING', adminReply: null, createdAt: { gt: since } } }),
    prisma.userReport.count({ where: { status: 'PENDING', createdAt: { gt: since } } }),
  ]);

  return NextResponse.json({
    questions,
    reports,
    inquiries,
    userReports,
    total: questions + reports + inquiries + userReports,
    newTotal: newQuestions + newReports + newInquiries + userReports,
    lastSeenAt: lastSeenAt?.toISOString() ?? null,
  });
}
