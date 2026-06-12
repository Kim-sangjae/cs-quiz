# Troubleshooting

## 새 환경에서 처음 실행 시

| 문제 | 해결 |
|------|------|
| `next` 명령어 없음 | `npm install` |
| `Cannot find module '.prisma/client/default'` | `npx prisma generate` |
| 포트 3000 이미 사용 중 | PowerShell: `Stop-Process -Id $(netstat -ano \| findstr :3000 \| ...) -Force` |

---

## Google OAuth

| 문제 | 원인 | 해결 |
|------|------|------|
| `client_id=undefined` | NextAuth v5는 기본적으로 `AUTH_GOOGLE_ID`를 읽음. `.env.local`은 `GOOGLE_CLIENT_ID` | `auth.ts`의 Google provider에 `clientId: process.env.GOOGLE_CLIENT_ID` 명시적으로 전달 |
| `401 invalid_client` | Google Cloud Console redirect URI 미등록 | `http://localhost:3000/api/auth/callback/google` 추가 |

---

## 미들웨어 (Next.js)

| 문제 | 원인 | 해결 |
|------|------|------|
| `middleware.ts` 작성했는데 실행 안 됨 (로그 없음, 리다이렉트 없음) | `src/` 디렉토리 구조 프로젝트에서 루트 `middleware.ts`는 Next.js가 무시함 | `src/middleware.ts`로 이동 |
| `auth` HOC 방식으로 세션 체크해도 항상 통과됨 | NextAuth v5 JWT 쿠키명(`authjs.session-token`)을 `auth` HOC가 못 읽는 경우 있음 | `getToken`(`next-auth/jwt`) 방식으로 전환. `cookieName: 'authjs.session-token'`, `salt: 'authjs.session-token'` 명시 |

---

## Claude Code 토큰 소비

| 문제 | 원인 | 해결 |
|------|------|------|
| 대화 시작부터 토큰을 많이 소비함 | `CLAUDE.md`의 `@./docs/*.md` 문법은 대화 시작 시 해당 파일을 컨텍스트에 자동 주입함. PRD·ARCHITECTURE·UI_GUIDE·ADR 4개 파일이 매 대화마다 ~22,000 토큰 선점 | `@` 접두사 제거 → 필요한 파일만 작업 중 수동으로 Read |
| 수정 후 다음 대화부터 반영됨 | 현재 세션은 이미 주입된 상태라 영향 없음 | 새 대화를 시작하면 해결됨 |

---

## Prisma / DB

| 문제                                     | 원인 | 해결 |
|----------------------------------------|------|------|
| `Unknown argument 'name'` (createUser) | PrismaAdapter가 `name`, `emailVerified`, `image`를 넘기는데 User 스키마에 없음 | `name String?`, `emailVerified DateTime?` 스키마 추가 + 마이그레이션. `image` → `avatarUrl` 매핑은 `createUser` 오버라이드로 처리 |
| 마이그레claude이션 후에도 같은 에러                 | Prisma Client가 구버전 캐시 사용 중 | `npx prisma generate` 후 서버 재시작 |