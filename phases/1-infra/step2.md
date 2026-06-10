# Step 2: onboarding-header

## 읽어야 할 파일

먼저 아래 파일들을 읽고 구조를 파악하라:

- `CLAUDE.md`
- `docs/ARCHITECTURE.md` → *v2 렌더링 전략*, *미들웨어* 섹션
- `docs/PRD.md` → *v2 기능 명세* → *4. 인증* 섹션
- `docs/UI_GUIDE.md` → 색상 팔레트, 안티패턴
- `src/lib/auth.ts` (step 1에서 생성)
- `src/lib/prisma.ts` (step 0에서 생성)
- `src/app/layout.tsx` (기존 파일)

## 작업

이 step은 공통 헤더, 닉네임 설정 온보딩 페이지, 닉네임 API를 구현한다.

### 1. `src/app/api/users/nickname/route.ts` 생성

```ts
// POST: 처음 닉네임 설정
// PATCH: 닉네임 변경
// 공통 검증: 2~12자, 영문/숫자/한글만 허용 (/^[a-zA-Z0-9가-힣]{2,12}$/)
// 중복 시 409 반환
// 성공 시 200
// 비로그인 시 401 반환
```

### 2. `src/app/providers.tsx` 생성

TanStack Query `QueryClientProvider` + NextAuth `SessionProvider`를 최상위에 래핑하는 Client Component:

```ts
'use client';
import { SessionProvider } from 'next-auth/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
// QueryClient 싱글턴 생성 (useState로 React 생명주기 연동)
```

패키지 설치:
```bash
npm install @tanstack/react-query
```

### 3. `src/app/layout.tsx` 업데이트

`Providers`와 `Header`를 children을 감싸도록 추가:

```tsx
import Providers from './providers';
import Header from '@/components/Header';

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <body>
        <Providers>
          <Header />
          {children}
        </Providers>
      </body>
    </html>
  );
}
```

### 4. `src/components/Header.tsx` 생성 (Client Component)

구성 요소:
- 왼쪽: `CS Quiz` 로고 → `/` 링크
- 가운데: `퀴즈` → `/quiz`, `게시판` → `/board` 링크
- 오른쪽:
  - 로그인 시: 닉네임 표시 → `/mypage` 링크 + 로그인/로그아웃 버튼
  - 비로그인 시: `로그인` 버튼 → `signIn('google')`

`useSession()`으로 세션 상태 읽기. UI_GUIDE.md 스타일 토큰 준수.

### 5. `src/app/auth/setup-nickname/page.tsx` 생성 (Client Component)

- 닉네임 입력 폼
- 입력 시 실시간 유효성 표시 (2~12자, 허용 문자)
- 제출 시 POST `/api/users/nickname`
- 409(중복) → "이미 사용 중인 닉네임입니다" 에러 메시지
- 성공 → `callbackUrl` 쿼리 파라미터로 이동, 없으면 `/`

### 6. `middleware.ts` 업데이트 (step 1에서 생성한 파일)

닉네임 미설정 체크를 실제로 동작하도록 구현:
- `session.user.nickname === null`이고, 현재 경로가 `/auth/setup-nickname`이 아닌 경우 → `/auth/setup-nickname?callbackUrl={현재경로}`

## Acceptance Criteria

```bash
npm run build   # 컴파일 에러 없음
```

## 검증 절차

1. `src/components/Header.tsx`, `src/app/auth/setup-nickname/page.tsx`, `src/app/api/users/nickname/route.ts`, `src/app/providers.tsx` 존재 확인
2. `src/app/layout.tsx`에 `Providers`와 `Header`가 포함되어 있는지 확인
3. `npm run build` — 컴파일 에러 없음 확인
4. 결과에 따라 `phases/1-infra/index.json`의 step 2 status 업데이트:
   - 성공 → `"status": "completed"`, `"summary": "공통 Header + TanStack Query Providers + 닉네임 설정 온보딩 페이지 구현 완료."`
   - 실패 → `"status": "error"`, `"error_message": "구체적 에러 내용"`

## 금지사항

- `Header.tsx`에서 Prisma를 직접 import하지 마라. 이유: Client Component에서 Prisma 사용 불가 (Node.js 모듈 포함). 세션 정보는 `useSession()`으로만 읽는다.
- `QueryClient`를 모듈 최상단에 `new QueryClient()`로 생성하지 마라. 이유: Next.js SSR 환경에서 요청 간 상태가 공유되어 버그가 발생한다. 반드시 `useState`로 생성하라.
- UI_GUIDE.md의 안티패턴 (blur, gradient-text, 보라색 등)을 사용하지 마라.
- 기존 테스트를 깨뜨리지 마라.
