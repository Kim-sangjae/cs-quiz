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
