export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    try {
      const { prisma } = await import('@/lib/prisma');
      const { count } = await prisma.gameRoom.updateMany({
        where: { status: 'PLAYING' },
        data: { status: 'FINISHED', consecutiveAllSkip: 999 },
      });
      if (count > 0) console.log(`[startup] 진행 중 배틀 ${count}개 무효화`);
    } catch {
      // DB 연결 실패 시 무시 (개발 환경 cold start 등)
    }
  }
}
