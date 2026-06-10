import { DefaultSession } from 'next-auth';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      nickname: string | null;
      role: 'USER' | 'ADMIN';
    } & DefaultSession['user'];
  }
}
