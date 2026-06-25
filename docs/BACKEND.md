# 백엔드 / DB 규칙

## API 인증

- 모든 POST/PATCH: 세션 검증 → 미인증 401
- `/api/admin/*`: `role === 'ADMIN'` 추가 검증 → 미인증 403
- 인증 헬퍼: `getServerUser()` from `src/lib/auth.ts`

## Prisma

- **$transaction**: 퀴즈 제출 시 QuizSession + QuestionAttempt + Question 통계를 단일 트랜잭션으로
- **pgvector**: `Question.embedding` 컬럼은 Prisma가 `vector` 타입을 미지원 → `$queryRaw` / `$executeRaw`로 직접 SQL 작성 (`src/lib/embedding.ts`, `questions/similar`, `admin/questions/[id]`)
- **URL 관리**: `schema.prisma`에 `url`/`directUrl` 없음
  - `prisma.config.ts` → `datasource.url = process.env.DIRECT_URL` (마이그레이션용)
  - `src/lib/prisma.ts` → `new PrismaPg({ connectionString: process.env.DATABASE_URL })` (런타임)
- 스키마 변경 후: `npx prisma migrate dev` → `npx prisma generate`
- 실제 스키마: `prisma/schema.prisma` 참고

## DB 스키마 요약

> 전체 스키마는 `prisma/schema.prisma` 참고. 주요 모델만 기술.

| 모델 | 설명 |
|------|------|
| `User` | email, nickname, role(USER/ADMIN), tokenVersion, deletedAt(소프트딜리트), adminLastSeenAt(관리자 패널 마지막 방문), streakCount, lastQuizDate |
| `Question` | category, options(Json), answer(0-3), status(OFFICIAL/PENDING/APPROVED/REJECTED/BLINDED), rejectionReason, attemptCount/correctCount(역정규화), embedding(vector(1536)) |
| `QuizSession` | userId, category, questionIds(Json), answers(Json), score |
| `QuestionAttempt` | userId, questionId, sessionId, selected, isCorrect |
| `Like` | @@id([userId, questionId]) |
| `Report` | reason(INAPPROPRIATE/ERROR/DUPLICATE/OTHER), status(PENDING/REVIEWED) |
| `Notification` | type(QUESTION_APPROVED/QUESTION_REJECTED/ROLE_CHANGED/INQUIRY_REPLIED), payload(Json), isRead |
| `Inquiry` | userId, type(BUG_REPORT/ACCOUNT_ISSUE/CONTENT_ISSUE/SUGGESTION/OTHER), title, content, status(PENDING/IN_PROGRESS/RESOLVED), adminReply, repliedAt |
| `AuditLog` | actorId, actorRole, action(LOGIN/QUESTION_APPROVE/REJECT/BLIND 등), targetType, targetId, payload(Json) |
| `GameRoom` | hostId, guestId, status(WAITING/PLAYING/FINISHED), category, questionIds(Json), hostAnswers/guestAnswers(Json), currentQ, hostScore/guestScore, consecutiveAllSkip(연속 쌍방 스킵 카운트), questionStartedAt(문제 시작 시각), quitRequestBy |
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
DATABASE_URL=               # Supabase connection pooler (런타임)
DIRECT_URL=                 # Supabase direct connection (마이그레이션)
NEXTAUTH_SECRET=            # openssl rand -base64 32
NEXTAUTH_URL=               # http://localhost:3000 (dev) | 배포 시 실제 도메인 필수 (OG 이미지 URL 기준)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
OPENAI_API_KEY=             # 보기 자동 생성(gpt-4o-mini) + 유사 문제 임베딩(text-embedding-3-small)
NEXT_PUBLIC_KAKAO_APP_KEY=  # Kakao Developers JavaScript 앱 키 (공유 SDK, 무료)
NEXT_PUBLIC_SUPABASE_URL=   # Supabase 프로젝트 URL (브라우저 Realtime 구독용)
NEXT_PUBLIC_SUPABASE_ANON_KEY= # Supabase anon 키 (브라우저용, 공개 가능)
SUPABASE_SERVICE_ROLE_KEY=  # Supabase service role 키 (서버 전용, 절대 클라이언트 노출 금지)
```

> `NEXT_PUBLIC_KAKAO_APP_KEY`: [developers.kakao.com](https://developers.kakao.com) → 내 애플리케이션 → 앱 키 → JavaScript 키. 플랫폼에 배포 도메인 등록 필요.

- **.env.local 절대 커밋 금지**: `git add -A` 대신 파일 명시적 지정

## 주요 API 추가 이력

| 엔드포인트 | 변경 | 내용 |
|-----------|------|------|
| `GET /api/questions/[id]/like` | 추가 | 북마크 상태 조회 (`{ liked: boolean, likeCount: number }`) |
| `POST /api/admin/questions/bulk` | 추가 | 일괄 승인/거절/블라인드 |
| `POST /api/admin/reports/bulk` | 추가 | 일괄 무시/블라인드 |
| `POST /api/admin/inquiries/bulk` | 추가 | 일괄 상태 변경 |
| `POST /api/admin/users/bulk` | 추가 | 일괄 권한 변경/삭제 |
| `POST /api/battle/rooms` | 추가 | 대결방 생성 |
| `POST /api/battle/rooms/[id]/join` | 추가 | 대결 수락(게스트 입장) |
| `POST /api/battle/rooms/[id]/reject` | 추가 | 대결 거절 |
| `GET /api/battle/rooms/[id]` | 추가 | 방 상태 폴링 + 서버사이드 타임아웃 자동제출 |
| `POST /api/battle/rooms/[id]/answer` | 추가 | 답변 제출 + broadcast 발화 |
| `POST /api/battle/rooms/[id]/quit` | 추가 | 대결 중단 요청/확정 |

## Supabase Realtime Broadcast (대결 실시간 동기화)

- **유틸**: `src/lib/battle-broadcast.ts` — `broadcastBattleUpdate(roomId)` 호출 시 Supabase Realtime Broadcast로 양쪽 클라이언트에 "방 변경됨" 신호 발송
- **보안**: Broadcast는 신호만 전달(실제 GameRoom 데이터 미포함). 클라이언트는 신호 수신 후 인증된 `GET /api/battle/rooms/[id]`로 refetch → 데이터 노출 없음
- **Dashboard 설정 불필요**: Broadcast는 DB Replication 활성화 없이 동작 (postgres_changes와 다름)
- **Fallback**: Broadcast 실패 시 TanStack Query 폴링으로 fallback (일반 1s, 5초모드 500ms)
- **서버사이드 타임아웃**: `GET /api/battle/rooms/[id]`에서 `questionStartedAt + effectiveTimeoutMs` 경과 시 자동제출 처리 (`$transaction`으로 동시 업데이트 방지)
