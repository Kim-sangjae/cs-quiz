import nodemailer from 'nodemailer';

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

// 유저 자유입력 텍스트를 이메일 HTML에 삽입하기 전 이스케이프
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
