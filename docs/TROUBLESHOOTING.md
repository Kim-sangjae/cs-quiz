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
| `[Error [PageNotFoundError]: Cannot find module for page: /api/...]` (빌드 오류) | `.next` 캐시가 삭제된 API 라우트를 여전히 참조함 | `Remove-Item -Recurse -Force .next` 후 재빌드 |

### Claude Code 토큰 소비

| 문제 | 원인 | 해결 |
|------|------|------|
| 대화 시작부터 토큰을 많이 소비함 | `CLAUDE.md`의 `@./docs/*.md` 문법은 해당 파일을 컨텍스트에 자동 주입 | `@` 접두사 제거 → 필요한 파일만 작업 중 수동으로 Read |

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
