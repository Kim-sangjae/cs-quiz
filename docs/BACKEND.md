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
| `User` | email, nickname, role(USER/ADMIN), tokenVersion, deletedAt(소프트딜리트), adminLastSeenAt, streakCount, lastQuizDate, points, xp(유저 레벨 경험치), profileVisibility(PUBLIC/FRIENDS_ONLY/PRIVATE), bio |
| `Question` | category, options(Json), answer(0-3), status(OFFICIAL/PENDING/APPROVED/REJECTED/BLINDED), rejectionReason, attemptCount/correctCount(역정규화), embedding(vector(1536)) |
| `QuizSession` | userId, category, questionIds(Json), answers(Json), score, mode(`normal\|review\|timed`, default `normal`) |
| `QuestionAttempt` | userId, questionId, sessionId, selected, isCorrect |
| `Like` | @@id([userId, questionId]), folderId(BookmarkFolder FK, nullable) — 북마크와 통합 |
| `BookmarkFolder` | userId, name — 북마크 폴더 |
| `QuestionNote` | @@id([userId, questionId]), content — 개인 메모 |
| `Report` | reason(INAPPROPRIATE/ERROR/DUPLICATE/OTHER), status(PENDING/REVIEWED) — 문제 신고 |
| `UserReport` | reporterId, reportedId, reason(INAPPROPRIATE_NICKNAME/HARASSMENT/SPAM/OTHER) — 유저 신고 |
| `QuestionComment` | userId, questionId, content, blinded, deletedAt |
| `CommentReport` | reporterId, commentId, reason(INAPPROPRIATE/SPAM/HARASSMENT/OTHER) |
| `Notification` | type(QUESTION_APPROVED/REJECTED/ROLE_CHANGED/INQUIRY_REPLIED/LEVEL_UP/BADGE_EARNED/FRIEND_REQUEST/FRIEND_ACCEPTED/BATTLE_INVITE 등), payload(Json), isRead |
| `Inquiry` | userId, type(BUG_REPORT/ACCOUNT_ISSUE/CONTENT_ISSUE/SUGGESTION/OTHER), title, content, status(PENDING/IN_PROGRESS/RESOLVED), adminReply, repliedAt |
| `AuditLog` | actorId, actorRole, action(LOGIN/QUESTION_APPROVE/REJECT/BLIND 등), targetType, targetId, payload(Json) |
| `ErrorLog` | userId, statusCode, errorCode, message, path, digest |
| `GameRoom` | hostId, guestId, status(WAITING/PLAYING/FINISHED), category, questionIds(Json), hostAnswers/guestAnswers(Json), currentQ, hostScore/guestScore, consecutiveAllSkip(연속 쌍방 스킵 카운트), questionStartedAt(문제 시작 시각), quitRequestBy |
| `Friendship` | requesterId, addresseeId, status(PENDING/ACCEPTED/REJECTED) |
| `UserPresence` | @@id(userId), lastSeenAt, isPlayingQuiz — 온라인 상태 |
| `ChatMessage` | senderId, receiverId, content, hiddenBySender/hiddenByReceiver(개인별 숨김, 양쪽 숨김 시 하드삭제) — 1:1 채팅 기록 |
| `ReviewSchedule` | userId, questionId, step(0~4), nextReviewAt — 오답 복습 스케줄 |
| `UserBadge` | userId, badge(BadgeType enum), earnedAt |
| `DailyChallengeCompletion` | @@id([userId, date]) — 오늘의 문제 완료 기록 (출석 달력용) |
| `DailyVisit` | @@id([userId, date]) — 일일 방문 기록 |
| `DailyChallengeStat` | date(PK), questionId, attemptCount, correctCount |
| `PointTransaction` | userId, delta, reason — 포인트 증감 내역 |
| `WeeklyGoalClaim` | @@unique([userId, goalKey]) — 주간 목표 보상 수령 내역 |
| `BlockedWord` | word(unique), createdBy — 관리자 커스텀 금칙어 |
| `Account`, `Session`, `VerificationToken` | NextAuth PrismaAdapter 전용 |

**역정규화**: `Question.attemptCount`, `correctCount`는 퀴즈 제출 $transaction에서 원자적 업데이트.

**퀴즈 모드 정책**:

| mode | 랭킹 반영 | 뱃지/레벨업 | 연속출석 |
|------|----------|-----------|---------|
| `normal` | O | O | O |
| `timed` | O | O | O |
| `review` | X | X | X |

`isRanked = mode !== 'review'`로 판단. 뱃지 카운트 쿼리도 `mode: { in: ['normal', 'timed'] }` 필터 적용.

