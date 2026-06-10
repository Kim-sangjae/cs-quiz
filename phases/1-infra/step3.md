# Step 3: seed-data

## 읽어야 할 파일

먼저 아래 파일들을 읽고 문제 데이터 구조를 파악하라:

- `CLAUDE.md`
- `docs/ARCHITECTURE.md` → *questions.ts 명세* 섹션
- `docs/ADR.md` → ADR-002, ADR-013
- `src/data/questions.ts` (기존 120개 문제 배열)
- `prisma/schema.prisma` (step 0에서 생성)
- `src/lib/prisma.ts` (step 0에서 생성)

## 작업

이 step은 기존 `questions.ts`의 120개 문제를 Supabase DB에 시딩한다.

### 1. `tsx` 설치

```bash
npm install -D tsx
```

### 2. `prisma/seed.ts` 생성

```ts
import { prisma } from '../src/lib/prisma';
import { questions } from '../src/data/questions';

async function main() {
  console.log('기존 OFFICIAL 문제 삭제 후 재삽입...');
  await prisma.question.deleteMany({ where: { status: 'OFFICIAL' } });

  const data = questions.map((q) => ({
    // questions.ts의 id는 "os-001" 형식이지만 DB의 id는 cuid()를 사용한다.
    // questions.ts의 id를 별도 필드(externalId)로 저장하지 않는다.
    // DB id는 자동 생성, questions.ts id는 시딩 후 폐기.
    authorId: null,
    category: q.category,
    question: q.question,
    options: q.options,
    answer: q.answer,
    explanation: q.explanation,
    status: 'OFFICIAL' as const,
  }));

  await prisma.question.createMany({ data });
  console.log(`✓ ${data.length}개 문제 시딩 완료`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
```

**중요**: `questions.ts`의 string id (`os-001` 등)는 DB에서 사용하지 않는다. DB는 cuid()로 자동 생성한다. 기존 `questions.ts`는 시딩 소스로만 사용하며 삭제하지 않는다.

### 3. `package.json`에 시드 스크립트 추가

```json
"scripts": {
  ...기존...,
  "db:seed": "tsx prisma/seed.ts"
}
```

### 4. 시드 실행

```bash
npm run db:seed
```

성공 메시지(`✓ 120개 문제 시딩 완료`) 확인.

## Acceptance Criteria

```bash
npm run build     # 컴파일 에러 없음
npm run db:seed   # 120개 문제 시딩 성공
```

## 검증 절차

1. `prisma/seed.ts` 존재 확인
2. `package.json`에 `"db:seed"` 스크립트 추가 확인
3. `npm run db:seed` 실행 — 에러 없이 완료 확인
4. (선택) Supabase 대시보드 또는 `npx prisma studio`에서 Question 테이블 120개 row 확인
5. 결과에 따라 `phases/1-infra/index.json`의 step 3 status 업데이트:
   - 성공 → `"status": "completed"`, `"summary": "questions.ts 120개 → DB Question 테이블 시딩 완료 (status: OFFICIAL). npm run db:seed 스크립트 추가."`
   - 실패 → `"status": "error"`, `"error_message": "구체적 에러 내용"`

## 금지사항

- `questions.ts`를 삭제하지 마라. 이유: 기존 테스트(`questions.test.ts`)가 이 파일을 참조한다. 시딩 이후에도 유지한다.
- `questions.ts`의 문자열 id (`os-001` 등)를 DB id로 그대로 사용하지 마라. 이유: DB id는 cuid() 자동 생성. 문자열 id는 questions.ts 내부 참조용이었으며 v2에서는 DB id를 사용한다.
- `createMany` 실패 시 에러를 무시하지 마라. `catch`에서 `process.exit(1)` 호출하라.
- 기존 테스트를 깨뜨리지 마라.
