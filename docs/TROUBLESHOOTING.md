# 트러블슈팅

구현 중 겪은 문제를 두 종류로 구분해 기록한다.
- **환경/설정 오류**: 재현 가능한 셋업 문제와 해결법 — 빠른 참조용 테이블
- **설계 시행착오**: 왜 특정 접근을 버리고 현재 방식을 선택했는지 — ADR 결정 근거 보완

---

## 환경 / 설정 오류

### 새 환경에서 처음 실행 시

| 문제 | 해결 |
|------|------|
| `next` 명령어 없음 | `npm install` |
| `Cannot find module '.prisma/client/default'` | `npx prisma generate` |
| 포트 3000 이미 사용 중 | PowerShell: `Stop-Process -Id $(netstat -ano \| findstr :3000 \| ...) -Force` |

### Google OAuth

| 문제 | 원인 | 해결 |
|------|------|------|
| `client_id=undefined` | NextAuth v5는 기본적으로 `AUTH_GOOGLE_ID`를 읽음. `.env.local`은 `GOOGLE_CLIENT_ID` 사용 중 | `auth.ts`의 Google provider에 `clientId: process.env.GOOGLE_CLIENT_ID` 명시적으로 전달 |
| `401 invalid_client` | Google Cloud Console에 redirect URI 미등록 | `http://localhost:3000/api/auth/callback/google` 추가 |

### 미들웨어 (Next.js + NextAuth v5)

| 문제 | 원인 | 해결 |
|------|------|------|
| `middleware.ts` 작성했는데 실행 안 됨 (로그 없음, 리다이렉트 없음) | `src/` 디렉토리 구조 프로젝트에서 루트 `middleware.ts`는 Next.js가 무시함 | `src/middleware.ts`로 이동 |
| `auth` HOC 방식으로 세션 체크해도 항상 통과됨 | NextAuth v5 JWT 쿠키명(`authjs.session-token`)을 `auth` HOC가 못 읽는 경우 있음 | `getToken`(`next-auth/jwt`) 방식으로 전환. `cookieName: 'authjs.session-token'`, `salt: 'authjs.session-token'` 명시 |

### Prisma / DB

| 문제 | 원인 | 해결 |
|------|------|------|
| `Unknown argument 'name'` (createUser) | PrismaAdapter가 `name`, `emailVerified`, `image`를 넘기는데 User 스키마에 없음 | `name String?`, `emailVerified DateTime?` 스키마 추가 + 마이그레이션. `image` → `avatarUrl` 매핑은 `createUser` 오버라이드로 처리 |
| 마이그레이션 후에도 같은 에러 | Prisma Client가 구버전 캐시 사용 중 | `npx prisma generate` 후 서버 재시작 |
| `Property 'mode' does not exist on type 'QuizSession'` (빌드 오류) | 스키마에 `mode` 필드를 추가했지만 `npx prisma generate`를 빠뜨림 | `npx prisma generate` 실행 |
| `Property 'APPROVED_20' does not exist on type 'typeof BadgeType'` (빌드 오류) | `BadgeType`은 Prisma enum — 스키마에 추가 후 반드시 마이그레이션 + generate 필요 | `npx prisma migrate dev && npx prisma generate` |
| `[Error [PageNotFoundError]: Cannot find module for page: /api/...]` (빌드 오류) | `.next` 캐시가 삭제된 API 라우트를 여전히 참조함 | `Remove-Item -Recurse -Force .next` 후 재빌드 |
| `EINVAL: invalid argument` (빌드 중, `.next` 파일) | `.next` 캐시 파일이 손상됨 (Windows에서 빌드 중단 또는 이름 충돌로 발생) | `Remove-Item -Recurse -Force .next` 후 재빌드 |

### Windows / OneDrive

