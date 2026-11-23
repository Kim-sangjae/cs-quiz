import nodemailer from 'nodemailer';
import { prisma } from '@/lib/prisma';

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
});

export async function sendMail({ to, subject, html }: { to: string; subject: string; html: string }) {
  await transporter.sendMail({
    from: `CSORA <${process.env.GMAIL_USER}>`,
    to,
    subject,
    html,
  });
}

export const ADMIN_EMAIL = () => process.env.ADMIN_EMAIL ?? process.env.GMAIL_USER ?? '';

// 신고/등록 알림처럼 "유저 요청은 성공시키되 메일은 실패해도 요청 자체를 막지 않는" 용도.
// await 없는 fire-and-forget(sendMail(...).catch(()=>{}))은 응답 전송 직후 서버리스 함수가
// 바로 정지되면 메일이 끝까지 안 나갈 수 있고, 실패해도 흔적이 전혀 안 남는 문제가 있어
// 반드시 await로 완료까지 기다리고, 실패 시 ErrorLog에 남겨 관리자 "오류 내역" 탭에서 보이게 함
export async function sendMailSafe(params: { to: string; subject: string; html: string; path?: string; userId?: string | null }) {
  try {
    await sendMail(params);
  } catch (err) {
    await prisma.errorLog.create({
      data: {
        userId: params.userId ?? null,
        errorCode: 'MAIL_SEND_FAILED',
        message: (err instanceof Error ? err.message : String(err)).slice(0, 500),
        path: params.path ?? null,
      },
    }).catch(() => {});
  }
}

// 유저 자유입력 텍스트를 이메일 HTML에 삽입하기 전 이스케이프
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
