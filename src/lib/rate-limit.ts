import { NextRequest } from 'next/server';
import { prisma } from './prisma';

/**
 * key(액션+식별자, 예: `comment:{userId}`)에 대해 windowSeconds 동안 limit회를
 * 초과하면 true(차단)를 반환한다. 창이 지나면 자동으로 리셋된다.
 */
export async function isRateLimited(key: string, limit: number, windowSeconds: number): Promise<boolean> {
  const now = new Date();
  const windowStart = new Date(now.getTime() - windowSeconds * 1000);

  const existing = await prisma.rateLimit.findUnique({ where: { key } });

  if (!existing || existing.windowStart < windowStart) {
    await prisma.rateLimit.upsert({
      where: { key },
      create: { key, count: 1, windowStart: now },
      update: { count: 1, windowStart: now },
    });
    cleanupStaleRateLimits();
    return false;
  }

  if (existing.count >= limit) return true;

  await prisma.rateLimit.update({ where: { key }, data: { count: { increment: 1 } } });
  return false;
}

// 별도 크론 없이 테이블 크기를 억제하기 위해 낮은 확률로만 오래된 카운터 정리
function cleanupStaleRateLimits(): void {
  if (Math.random() > 0.01) return;
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  prisma.rateLimit.deleteMany({ where: { windowStart: { lt: oneHourAgo } } }).catch(() => {});
}

// Vercel/프록시 환경에서 클라이언트 IP 추출 (비로그인 요청 식별용)
export function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return req.headers.get('x-real-ip') ?? 'unknown';
}