**유저 레벨(XP) 시스템** (`src/lib/user-level.ts` 순수 함수 / `src/lib/award-xp.ts` 대전 지급 헬퍼):

| 지급 지점 | 경험치 | 위치 |
|-----------|--------|------|
| 퀴즈 완료 (모든 모드, review 포함) | 10 + 정답당 1 | `api/quiz/sessions` POST |
| 오늘의 문제 완료 (하루 1회) | 20 | `api/daily` POST |
| 등록 문제 승인 | 50 | `api/admin/questions/[id]` approve 트랜잭션 |
| 대전 승/무/패 (무효 제외) | 15 / 10 / 5 | battle answer·GET 타임아웃 FINISHED 전환 시 `awardBattleXp` |

- 레벨 곡선: 필요 XP = `150 + (레벨-1)×10`, 최대 Lv.200. 레벨은 `User.xp`에서 `getLevelInfo()`로 파생 (별도 level 컬럼 없음)
- 소급 백필: `npx tsx scripts/backfill-xp.ts` (멱등 — 전체 기록 기반 재계산 후 SET)

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
KAKAO_CLIENT_ID=            # 카카오 로그인 REST API 키 (NextAuth Provider)
KAKAO_CLIENT_SECRET=        # 카카오 로그인 보안 코드
OPENAI_API_KEY=             # 보기 자동 생성(gpt-4o-mini) + 유사 문제 임베딩(text-embedding-3-small) + 관리자 AI 문제생성(gpt-4o, 배치)
NEXT_PUBLIC_KAKAO_APP_KEY=  # Kakao Developers JavaScript 앱 키 (공유 SDK, 무료)
NEXT_PUBLIC_SUPABASE_URL=   # Supabase 프로젝트 URL (브라우저 Realtime 구독용)
NEXT_PUBLIC_SUPABASE_ANON_KEY= # Supabase anon 키 (브라우저용, 공개 가능)
SUPABASE_SERVICE_ROLE_KEY=  # Supabase service role 키 (서버 전용, 절대 클라이언트 노출 금지)
```

> `NEXT_PUBLIC_KAKAO_APP_KEY`: [developers.kakao.com](https://developers.kakao.com) → 내 애플리케이션 → 앱 키 → JavaScript 키. 플랫폼에 배포 도메인 등록 필요.

- **.env.local 절대 커밋 금지**: `git add -A` 대신 파일 명시적 지정

## Supabase Realtime Broadcast 패턴

서버에서 신호 발신 → 클라이언트가 인증된 API로 refetch하는 2단계 구조.

```ts
// 서버 (API Route)
const ch = supabaseServer.channel('채널명');
await ch.send({ type: 'broadcast', event: '이벤트명', payload: {} });
void supabaseServer.removeChannel(ch);

// 클라이언트 (useEffect)
const ch = supabaseBrowser
  .channel('채널명')
  .on('broadcast', { event: '이벤트명' }, () => { /* refetch or invalidate */ })
  .subscribe();
return () => { void supabaseBrowser.removeChannel(ch); };
```

| 채널 | 발신 위치 | 수신 위치 | 용도 |
|------|---------|---------|------|
| `csora-battle-{roomId}` | `battle-broadcast.ts` | `battle/[id]/page.tsx` | 대결 상태 변경 |
| `csora-chat-{userId}` | `chat/messages/route.ts` | `ChatWindow.tsx` | 실시간 채팅 수신 |
| `csora-chat-notif-{userId}` | `chat/messages/route.ts` | `FriendPanel.tsx` | 미읽 배지 카운트 |
| `csora-notifications-{userId}` | `notifications/route.ts` | `NotificationBell.tsx` | 알림 실시간 수신 |
| `csora-profile-{userId}` | `profile-visibility/route.ts` | `ProfileVisibilityListener.tsx`, `UserProfileModal.tsx` | 공개 설정 변경 |

## 닉네임 필터링

### 파일 구조

| 파일 | 역할 |
|------|------|
| `src/lib/korcen-check.ts` | Tanat05/korcen.ts `checkBadLang.ts` + `checkForeign.ts` 직접 이식. `check()` (한국어), `foreign()` (영어) 두 함수 export |
| `src/lib/nickname-filter.ts` | 필터링 진입점. `isNicknameAllowed(nickname, isAdmin?)` async 함수 |
| `src/app/api/users/nickname/route.ts` | POST(최초 설정) / PATCH(변경) 모두 필터 적용 |
| `src/app/api/admin/blocked-words/route.ts` | GET·POST(bulk)·DELETE — 관리자 DB 금칙어 CRUD |

### 필터링 파이프라인

```
닉네임 입력
  → normalize() : 소문자 + 특수문자 제거 (시.발 → 시발 등 우회 방지)
  → BASE_BLOCKED_WORDS 체크 (부분 일치, includes)
      - RESERVED_WORDS (admin/운영자/관리자 등 예약어) — 관리자(isAdmin=true)는 건너뜀
      - PROFANITY_WORDS (씨발/미친/애미/씹 등 korcen 미탐지 보충)
  → DB BlockedWord 체크 (관리자가 추가한 커스텀 단어, 부분 일치)
  → check(normalized) || check(nickname) : Tanat05 korcen 한국어 욕설 (8개 카테고리)
  → foreign(nickname) : 영어 욕설 600+ 단어 (fuck/shit/bitch 등)
  → ok: true
