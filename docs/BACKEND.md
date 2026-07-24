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
| `Notification` | type(QUESTION_APPROVED/REJECTED/ROLE_CHANGED/INQUIRY_REPLIED/LEVEL_UP/BADGE_EARNED/FRIEND_REQUEST/FRIEND_ACCEPTED/BATTLE_INVITE/QUESTION_COMMENTED 등), payload(Json), isRead |
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
| `SynonymGroup` | createdBy — 유사문제 검색용 관리자 동의어 그룹 |
| `SynonymTerm` | groupId(FK, onDelete Cascade), term(unique) — 그룹에 속한 개별 단어(예: "데이터베이스", "db", "database") |
| `RateLimit` | key(PK, `{action}:{userId 또는 ip}`), count, windowStart — DB 기반 레이트리밋 카운터 |
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

## KST 날짜 경계 계산

서버(Vercel)는 UTC로 실행되므로 "오늘", "이번 주" 등 날짜 경계가 필요한 곳에서 `new Date().toISOString().slice(0,10)`이나 `setHours(0,0,0,0)`을 직접 쓰면 **한국 자정이 아니라 UTC 자정(=KST 오전 9시)에 날짜가 바뀌는 버그**가 생긴다. 항상 `src/lib/kst.ts`의 유틸을 사용한다.

| 함수 | 용도 |
|------|------|
| `getKSTDateStr()` | "오늘" 날짜 문자열(`YYYY-MM-DD`, KST 기준) |
| `getKSTMidnight(daysOffset?)` | KST 자정을 UTC 인스턴트(Date)로 반환 — Prisma `gte`/`lt` 범위 쿼리용 |
| `getKSTNow()` | 현재 시각을 KST로 시프트한 Date (연/월/일 등 `getUTC*()` 게터로 읽음) |
| `getKSTWeekStart()` | 이번 주 월요일 00:00 KST |