| 문제 | 원인 | 해결 |
|------|------|------|
| `EBUSY: resource busy or locked, open '.../.next/server/...nft.json'` (빌드 중) | 프로젝트가 OneDrive 동기화 폴더에 있을 때 빌드 마지막 단계에서 OneDrive가 파일을 잠금 | 실제 컴파일·정적 페이지 생성은 완료된 상태이므로 빌드 결과물은 정상. 재빌드하거나 OneDrive 동기화 일시 중지 후 빌드 |

### git commit (PowerShell)

| 문제 | 원인 | 해결 |
|------|------|------|
| `git commit -m "$(cat <<'EOF'...)"` 사용 불가 | PowerShell은 Bash heredoc 문법을 지원하지 않음 | PowerShell here-string 사용: `git commit -m @'`↵`메시지`↵`'@` (닫는 `'@`는 반드시 줄 맨 앞에) |
| PowerShell here-string에서 `$` 리터럴 필요 | `@"..."@` (double-quoted)는 `$var`를 변수로 해석함 | `@'...'@` (single-quoted) 사용 — 모든 문자를 리터럴로 처리 |

### Claude Code 토큰 소비

| 문제 | 원인 | 해결 |
|------|------|------|
| 대화 시작부터 토큰을 많이 소비함 | `CLAUDE.md`의 `@./docs/*.md` 문법은 해당 파일을 컨텍스트에 자동 주입 | `@` 접두사 제거 → 필요한 파일만 작업 중 수동으로 Read |

### OG 메타태그 / 카카오 공유

