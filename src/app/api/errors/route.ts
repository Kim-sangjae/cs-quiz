import { NextRequest, NextResponse } from 'next/server';
import { getServerUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      statusCode?: number;
      errorCode?: string;
      message?: string;
      path?: string;
      digest?: string;
      stack?: string;
    };

    const user = await getServerUser().catch(() => null);

    await prisma.errorLog.create({
      data: {
        userId: user?.id ?? null,
        statusCode: body.statusCode ?? null,
        errorCode: body.errorCode ? String(body.errorCode).slice(0, 100) : null,
        message: String(body.message ?? 'Unknown error').slice(0, 500),
        path: body.path ? String(body.path).slice(0, 500) : null,
        digest: body.digest ? String(body.digest).slice(0, 100) : null,
        stack: body.stack ? String(body.stack).slice(0, 5000) : null,
      },
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false });
  }
}
