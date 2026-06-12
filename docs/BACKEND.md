# 백엔드 / DB 규칙

## API 인증

- 모든 POST/PATCH: 세션 검증 → 미인증 401
- `/api/admin/*`: `role === 'ADMIN'` 추가 검증 → 미인증 403
- 인증 헬퍼: `getServerUser()` from `src/lib/auth.ts`

## Prisma

- **$transaction**: 퀴즈 제출 시 QuizSession + QuestionAttempt + Question 통계를 단일 트랜잭션으로
- **URL 관리**: `schema.prisma`에 `url`/`directUrl` 없음
  - `prisma.config.ts` → `datasource.url = process.env.DIRECT_URL` (마이그레이션용)
  - `src/lib/prisma.ts` → `new PrismaPg({ connectionString: process.env.DATABASE_URL })` (런타임)
- 스키마 변경 후: `npx prisma migrate dev` → `npx prisma generate`
- 실제 스키마: `prisma/schema.prisma` 참고

## DB 스키마 요약

> 전체 스키마는 `prisma/schema.prisma` 참고. 주요 모델만 기술.

| 모델 | 설명 |
|------|------|
| `User` | email, nickname, role(USER/ADMIN), tokenVersion, deletedAt(소프트딜리트) |
| `Question` | category, options(Json), answer(0-3), status(OFFICIAL/PENDING/APPROVED/REJECTED/BLINDED), attemptCount/correctCount(역정규화) |
| `QuizSession` | userId, category, questionIds(Json), answers(Json), score |
| `QuestionAttempt` | userId, questionId, sessionId, selected, isCorrect |
| `Like` | @@id([userId, questionId]) |
| `Report` | reason(INAPPROPRIATE/ERROR/DUPLICATE/OTHER), status(PENDING/REVIEWED) |
| `Notification` | type(QUESTION_APPROVED/QUESTION_REJECTED), payload(Json), isRead |
| `Account`, `Session`, `VerificationToken` | NextAuth PrismaAdapter 전용 |

**역정규화**: `Question.attemptCount`, `correctCount`는 퀴즈 제출 $transaction에서 원자적 업데이트.

## JWT / 세션 무효화

- `User.tokenVersion`: 권한 변경·탈퇴처리 시 `{ increment: 1 }` → 기존 토큰 즉시 무효화
- `User.deletedAt`: 소프트딜리트. JWT 콜백에서 `deletedAt !== null`이면 세션 null 반환
- `auth.ts` JWT 콜백: 매 서버사이드 `auth()` 호출마다 DB에서 tokenVersion·role·deletedAt 조회
- 미들웨어(`auth.config.ts`): Edge Runtime 제약으로 DB 미조회 — API 호출 시점에 무효화됨

## TanStack Query 사용 규칙

- 클라이언트 컴포넌트의 서버 데이터 fetching: `useQuery`, `useMutation`
- 서버 컴포넌트: `fetch()` 또는 Prisma 직접 호출 (TanStack Query 사용 안 함)
- 폴링 데이터(알림): `refetchInterval: 30_000`
- `QueryClientProvider`: `src/app/providers.tsx`에서 최상위 래핑

## 환경 변수

```
DATABASE_URL=          # Supabase connection pooler (런타임)
DIRECT_URL=            # Supabase direct connection (마이그레이션)
NEXTAUTH_SECRET=       # openssl rand -base64 32
NEXTAUTH_URL=          # http://localhost:3000 (dev)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
```

- **.env.local 절대 커밋 금지**: `git add -A` 대신 파일 명시적 지정
