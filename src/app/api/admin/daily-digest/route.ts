import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendMail, ADMIN_EMAIL } from '@/lib/mailer';

// GitHub Actions가 CRON_SECRET Bearer 토큰으로 호출
export async function POST(req: NextRequest) {
  const auth = req.headers.get('authorization');
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // KST 어제 날짜 범위 계산
  const KST = 9 * 60 * 60 * 1000;
  const nowKST = new Date(Date.now() + KST);
  const todayStr = nowKST.toISOString().slice(0, 10);
  const yesterdayStr = new Date(new Date(todayStr).getTime() - 86400000).toISOString().slice(0, 10);

  const start = new Date(`${yesterdayStr}T00:00:00+09:00`);
  const end = new Date(`${todayStr}T00:00:00+09:00`);

  const [
    visitCount,
    sessionCount,
    newUserCount,
    questionSubmitCount,
    battleCount,
    pendingQuestions,
    pendingReports,
    pendingInquiries,
    errorLogs,
    errorCount,
  ] = await Promise.all([
    // 어제 방문자 수 (DailyVisit date 컬럼은 "YYYY-MM-DD" string)
    prisma.dailyVisit.count({ where: { date: yesterdayStr } }),
    // 어제 퀴즈 세션 (QuizSession은 submittedAt 사용)
    prisma.quizSession.count({ where: { submittedAt: { gte: start, lt: end } } }),
    // 어제 신규 가입자
    prisma.user.count({ where: { createdAt: { gte: start, lt: end } } }),
    // 어제 문제 제출 (PENDING)
    prisma.question.count({ where: { status: 'PENDING', createdAt: { gte: start, lt: end } } }),
    // 어제 대결 게임
    prisma.gameRoom.count({ where: { createdAt: { gte: start, lt: end } } }),
    // 현재 처리 대기
    prisma.question.count({ where: { status: 'PENDING' } }),
    prisma.report.count({ where: { status: 'PENDING' } }),
    prisma.inquiry.count({ where: { status: 'PENDING' } }),
    // 어제 오류 상위 10건
    prisma.errorLog.findMany({
      where: { createdAt: { gte: start, lt: end } },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: { statusCode: true, errorCode: true, message: true, path: true, createdAt: true },
    }),
    prisma.errorLog.count({ where: { createdAt: { gte: start, lt: end } } }),
  ]);

  const errorRows = errorLogs.map(e => `
    <tr>
      <td style="padding:4px 10px;color:#aaa">${e.createdAt.toISOString().slice(11, 19)}</td>
      <td style="padding:4px 10px">${e.statusCode ?? '-'}</td>
      <td style="padding:4px 10px;color:#f87171">${e.errorCode ?? '-'}</td>
      <td style="padding:4px 10px;font-size:12px;max-width:300px;overflow:hidden">${e.path ?? ''}</td>
      <td style="padding:4px 10px;font-size:12px;max-width:280px;overflow:hidden">${(e.message ?? '').slice(0, 80)}</td>
    </tr>`).join('');

  const pendingBadge = (n: number, warn = 5) =>
    `<span style="color:${n >= warn ? '#f87171' : '#34d399'};font-weight:600">${n}건</span>`;

  const html = `
<!DOCTYPE html>
<html lang="ko">
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:24px;background:#0f0f0f;color:#e5e5e5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <div style="max-width:640px;margin:0 auto">
    <h2 style="margin:0 0 4px;color:#fff">CSORA 서비스 현황</h2>
    <p style="margin:0 0 24px;color:#888;font-size:14px">${yesterdayStr} (KST)</p>

    <h3 style="margin:0 0 10px;color:#a78bfa;font-size:15px;letter-spacing:.5px">📊 어제 활동</h3>
    <table style="width:100%;border-collapse:collapse;margin-bottom:24px;background:#1a1a1a;border-radius:8px;overflow:hidden">
      <tr><td style="padding:10px 16px;color:#888;width:160px">방문자</td><td style="padding:10px 16px;font-weight:600">${visitCount}명</td></tr>
      <tr style="background:#222"><td style="padding:10px 16px;color:#888">퀴즈 세션</td><td style="padding:10px 16px;font-weight:600">${sessionCount}건</td></tr>
      <tr><td style="padding:10px 16px;color:#888">신규 가입</td><td style="padding:10px 16px;font-weight:600">${newUserCount}명</td></tr>
      <tr style="background:#222"><td style="padding:10px 16px;color:#888">문제 제출</td><td style="padding:10px 16px;font-weight:600">${questionSubmitCount}건</td></tr>
      <tr><td style="padding:10px 16px;color:#888">1:1 대결</td><td style="padding:10px 16px;font-weight:600">${battleCount}건</td></tr>
    </table>

    <h3 style="margin:0 0 10px;color:#fbbf24;font-size:15px;letter-spacing:.5px">⏳ 처리 대기</h3>
    <table style="width:100%;border-collapse:collapse;margin-bottom:24px;background:#1a1a1a;border-radius:8px;overflow:hidden">
      <tr><td style="padding:10px 16px;color:#888;width:160px">승인 대기 문제</td><td style="padding:10px 16px">${pendingBadge(pendingQuestions)}</td></tr>
      <tr style="background:#222"><td style="padding:10px 16px;color:#888">미처리 신고</td><td style="padding:10px 16px">${pendingBadge(pendingReports)}</td></tr>
      <tr><td style="padding:10px 16px;color:#888">미처리 문의</td><td style="padding:10px 16px">${pendingBadge(pendingInquiries)}</td></tr>
    </table>

    <h3 style="margin:0 0 10px;color:#f87171;font-size:15px;letter-spacing:.5px">🚨 어제 오류 (${errorCount}건)</h3>
    ${errorCount === 0
      ? '<p style="color:#34d399;margin:0 0 24px">오류 없음 ✓</p>'
      : `<div style="overflow-x:auto;margin-bottom:24px">
        <table style="width:100%;border-collapse:collapse;background:#1a1a1a;border-radius:8px;overflow:hidden;font-size:13px">
          <thead>
            <tr style="background:#2a2a2a;color:#888">
              <th style="padding:8px 10px;text-align:left;font-weight:500">시각</th>
              <th style="padding:8px 10px;text-align:left;font-weight:500">상태코드</th>
              <th style="padding:8px 10px;text-align:left;font-weight:500">에러코드</th>
              <th style="padding:8px 10px;text-align:left;font-weight:500">경로</th>
              <th style="padding:8px 10px;text-align:left;font-weight:500">메시지</th>
            </tr>
          </thead>
          <tbody>${errorRows}</tbody>
        </table>
      </div>`}

    <div style="border-top:1px solid #333;padding-top:16px;margin-top:8px">
      <a href="${process.env.NEXTAUTH_URL ?? 'https://csora.com'}/admin" style="color:#6366f1;text-decoration:none;font-size:14px">관리자 패널 바로가기 →</a>
    </div>
  </div>
</body>
</html>`;

  await sendMail({
    to: ADMIN_EMAIL(),
    subject: `[CSORA] 서비스 현황 ${yesterdayStr}`,
    html,
  });

  return NextResponse.json({ ok: true, date: yesterdayStr });
}
