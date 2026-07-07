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