**실제 발생했던 버그**: `presence/heartbeat`(DailyVisit 기록)와 `admin/analytics`(오늘 방문자·신규가입자·퀴즈풀이 집계)가 위 유틸 대신 `new Date().toISOString().slice(0,10)`을 직접 써서, KST 00:00~08:59 사이에는 "오늘"이 실제로는 이미 다음날인데 전날 날짜로 잘못 계산되고 있었음(`getKSTDateStr` 도입으로 수정, 회귀 테스트: `src/lib/kst.test.ts`의 `getKSTDateStr` describe 블록). 상세: [TROUBLESHOOTING.md#TS-007](./TROUBLESHOOTING.md#ts-007-관리자-통계-오늘-기준이-utc-자정에-갱신되던-버그).

## JWT / 세션 무효화

- `User.tokenVersion`: 권한 변경·탈퇴처리 시 `{ increment: 1 }` → 기존 토큰 즉시 무효화
- `User.deletedAt`: 소프트딜리트. JWT 콜백에서 `deletedAt !== null`이면 세션 null 반환
- `auth.ts` JWT 콜백: 매 서버사이드 `auth()` 호출마다 DB에서 tokenVersion·role·deletedAt 조회
- 미들웨어(`auth.config.ts`): Edge Runtime 제약으로 DB 미조회 — API 호출 시점에 무효화됨

## 계정 삭제 (소프트 vs 하드)

| 방식 | 트리거 | 동작 |
|------|--------|------|
| 비활성화(소프트딜리트) | `PATCH /api/admin/users/[id]` | `User.deletedAt` 설정 + `tokenVersion` 증가로 기존 세션 즉시 무효화. 데이터는 전부 보존 |
| 완전삭제(하드딜리트) | `DELETE /api/admin/users/[id]` | `User` 로우 자체를 삭제. 자기 자신은 삭제 불가 |

**하드 딜리트 구현 시 주의**: `schema.prisma`의 관계 선언(`onDelete` 미명시)만으로는 실제 DB의 FK 참조 동작(`information_schema.referential_constraints`)을 알 수 없음 — 직접 조회해보니 `QuestionAttempt`/`QuizSession`/`Notification`/`Like`/`Inquiry`/`Report`/`GameRoom(hostId)`가 **RESTRICT**라 그냥 `prisma.user.delete()`를 호출하면 FK 위반으로 실패함. 따라서 `$transaction`으로 이 테이블들을 먼저 `deleteMany`한 뒤 마지막에 `user.delete()` 호출. `Question.authorId`는 **SET NULL**이라 별도 처리 없이 자동으로 null 처리됨(작성자만 지워지고 문제·댓글은 남음).

## 레이트리밋 / 부정 이용 방어

`src/lib/rate-limit.ts`의 `isRateLimited(key, limit, windowSeconds)` — `RateLimit` 테이블에 키별 카운터를 저장하는 DB 기반 구현(Redis 등 외부 인프라 없음). 창이 지나면 자동 리셋, 낮은 확률로 오래된 행 정리(별도 크론 불필요). 비로그인 요청은 `getClientIp(req)`(x-forwarded-for)로 IP 기준 키 사용.

| 대상 | 제한 | 키 |
|------|------|-----|
| 댓글 작성 | 10초 5회 | `comment:{userId}` |
| 문제/유저/댓글 신고 | 60초 10회 | `report:{userId}` |
| 문의 등록 | 60초 5회 | `inquiry:{userId}` |
| 채팅 메시지 | 10초 20회 | `chat:{userId}` |
| 문제 목록/상세 조회(스크래핑 방지) | 60초 60회 | `questions-list:user:{userId}` 또는 `:ip:{ip}` |
| 퀴즈 세션 제출(무한 재제출로 XP/포인트/뱃지 파밍 방지) | 60초 10회 | `quiz-submit:{userId}` |
| 대결방 생성(알트 계정 XP 파밍 방지) | 하루 50회, **친구쌍 단위**(유저 전체 합산 아님) | `battle-create:{[userId,friendId].sort().join('-')}` |

**채팅 친구관계 서버 검증**: `POST /api/chat/messages`는 발신자·수신자 간 `Friendship(status: ACCEPTED)`가 없으면 403. 프론트(FriendPanel)가 친구에게만 메시지 버튼을 보여주는 것과 별개로, API 자체도 검증해야 함 — UI 숨김은 보안이 아님(userId는 공개 프로필에서 노출되므로 API 직접 호출로 우회 가능했음).

**퀴즈 정답 비노출**: `quiz/play/page.tsx` → `QuizPlayClient`로 내려가는 문제 목록은 `Omit<Question, "answer" | "explanation">` 타입만 사용 — 채점은 `/api/quiz/sessions`가 서버에서 DB 정답과 재대조하므로 클라이언트는 애초에 정답 필드를 받지 않음(CLAUDE.md "정답 prop 전달 금지" 규칙).

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
NEXTAUTH_URL=               # http://localhost:3000 (dev) | https://csora.co.kr (프로덕션, OG 이미지 URL·이메일 링크 기준)
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

**Realtime 연결 불가/불안정 시 폴백**: Supabase Realtime 무료 티어는 동시 연결 200개 제한. 초과·장애 시에도 기능이 완전히 멈추지 않도록 기능별 폴백 적용.

| 기능 | 폴백 방식 |
|------|-----------|
| 알림(NotificationBell) | 30초 폴링 |
| 대결 초대(BattleInviteAlert) | 5초 폴링 |
| 대결 진행(battle/[id]) | 1초 폴링(일반) / 500ms(5초 단축 모드) |
| 채팅(ChatWindow) | 5초 폴링 — Broadcast 발신 자체가 실패해도 DB 저장은 이미 완료된 상태라 무시(try/catch), 전송 버튼도 Realtime 연결 상태와 무관하게 항상 활성화 |
| 접속자 목록(Presence) | DB heartbeat(`presence/heartbeat`, 15초 간격) 기반이라 Realtime 없이도 동작. `RealtimeContext`는 채널 상태가 `CLOSED`(모바일 탭 백그라운드 등)가 되면 `realtimeActive`를 false로 내리고, 탭이 다시 보이면(`visibilitychange`) 채널을 재구독함 |

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

## 유사 문제 검색 (임베딩 + 하이브리드 재정렬)

`GET /api/questions/similar?q=` (`src/app/api/questions/similar/route.ts`), 게시판 문제 등록 폼(`board/submit`)에서 실시간 힌트로 사용.

**사용 기술**:

| 기술 | 역할 |
|------|------|
| OpenAI `text-embedding-3-small` (`src/lib/embedding.ts`) | 문장 의미 기반 벡터 임베딩. 표현이 달라도 개념이 같으면 높은 코사인 유사도 반환 |
| pgvector (`Question.embedding vector(1536)`) | 임베딩 저장 + `<=>` 코사인 거리 연산자로 벡터 유사도 검색. HNSW 인덱스로 대량 데이터에서도 고속 |
| pg_trgm (`similarity()` 함수, `idx_question_trgm` GIN 인덱스) | 문자열 트라이그램 유사도. 임베딩이 놓치는 표면적 문자 일치를 보완 |
| 희귀 토큰(TF-IDF 방식) 가중치 (`src/lib/similar-search.ts`) | 코퍼스 내 등장 빈도가 낮은 토큰(`1/√빈도`)일수록 매칭 시 더 큰 가중치 부여 — "데이터베이스"처럼 흔한 단어에 "트리거"처럼 드문 핵심어가 묻히는 문제 해결 |
| 한/영 동의어 사전 — 하드코딩(`SYNONYM_GROUPS`) + 관리자 DB 관리(`SynonymGroup`/`SynonymTerm`) 병합 | "트리거"↔"trigger" 등 문자 집합이 달라 벡터·트라이그램으로도 못 잡는 동의어를 정규화해 매칭 |

**동작 흐름**:
1. `extractSearchTokens(q)` — 구두점 제거 + 조사(에서/으로/이란 등) 후행 스트립 + 2글자 미만 제외 + 중복 제거
2. 각 토큰의 코퍼스 등장 빈도(`corpusCounts`) 조회 — 토큰 원형 OR 동의어(`getSynonyms`) 어느 쪽이든 포함하면 카운트
3. 벡터 유사도 0.35 이상인 후보를 넉넉히(LIMIT 100) 확보 — 임계값을 낮게 잡아 순수 벡터 유사도로는 걸러질 뻔한 진짜 관련 문제도 후보군에 포함
4. 최종 점수 = `벡터유사도×0.5 + pg_trgm유사도×0.2 + 희귀토큰가중치×0.3` 로 재정렬 후 상위 10개 반환

**임계값·가중치 변경 이력**: 0.5 단일 임계값 → 0.52 → 0.55 → pg_trgm 블렌드(0.5) → 현재(0.35 + 희귀토큰 가중치). 재현 사례와 함께 [TROUBLESHOOTING.md#TS-004](./TROUBLESHOOTING.md#ts-004-유사-문제-검색--흔한-단어에-드문-핵심어가-묻히는-문제) 참조.

**검색 트리거 최소 글자수**: `questions/similar` GET·`board/submit` 프론트 둘 다 쿼리 5자 미만이면 검색 자체를 안 하도록 하드코딩돼 있었음 → "트리거"처럼 동의어 사전에 등록된 짧은 핵심어 자체를 입력해도 검색이 아예 안 뜨는 문제라 2자로 완화(`extractSearchTokens`의 토큰 단위 2글자 필터와는 별개로, 검색 API를 호출할지 말지 결정하는 쿼리 전체 길이 게이트).

**관리자 동의어 그룹 관리** (`/admin` 동의어 관리 탭, `GET/POST/DELETE /api/questions` 아님 `/api/admin/synonyms`):
- 관리자가 "데이터베이스, db, database"처럼 콤마 없이 칸을 나눠 단어 2개 이상으로 새 그룹 생성, 또는 기존 그룹에 단어 추가/삭제 가능
- 저장 시 `normalizeKey()`(소문자화)로 정규화 — 영어는 대소문자 구분 없이 매칭됨
- `buildSynonymLookup(dbGroups)`가 하드코딩 `SYNONYM_GROUPS`와 DB `SynonymGroup`을 병합한 단일 조회 테이블을 만들어 `getSynonyms`/`rareTokenBoost`에 전달 — 관리자가 추가한 동의어도 기존 사전과 동일하게 검색에 반영됨
- 그룹의 마지막 단어를 삭제하면 빈 그룹까지 cascade로 함께 삭제

## 문제 등록 유효성 검사

| 필드 | 제한 | 위치 |
|------|------|------|
| 문제 텍스트 | 500자 | `api/questions` POST, `board/submit` |
| 보기(A~D) 각각 | 100자 | `api/questions` POST (서버), `board/submit` (클라이언트 maxLength) |
| 해설 | 500자 | `api/questions` POST, `board/submit` |
| AI 오답 생성 — 정답 입력 | 100자 | `api/questions/generate-options` POST |
| 문의 제목 | 100자 | `api/inquiries` POST |
| 문의 내용 | 1000자 | `api/inquiries` POST, `inquiry/new` |

**AI 오답 생성 글자수 유사화**: `api/questions/generate-options`는 GPT 프롬프트에 정답 글자수(`"정답: OO (37자)"`)를 명시하고 "오답 3개는 정답과 비슷한 글자 수(±10자 이내)로 작성"을 지시 — 특정 보기만 유독 짧거나 길어 글자수만으로 정답이 드러나는 것을 방지.

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
| `GET /api/questions/similar` | pgvector+pg_trgm+희귀토큰 가중치 하이브리드 재정렬, 한/영 동의어 정규화, 최소 글자수 5→2자 완화 |
| `POST /api/questions/generate-options` | GPT 프롬프트에 정답 글자수 명시 + 오답 글자수 유사화(±10자) 지시. `existingDistractors`/`skipExplanation`로 유저가 이미 채운 오답·해설은 재생성하지 않고 빈 칸만 채움 |
| `GET/POST/DELETE /api/admin/synonyms` | 유사문제 검색 동의어 그룹 CRUD (그룹 생성 시 단어 2개 이상 필수, 기존 그룹에 단어 추가/삭제 가능) |
| `DELETE /api/admin/users/[id]` | 계정 완전삭제(하드 딜리트). 기존 비활성화(소프트딜리트)와 별개 기능. 자기 자신은 삭제 불가 |
