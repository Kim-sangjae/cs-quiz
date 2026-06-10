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
- **Prisma 7**: `url`/`directUrl`은 `schema.prisma`가 아닌 `prisma.config.ts`와 `PrismaClient({ datasourceUrl })` 로 관리
- **커밋**: conventional commits (`feat:`, `fix:`, `refactor:`, `chore:`)

---

## Documentation

작업 유형별로 필요한 문서만 읽는다.

- 기능 명세·엣지케이스 → @./docs/PRD.md
- 디렉토리 구조·렌더링 전략·미들웨어·스키마 → @./docs/ARCHITECTURE.md
- UI 색상·컴포넌트 토큰·안티패턴 → @./docs/UI_GUIDE.md
- 기술 결정 근거 → @./docs/ADR.md