| 문제 | 원인 | 해결 |
|------|------|------|
| Discord·카카오톡 URL 붙여넣기 시 미리보기 없음 | `localhost`는 외부 서버가 접근 불가 → OG 태그 파싱 불가 | 배포 도메인에서만 확인 가능. 로컬 테스트 불가 |
| 카카오 SDK 공유 시 "앱 키 오류" | Kakao Developers 플랫폼에 현재 도메인 미등록 | [developers.kakao.com](https://developers.kakao.com) → 내 애플리케이션 → 플랫폼 → 웹 → 도메인 추가 |
| OG 이미지 URL이 `localhost`로 잡힘 | `metadataBase`가 `NEXTAUTH_URL` 환경변수를 읽는데 배포 시 미설정 | `.env.production`에 `NEXTAUTH_URL=https://실제도메인` 설정 |
| result 페이지에서 `generateMetadata` 동작 안 함 | `"use client"` 파일에서는 `generateMetadata` export 불가 | `page.tsx`를 서버 컴포넌트로 분리, 클라이언트 코드는 `ResultClient.tsx`로 이동 |

### Supabase Realtime

| 문제 | 원인 | 해결 |
|------|------|------|
| `cannot add 'presence' callbacks for realtime:online-users after subscribe()` | `useSupabaseRealtime` 훅을 `FriendPanel`과 `AnalyticsTab` 두 곳에서 호출 → Supabase JS가 동일 채널명을 캐시하여 이미 구독된 채널 객체를 반환 → `.on()` 재호출 오류 | `RealtimeContext`(Provider 패턴)로 구독을 앱 최상단에서 **한 번만** 실행. 모든 컴포넌트는 `useRealtime()` 훅으로 동일 Context 소비 |
| 친구 패널에서 프로필 공개 설정 변경 후 새로고침해야 반영됨 | `UserProfileModal`의 `staleTime: 60_000` + Supabase 구독 없음 | `staleTime: 0` + `csora-profile-modal-{userId}` 채널 구독 → `queryClient.invalidateQueries` |

### 커스텀 도메인 (csora.co.kr 이전)

| 문제 | 원인 | 해결 |
|------|------|------|
| 구 도메인(`csora.vercel.app`)에서 로그인 시 `MissingCSRF` 에러 | `NEXTAUTH_URL`을 새 도메인 하나로 고정하면, 로그인 폼이 (쿠키가 없는) 다른 도메인으로 제출되며 CSRF 쿠키 불일치 발생 | 구 도메인의 NEXTAUTH_URL을 도메인별로 분기하는 대신, Vercel Domains에서 구 도메인 → 새 도메인 308 리다이렉트를 걸어 애초에 구 도메인 페이지 자체에 도달 못하게 처리 (상세: [ADR-036](./ADR.md#adr-036-커스텀-도메인csoracokr-채택-대표-도메인은-www-없는-apex)) |
| `curl`로 `/api/auth/signin/google`을 직접 GET 요청하면 `error=Configuration`로 리다이렉트 | NextAuth `signIn()`은 실제로는 CSRF 토큰이 포함된 POST 요청 — 로그인 페이지 로드 없이 URL만 직접 호출하면 CSRF 토큰이 없어 서버가 (부정확하게) "Configuration" 에러로 응답. **실제 버그가 아니라 테스트 방법 자체가 실사용 흐름과 다름** | curl 대신 Playwright로 로그인 페이지를 먼저 로드해 CSRF 쿠키를 확보한 뒤 실제 버튼을 클릭해서 검증 — 정상적으로 구글/카카오 로그인 화면까지 진입하는 것으로 확인됨 |
| Vercel Domains에서 도메인 상태가 "Invalid Configuration" ↔ "Valid Configuration"로 번갈아 뜸 | 국내 도메인 등록업체(hosting.co.kr 등)의 네임서버가 해외에서 조회 시 간헐적으로 응답이 느려, Vercel의 주기적 상태 체크가 타이밍에 따라 실패/성공을 반복 | Google/Cloudflare/KT 등 주요 DNS로 직접 조회해 실제 레코드가 정확한지, 그리고 실제 HTTP(S) 접속이 되는지로 판단 — 둘 다 정상이면 Vercel 대시보드 표시는 무시해도 됨(실사용에 영향 없음) |

---

## 설계 시행착오

### TS-001: 유사 문제 감지 — 임베딩 전략 탐색

**문제**: 동일한 CS 개념을 묻지만 표현이 다른 중복 문제를 탐지해야 한다.

테스트 케이스:
- `제1정규형(1NF)의 조건은?`
- `"모든 속성값이 원자값이어야 한다" 몇 정규형에 해당하나요?`

→ 같은 개념이지만 표현이 완전히 달라 단순 문자 비교로는 탐지 불가.

**1차 시도 — pg_trgm (실패)**

트라이그램 유사도: 0.05 수준 → 임계값 0.1에서도 탐지 불가.
pg_trgm은 문자 수준 비교 → 동의어·역방향 표현 처리 불가.

**2차 시도 — pgvector + 문제 텍스트만 임베딩 (실패)**

코사인 유사도 0.40 수준으로 낮아 임계값 설정 불가.
원인: 짧은 질문 텍스트는 맥락이 부족해 임베딩 품질 저하.
부작용: `트랜잭션의 ACID 속성 중 원자성`(0.418)이 실제 유사 문제인 1NF 문제(0.402)보다 높게 나오는 오탐 — "원자" 단어가 겹치는 표면적 유사도가 의미 유사도를 앞섬.

**3차 시도 — 문제 + 정답 텍스트 결합 임베딩 (채택)**

`"${question} ${correctAnswer}"` 형태로 결합 후 임베딩.
결과: 유사도 0.70으로 상승, 임계값 0.5 적용 시 안정적 탐지.

**결론**: 짧은 자연어 질문만으로는 임베딩 맥락이 부족하다. 정답 텍스트를 결합해야 의미 정확도가 확보된다.
→ 설계 결정은 [ADR-021](./ADR.md#adr-021-유사-문제-감지에-pgvector--openai-임베딩-사용) 참조.

---

### TS-002: GPT-4o json_object 모드 배열 10개 제한

**문제**: 관리자 AI 문제생성에서 20개를 요청해도 항상 10개만 반환됨. `max_tokens`를 늘려도 동일.

**원인 분석**:
- GPT-4o `response_format: { type: "json_object" }` 모드에서 배열 크기를 모델이 자체적으로 약 10개로 제한함 — `max_tokens` 파라미터와 무관한 모델 내부 제약
- 처음에는 `max_tokens` 부족으로 잘린 것으로 오진단 → `max_tokens: 8000` 으로 올려도 동일

**해결**:
- `BATCH_SIZE = 10`으로 고정, `Math.ceil(count / BATCH_SIZE)`번 순차 호출
- 각 배치에 이전 배치 결과를 `excludedTitles`로 전달해 중복 억제
- 프롬프트 포맷: 최상위 배열 금지 → `{ "questions": [...] }` wrapper 형식 사용

→ 설계 결정은 [ADR-028](./ADR.md#adr-028-ai-문제생성-배치-방식-gpt-json_object-10개-제한-우회) 참조.

---

### TS-004: 유사 문제 검색 — 흔한 단어에 드문 핵심어가 묻히는 문제

**문제**: "데이터베이스에서 트리거" 같은 실제 사용자 쿼리가 DB에 있는 진짜 관련 문제("RDBMS에서 트리거는...", "데이터베이스의 trigger를 사용하는...")를 찾지 못함.

**1차 시도 — 임계값 0.52 (실패)**

기존 0.5 임계값에서 오탐이 있다고 판단해 0.52로 상향, `LIMIT 8`. 다른 정상 쿼리("데이터베이스에서 트리거의 목적은 무엇인가?")의 실제 정답 유사도가 0.519로 임계값 0.001 차이로 걸러짐.

**2차 시도 — 임계값 0.55 (더 악화)**

더 올리자 위 케이스를 포함해 더 많은 정상 매칭이 걸러짐. 임계값을 올리는 방향 자체가 잘못됨을 확인.

**3차 시도 — 0.5 + pg_trgm 블렌드 (부분 성공, 짧은 쿼리에서 재실패)**

`벡터유사도×0.7 + pg_trgm×0.3`로 재정렬, 임계값 0.5, `LIMIT 10`. 긴 쿼리는 해결됐지만 더 짧은 "데이터베이스에서 트리거"는 여전히 실패 — 두 "트리거" 문제의 벡터 유사도(0.44~0.47)가 임계값 0.5 자체보다 낮아 애초에 후보군에도 못 들어감. 원인: DB에 "데이터베이스에서 인덱스가...", "데이터베이스 파티셔닝이..." 같은 "데이터베이스 + 흔한 서술어" 패턴 문제가 81건 있어, 이들의 벡터 유사도가 "트리거" 문제보다 오히려 높게 나옴 — 흔한 단어(데이터베이스)의 표면적 유사도가 드문 핵심어(트리거)의 의미적 관련성을 압도.

**4차 시도 — 임계값 0.35 + 희귀 토큰(코퍼스 빈도 역가중치) 부스트 (채택)**

- 벡터 임계값을 0.35로 낮춰 순수 게이트 용도로만 사용(넉넉히 `LIMIT 100`)
- 재정렬 점수에 `rareTokenBoost` 추가: 토큰이 코퍼스에서 드물수록(`1/√등장횟수`) 매칭 시 더 큰 가중치
- 최종 점수: `벡터×0.5 + trgm×0.2 + rareTokenBoost×0.3`

처음엔 토큰 매칭을 단순 ILIKE 히트/미스(이진값)로 구현했으나 "데이터베이스", "목적은" 같은 흔한 토큰도 거의 모든 후보에 매칭돼 변별력이 없었음 — 코퍼스 등장 빈도 기반 연속값 가중치로 전환해 흔한 토큰은 자동으로 낮은 가중치를 받도록 수정(별도 불용어 사전 불필요).

재현 쿼리 3개(데이터베이스에서 트리거 / …트리거의 목적은 무엇인가? / RDBMS에서 트리거란 무엇인가?) 모두 실제 프로덕션 DB 데이터로 재현 후 검증.

**남은 한계**: 두 "트리거" 문제 중 하나가 한글 "트리거" 없이 영어 "trigger"만 사용 — 이 경우 문자 집합이 아예 달라 트라이그램·부분 문자열로도 매칭 불가. CS 용어 한/영 동의어 사전(`SYNONYM_GROUPS`)으로 별도 해결.

→ 설계 결정은 [ADR-030](./ADR.md#adr-030-유사-문제-검색--벡터pg_trgm희귀토큰-가중치-하이브리드-재정렬) 참조.

---

### TS-003: 시간제한 타이머 race condition

**문제**: 시간제한 모드에서 타이머가 다 지나면 문제가 2개씩 건너뛰거나 의도치 않게 제출됨.

**원인 분석**:
- 기존 구현이 3개의 `useEffect`로 분리: (1) 타이머 카운트다운, (2) timeLeft === 0 감지, (3) currentIndex 변경 시 리셋
- `currentIndex`가 변경될 때 effect 1·3이 동시 재실행 → 새 interval 2개가 생성되어 1초에 2번 감소
- `setCurrentIndex(prev => prev + 1)` 안에서 `setTimeout(() => handleSubmit(), 0)` 호출 → stale closure로 구버전 `handleSubmit` 참조

**해결**:
- 단일 `useEffect([currentIndex, isTimed])`로 통합
- 지역 변수 `let remaining = QUESTION_SECONDS` — setState를 거치지 않고 직접 감소 → React 배칭 영향 없음
- `handleSubmitRef.current = handleSubmit` — effect 바깥에서 항상 최신 참조 유지

→ 설계 결정은 [ADR-027](./ADR.md#adr-027-시간제한-타이머--단일-useeffect--로컬-변수-패턴) 참조.

---

### TS-005: 접속 상태(Presence) stale 버그 2건

**문제 1 — 첫 진입 시 "현재 접속 중" 배지가 안 보이다가 새로고침해야 나타남**

`OnlineCountBadge`(마운트 시 `GET /api/stats/online` 조회)와 `Header`(마운트 시 + 15초 간격 `POST /api/presence/heartbeat`)가 서로 조율 없는 독립적인 `useEffect` 두 개로 되어 있었음. 최초 진입 시 count 조회가 heartbeat보다 먼저 응답하면, 본인이 유일한 접속자인 경우 count가 0으로 나와 배지가 아예 렌더링 안 됨(`count === null || count === 0`이면 `return null`)—다음 30초 폴링까지 계속 숨겨짐.

**해결**: `OnlineCountBadge`의 조회 순서를 `await heartbeat 먼저 → count 조회`로 직렬화해, 최초 조회 시점에 이미 본인 접속 기록이 남아있도록 함.

**문제 2 — 친구 온라인 상태가 새로고침 전까지 고정됨(모바일에서 주로 발생)**

Supabase Realtime 채널 구독 상태는 `SUBSCRIBED | CHANNEL_ERROR | TIMED_OUT | CLOSED` 4가지인데, `RealtimeContext`는 이 중 3개만 처리하고 `CLOSED`를 누락 — 모바일에서 탭을 백그라운드로 보냈다 복귀하는 등으로 채널이 `CLOSED`되면 `realtimeActive`가 `true`로 고정된 채 남고, `FriendPanel`은 `realtimeActive`가 true인 동안 (이미 죽어서 더 이상 갱신되지 않는) presence 데이터를 계속 신뢰함.

**해결**: `CLOSED`도 `CHANNEL_ERROR`/`TIMED_OUT`과 동일하게 `realtimeActive = false`로 처리. 추가로 `document.visibilitychange` 이벤트로 탭이 다시 보이면 `reconnectTick` 상태를 증가시켜 채널 구독 effect를 강제로 재실행(재구독)하도록 함.

---

### TS-006: 닉네임 설정 후 원래 페이지로 리다이렉트 안 됨 (Next.js Router Cache)

**문제**: `/auth/setup-nickname`에서 닉네임 저장 후 `router.push(callbackUrl)`을 호출해도 다시 `/auth/setup-nickname`으로 되돌아오는 경우가 있었음(신규가입 직후 재현).

**원인 분석**: Next.js App Router의 클라이언트 Router Cache가, 방금 미들웨어가 "닉네임 미설정 → `/auth/setup-nickname`로 리다이렉트"했던 목적지 경로에 대해 그 리다이렉트 결과를 캐싱해둔 상태였음. 닉네임 저장 직후 `router.push(callbackUrl)`을 호출하면 미들웨어를 다시 타지 않고 이 캐시된 리다이렉트 결과를 재생해버려, 방금 닉네임을 설정했는데도 여전히 "미설정" 상태였던 시점의 리다이렉트로 돌아가는 것처럼 동작함.

**해결**: `router.push` 대신 `window.location.href`로 하드 네비게이션 — 브라우저가 완전히 새 요청을 보내 미들웨어가 갱신된 쿠키/세션으로 다시 평가되도록 함.

**검증 한계**: 실제 OAuth 신규가입 플로우가 있어야 재현되는 케이스라 샌드박스에서 라이브 검증은 못 했음. 빌드/타입체크만 통과 확인.

---

### TS-007: 관리자 통계 "오늘" 기준이 UTC 자정에 갱신되던 버그

**문제**: 관리자 통계 페이지의 오늘 방문자/신규가입자/퀴즈풀이 집계가 한국 자정(00:00 KST)이 아니라 다른 시각에 갱신되는 것 아니냐는 의심.

**원인 분석**: `presence/heartbeat`(DailyVisit 기록)와 `admin/analytics`(오늘 집계 조회) 둘 다 `const today = new Date().toISOString().slice(0, 10)`로 "오늘"을 구하고 있었음 — 서버가 UTC로 도는 Vercel 환경에서 이건 UTC 자정 기준이라, 실제로는 **KST 오전 9시**에 날짜가 넘어감. KST 00:00~08:59 사이에는 UTC 날짜가 아직 전날이라 "오늘" 집계가 실제 한국 기준 오늘이 아니라 전날 것으로 표시됨. 더 나아가 `admin/analytics`의 `periodAttempts`(day 기간)는 `attemptsByKey[today]`로 조회하는데, `attemptsByKey`의 키는 세션의 `submittedAt`을 KST로 변환해 만든 값이라 — 이 시간대(KST 00:00~08:59)에는 `today`(UTC 날짜, 버그)와 `attemptsByKey`의 키(KST 날짜, 정상) 형식 자체가 어긋나 조회가 아예 실패(0으로 표시)하는 문제까지 있었음.

**해결**: 이미 프로젝트에 있던 `src/lib/kst.ts`의 `getKSTDateStr()`/`getKSTMidnight()`로 교체(다른 라우트 — daily-reset, infra-stats, daily/participants, quiz/sessions —는 이미 이 유틸을 쓰고 있었고 이 두 곳만 예전 방식이 남아있었음). "오늘 신규가입자"/"오늘 퀴즈풀이" 쿼리도 `T00:00:00.000Z`~`T23:59:59.999Z`(사실상 UTC 하루) 범위 대신 `getKSTMidnight()`~`getKSTMidnight(1)`(KST 하루)로 수정.

**검증**: `getKSTDateStr()`에 대해 KST 자정 정각/자정 1초 전/버그가 실제 발생하던 KST 오전 0~9시 구간(UTC 날짜는 전날, KST로는 이미 다음날)을 `vi.setSystemTime`으로 시간을 고정해 검증하는 테스트 4개 추가(`src/lib/kst.test.ts`) — 전부 통과 확인.
