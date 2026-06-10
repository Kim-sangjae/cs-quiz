import { NextResponse } from 'next/server';
import { buildRankings } from '@/lib/rankings';

export async function GET() {
  const rankings = await buildRankings();
  return NextResponse.json(rankings);
}