```

관리자(`isAdmin=true`)는 RESERVED_WORDS만 우회, 욕설 차단은 동일 적용.

## 주요 API 이력

| 엔드포인트 | 내용 |
|-----------|------|
| `GET /api/questions/[id]/like` | 북마크 상태 조회 (`{ liked, likeCount }`) |
| `POST /api/admin/questions/bulk` | 일괄 승인/거절/블라인드 |
| `POST /api/admin/reports/bulk` | 일괄 무시/블라인드 |
| `POST /api/admin/inquiries/bulk` | 일괄 상태 변경 |
| `POST /api/admin/users/bulk` | 일괄 권한 변경/삭제 |
| `POST /api/battle/rooms` | 대결방 생성 |
| `POST /api/battle/rooms/[id]/join` | 대결 수락 |
| `POST /api/battle/rooms/[id]/reject` | 대결 거절 |
| `GET /api/battle/rooms/[id]` | 방 상태 폴링 + 서버사이드 타임아웃 자동제출 |
| `POST /api/battle/rooms/[id]/answer` | 답변 제출 + Broadcast 발화 |
| `POST /api/battle/rooms/[id]/quit` | 대결 중단 요청/확정 |
| `POST /api/admin/generate-questions` | GPT-4o 배치 문제 자동생성 (BATCH_SIZE=10, pgvector 중복 검사) |
| `POST /api/quiz/sessions` | `mode` 파라미터 추가 (normal\|review\|timed). review 모드 시 랭킹·뱃지·연속출석 업데이트 건너뜀 |
| `GET /api/quiz/sessions/summary` | 경량 세션 요약 (차트용, sessions/route.ts와 분리) |
| `GET /api/mypage/sessions` | 서버사이드 페이지네이션 적용 |
| `GET /api/mypage/battle-history` | 서버사이드 페이지네이션 적용 |
| `GET /api/mypage/summary` | 경량 요약 엔드포인트 (달력/차트 데이터만) |
| `GET /api/mypage/profile-visibility` | 공개 설정 조회 |
| `PATCH /api/mypage/profile-visibility` | 공개 설정 변경 + Broadcast 발화 |
| `GET /api/friends` | 친구 목록 + 온라인 상태 |
| `POST /api/friends` | 친구 추가 요청 |
| `DELETE /api/friends/[id]` | 친구 삭제 |
| `GET /api/chat/messages` | 1:1 채팅 기록 조회 |
| `POST /api/chat/messages` | 채팅 메시지 전송 + Broadcast 발화 |
| `DELETE /api/chat/messages` | 로그아웃 시 채팅 기록 삭제 |
| `POST /api/presence/heartbeat` | 온라인 상태 갱신 (15초 간격) |
| `GET /api/mypage/weekly-goals` | 주간 목표 진행률 (achievements → 이 경로로 통합) |
| `POST /api/mypage/weekly-goals` | 주간 목표 보상 수령 |
| `GET /api/me/quiz-status` | 퀴즈 진행 상태 조회 |
| `GET /api/stats/online` | 실시간 온라인 접속자 수 |
| `GET /api/stats/online-users` | 온라인 유저 목록 |
| `POST /api/battle/rooms/[id]/cancel` | 대결방 취소 (WAITING 상태) |
| `GET /api/friends/rankings` | 친구 랭킹 |
| `GET/POST /api/friends/requests` | 친구 요청 목록/처리 |
| `GET /api/inquiries/public` | 공개 문의 목록 |
| `GET /api/users/[id]/profile` | 공개 프로필 데이터 (visibility 포함) |
| `POST /api/users/[id]/report` | 유저 신고 |
