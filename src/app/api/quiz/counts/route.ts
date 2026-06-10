import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const rows = await prisma.question.groupBy({
    by: ["category"],
    where: { status: { in: ["OFFICIAL", "APPROVED"] } },
    _count: { _all: true },
  });

  const counts: Record<string, number> = {
    all: 0,
    ds: 0,
    algo: 0,
    os: 0,
    network: 0,
    db: 0,
    arch: 0,
  };

  for (const row of rows) {
    const cat = row.category as string;
    const n = row._count._all;
    counts[cat] = n;
    counts.all += n;
  }

  return NextResponse.json(counts);
}
