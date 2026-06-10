# Step 1: auth-setup

## 읽어야 할 파일

먼저 아래 파일들을 읽고 인증 설계를 파악하라:

- `CLAUDE.md`
- `docs/ARCHITECTURE.md` → *미들웨어*, *환경 변수* 섹션
- `docs/ADR.md` → ADR-014
- `src/lib/prisma.ts` (step 0에서 생성)
- `prisma/schema.prisma` (step 0에서 생성)

## 작업

이 step은 NextAuth.js v5 Google 로그인과 라우트 보호 미들웨어를 구성한다.

### 1. 환경 변수 확인 (BLOCKED 조건)

`.env.local`에 아래 4개 키가 모두 있는지 확인하라:
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `NEXTAUTH_SECRET`
- `NEXTAUTH_URL`

하나라도 없으면 → `blocked` 처리:
- `blocked_reason`: "Google Cloud Console에서 OAuth 2.0 Client ID를 생성하고 `.env.local`에 GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET을 설정하라. NEXTAUTH_SECRET은 `openssl rand -base64 32` 명령으로 생성. NEXTAUTH_URL은 개발 환경에서 `http://localhost:3000`."

### 2. 패키지 설치

```bash
npm install next-auth@beta @auth/prisma-adapter
```

### 3. `src/lib/auth.ts` 생성

NextAuth v5 설정 파일:

```ts
import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';
import { PrismaAdapter } from '@auth/prisma-adapter';
import { prisma } from './prisma';

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers: [Google],
  session: { strategy: 'jwt' },
  callbacks: {
    jwt({ token, user }) { ... },   // user.id, user.nickname, user.role을 token에 저장
    session({ session, token }) { ... }, // token에서 session.user로 id, nickname, role 전달
  },
});

// 서버 컴포넌트 / API 라우트에서 사용하는 헬퍼
export async function getServerUser() { ... } // auth() 호출 후 session.user 반환, 없으면 null
```

session.user 타입에 `id`, `nickname`, `role` 필드를 포함시켜라.

### 4. `src/app/api/auth/[...nextauth]/route.ts` 생성

```ts
import { handlers } from '@/lib/auth';
export const { GET, POST } = handlers;
```

### 5. `src/types/next-auth.d.ts` 생성

```ts
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
```

### 6. Prisma schema에 NextAuth 모델 추가

NextAuth Prisma Adapter는 Account, Session, VerificationToken 모델이 필요하다.  
`prisma/schema.prisma`에 공식 NextAuth v5 Prisma Adapter 스키마 (`Account`, `Session`, `VerificationToken`)를 추가하고 User 모델에 `accounts`, `sessions` 관계를 추가하라.

추가 후 마이그레이션:
```bash
npx prisma generate
npx prisma migrate dev --name add-nextauth-models
```

### 7. `middleware.ts` 생성 (프로젝트 루트)

```ts
import { auth } from '@/lib/auth';

export default auth((req) => {
  // 보호 경로: /quiz/*, /quiz/play/*, /board/submit, /mypage/*, /settings, /admin
  // 1. 비로그인 → /api/auth/signin?callbackUrl=...
  // 2. 닉네임 미설정(session.user.nickname === null) → /auth/setup-nickname?callbackUrl=...
  //    단, /auth/setup-nickname 자체는 닉네임 체크에서 제외
  // 3. /admin → role !== 'ADMIN' → /
});

export const config = {
  matcher: ['/quiz/:path*', '/board/submit', '/mypage/:path*', '/settings', '/admin'],
};
```

## Acceptance Criteria

```bash
npm run build   # 컴파일 에러 없음
```

## 검증 절차

1. `src/lib/auth.ts`, `src/app/api/auth/[...nextauth]/route.ts`, `src/types/next-auth.d.ts`, `middleware.ts` 존재 확인
2. `npm run build` — 컴파일 에러 없음 확인
3. `prisma/schema.prisma` — Account, Session, VerificationToken 모델 추가 확인
4. 결과에 따라 `phases/1-infra/index.json`의 step 1 status 업데이트:
   - 성공 → `"status": "completed"`, `"summary": "NextAuth v5 Google Provider + Prisma Adapter 설정 완료. 미들웨어 라우트 보호 구성."`
   - BLOCKED → `"status": "blocked"`, `"blocked_reason": "구체적 사유"`
   - 실패 → `"status": "error"`, `"error_message": "구체적 에러 내용"`

## 금지사항

- NextAuth v4(`next-auth` non-beta) 문법을 사용하지 마라. 이유: App Router는 v5만 완전 지원. v4는 `pages/api/auth` 기반이다.
- `session: { strategy: 'database' }`로 변경하지 마라. 이유: JWT 전략이 Edge middleware와 호환된다.
- 미들웨어 matcher에 `/auth/:path*`를 포함하지 마라. 이유: 로그인 페이지 자체가 차단되어 무한 리다이렉트가 발생한다.
- 기존 테스트를 깨뜨리지 마라.
