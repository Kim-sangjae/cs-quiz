# CS Quiz

## Stack

Next.js 15 (App Router) · TypeScript strict · Tailwind CSS · Vitest  
Supabase (PostgreSQL) · Prisma ORM v7 · NextAuth.js v5 · TanStack Query

## Commands

```bash
npm run dev        # localhost:3000
npm run build && npm run test && npm run lint   # 검증 순서
npx prisma migrate dev   # 스키마 변경 후
npx prisma generate      # Prisma Client 재생성
npm run db:seed          # 초기 데이터 시딩
python scripts/execute.py {phase}        # harness 실행
python scripts/execute.py {phase} --push # 실행 후 push
```

---

## Think Before Coding

- 요구사항이 모호하면 구현 전 질문한다
- 여러 구현 방식이 있으면 선택지와 트레이드오프를 먼저 제시한다

## Simplicity First

- 요청된 기능 외 추가 금지
- 불필요한 추상화·미래 확장성 고려 금지

## Surgical Changes

- 필요한 파일만 수정, 관련 없는 리팩토링 금지
- 기존 코드 스타일·주석 유지

## Verification

수정 후 반드시: `npm run build && npm run test && npm run lint`

---

## Non-Obvious Rules

- **정답 prop 전달 금지**: `answer` 필드는 `grade.ts` 제출 시점에만 접근
- **셔플은 Fisher-Yates만**: `Array.sort(() => Math.random() - 0.5)` 사용 금지
- **TDD**: 새 순수 함수 구현 시 테스트 먼저
- **API 인증**: 모든 POST/PATCH는 세션 검증 → 미인증 401
- **admin API**: `/api/admin/*`는 `role === 'ADMIN'` 추가 검증 → 미인증 403
- **Prisma $transaction**: quiz 제출 시 QuizSession + QuestionAttempt + Question 통계를 단일 트랜잭션으로
- **Prisma 7 URL 관리**: `schema.prisma`에 `url`/`directUrl` 없음. `prisma.config.ts`에서 `datasource.url = process.env.DIRECT_URL` (마이그레이션용), `src/lib/prisma.ts`에서 `new PrismaPg({ connectionString: process.env.DATABASE_URL })`로 런타임 연결
- **.env.local 절대 커밋 금지**: `.gitignore`에 있으나 실수로 커밋되면 GitHub Push Protection에 차단됨. `git add -A` 대신 파일 명시적 지정
- **커밋**: conventional commits (`feat:`, `fix:`, `refactor:`, `chore:`)

---

## 구현 현황

phases 0~6 전부 완료. 아래 기능이 모두 구현된 상태다.

| 페이즈 | 구현 내용 |
|--------|-----------|
| 0-mvp | 퀴즈 진행(`/quiz/play`), 결과(`/result/[sessionId]`), 120문제 데이터 |
| 1-infra | Prisma 스키마, Google OAuth(NextAuth v5), 닉네임 온보딩, 공통 헤더, 시드 |
| 2-quiz-v2 | 퀴즈 선택 화면(`/quiz`), QuizSession DB 저장, 시도 통계 트랜잭션 업데이트 |
| 3-board | 게시판 목록/상세/등록, 좋아요, 신고 |
| 4-admin | 관리자 패널(승인/거절/블라인드) |
| 5-social | 메인 랭킹(카테고리별 TOP5), 알림(30초 폴링) |
| 6-mypage-v2 | 마이페이지 DB 전환, 계정 설정(닉네임 변경/로그아웃) |

---

## Documentation

작업 유형별로 필요한 문서만 읽는다.

- 기능 명세·엣지케이스 → @./docs/PRD.md
- 디렉토리 구조·렌더링 전략·미들웨어·스키마 → @./docs/ARCHITECTURE.md
- UI 색상·컴포넌트 토큰·안티패턴 → @./docs/UI_GUIDE.md
- 기술 결정 근거 → @./docs/ADR.md
