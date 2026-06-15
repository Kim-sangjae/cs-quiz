import { NextResponse } from 'next/server';
import { getServerUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const user = await getServerUser();
  if (!user || user.role !== 'ADMIN') {
    return NextResponse.json({ total: 0 });
  }

  const [questions, reports, inquiries] = await Promise.all([
    prisma.question.count({ where: { status: 'PENDING' } }),
    prisma.report.groupBy({ by: ['questionId'], where: { status: 'PENDING' } }).then((r) => r.length),
    prisma.inquiry.count({ where: { status: 'PENDING' } }),
  ]);

  return NextResponse.json({ questions, reports, inquiries, total: questions + reports + inquiries });
}
