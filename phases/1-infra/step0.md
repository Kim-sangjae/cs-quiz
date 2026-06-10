# Step 0: db-schema

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `CLAUDE.md`
- `docs/ARCHITECTURE.md` → *v2: 풀스택 아키텍처* → *데이터베이스 스키마* 섹션
- `docs/ADR.md` → ADR-013, ADR-015, ADR-019

## 작업

이 step은 Prisma + Supabase 연결 기반을 구성한다.

### 1. 패키지 설치

```bash
npm install prisma @prisma/client
npx prisma init
```

`npx prisma init`이 생성한 `prisma/schema.prisma`와 `.env` 파일을 확인하라.

### 2. `.env.example` 생성

프로젝트 루트에 `.env.example`을 생성하라 (실제 값 없이 키만):

```bash
DATABASE_URL=
DIRECT_URL=
NEXTAUTH_SECRET=
NEXTAUTH_URL=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
```

### 3. 환경 변수 확인 (BLOCKED 조건)

`.env.local` 파일이 존재하고 `DATABASE_URL`과 `DIRECT_URL`이 비어있지 않은지 확인하라.

- 파일 없거나 두 값 중 하나라도 비어 있으면 → `blocked` 처리 후 즉시 중단
  - `blocked_reason`: "`.env.local`에 `DATABASE_URL`과 `DIRECT_URL`을 설정해야 한다. Supabase 프로젝트 Settings → Database → Connection string에서 획득. DATABASE_URL은 Transaction pooler URL, DIRECT_URL은 Session pooler(또는 Direct connection) URL."

### 4. `prisma/schema.prisma` 작성

`docs/ARCHITECTURE.md`의 *데이터베이스 스키마* 섹션에 정의된 Prisma 스키마를 그대로 구현하라.

파일 상단에 반드시 포함:
```prisma
datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}

generator client {
  provider = "prisma-client-js"
}
```

### 5. Prisma Client 생성 및 마이그레이션

```bash
npx prisma generate
npx prisma migrate dev --name init
```

마이그레이션 실패 시 에러 메시지를 `error_message`에 기록하고 `error` 처리하라.

### 6. `src/lib/prisma.ts` 생성

```ts
import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
```

이 패턴은 Next.js dev 모드 hot-reload 시 Prisma 연결이 중복 생성되는 것을 방지한다.

## Acceptance Criteria

```bash
npm run build   # 컴파일 에러 없음
```

## 검증 절차

1. `prisma/schema.prisma` — 7개 모델 (User, Question, QuizSession, QuestionAttempt, Like, Report, Notification)이 모두 정의되어 있는지 확인
2. `src/lib/prisma.ts` 존재 확인
3. `.env.example` 존재 및 6개 키 포함 확인
4. `npm run build` — 컴파일 에러 없음 확인
5. 결과에 따라 `phases/1-infra/index.json`의 step 0 status 업데이트:
   - 성공 → `"status": "completed"`, `"summary": "Prisma 스키마 7개 모델 + Supabase 연결 설정 완료. src/lib/prisma.ts 싱글턴 생성."`
   - BLOCKED → `"status": "blocked"`, `"blocked_reason": "구체적 사유"`
   - 실패 → `"status": "error"`, `"error_message": "구체적 에러 내용"`

## 금지사항

- `prisma/schema.prisma`에서 모델 이름이나 필드를 임의로 변경하지 마라. 이유: ARCHITECTURE.md 스키마와 일치해야 다음 step에서 타입이 충돌하지 않는다.
- `prisma generate` 없이 `@prisma/client`를 import하지 마라. 이유: 생성 전에는 타입이 없어 컴파일 에러가 발생한다.
- `.env`(prisma init이 생성한 파일)를 `.gitignore`에서 제외하지 마라. 이유: 실제 DB URL이 포함되면 유출 위험. `.env.local`에 실제 값을 넣어라.
- 기존 테스트를 깨뜨리지 마라.
