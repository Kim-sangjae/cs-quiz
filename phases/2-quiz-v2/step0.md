# Step 0: quiz-select

## 읽어야 할 파일

먼저 아래 파일들을 읽고 퀴즈 플로우를 파악하라:

- `CLAUDE.md`
- `docs/PRD.md` → *v2 기능 명세* → *5. 퀴즈 선택 화면* 섹션
- `docs/ARCHITECTURE.md` → *v2 렌더링 전략* 섹션
- `docs/UI_GUIDE.md` → 색상 팔레트, 안티패턴
- `src/app/quiz/page.tsx` (기존 퀴즈 진행 화면)
- `src/lib/prisma.ts`
- `src/lib/auth.ts`

## 작업

이 step은 퀴즈 선택 화면을 신규 생성하고, 기존 퀴즈 진행 화면을 `/quiz/play`로 이동한다.

### 1. 기존 퀴즈 진행 화면 이동

`src/app/quiz/page.tsx` → `src/app/quiz/play/page.tsx`로 이동(복사 후 원본 삭제).

이동 후 파일 내부에서 `/quiz`를 참조하는 링크나 라우터 push가 있으면 `/quiz/play`로 수정하라.

아직 sessionStorage 로직은 그대로 유지한다 (step 1에서 교체).

### 2. `src/app/api/quiz/counts/route.ts` 생성

```ts
// GET: 카테고리별 + 전체 풀이 가능한 문제 수 반환
// status가 OFFICIAL 또는 APPROVED인 문제만 집계
// 응답 형식:
// {
//   all: number,
//   ds: number, algo: number, os: number,
//   network: number, db: number, arch: number
// }
```

로그인 불필요 (공개 API).

### 3. `src/app/quiz/page.tsx` 신규 생성 (Server Component)

카테고리/ALL 선택 화면:

- `/api/quiz/counts` 호출해서 문제 수 가져오기
- 로그인 사용자라면 카테고리별 내 정답률도 표시
  - `QuestionAttempt` 테이블에서 userId + category 기준 집계
  - 로그인 여부 확인: `src/lib/auth.ts`의 `getServerUser()` 사용
- ALL 카드 + 카테고리 6개 카드 표시
- 각 카드: 카테고리명, 문제 수, (로그인 시) 내 정답률
- 문제 10개 미만 카테고리: 버튼 비활성화 + "최소 10개 필요" 표시
- 카드 클릭 → `/quiz/play?category={cat|all}` 이동

UI_GUIDE.md 스타일 준수. 기존 퀴즈 화면과 동일한 다크 테마.

### 4. `src/app/quiz/play/page.tsx` 업데이트

`?category` 쿼리 파라미터를 읽어서 해당 카테고리 문제만 샘플링하도록 수정:

```ts
// searchParams.category가 'all' 또는 undefined면 전체 문제 중 샘플링
// 특정 카테고리면 해당 카테고리만 샘플링
// 단, 아직 questions.ts에서 샘플링 (DB 전환은 step 1에서)
```

## Acceptance Criteria

```bash
npm run build   # 컴파일 에러 없음
npm run test    # 기존 테스트 통과
```

## 검증 절차

1. `src/app/quiz/play/page.tsx` 존재 확인 (기존 퀴즈 로직 보존)
2. `src/app/quiz/page.tsx` 신규 선택 화면 확인
3. `src/app/api/quiz/counts/route.ts` 존재 확인
4. `npm run build && npm run test` 통과 확인
5. 결과에 따라 `phases/2-quiz-v2/index.json`의 step 0 status 업데이트:
   - 성공 → `"status": "completed"`, `"summary": "퀴즈 선택 화면(/quiz) 신규 생성. 기존 퀴즈 진행 화면 → /quiz/play 이동. 카테고리별 문제 수 API 생성."`
   - 실패 → `"status": "error"`, `"error_message": "구체적 에러 내용"`

## 금지사항

- 기존 `src/app/quiz/page.tsx`(퀴즈 진행 로직)를 덮어쓰지 마라. 이유: 반드시 `play/page.tsx`로 이동한 뒤 새로운 선택 화면을 `/quiz`에 작성해야 한다.
- step 1 이전에 sessionStorage 로직을 제거하지 마라. 이유: DB 세션 API가 없으면 퀴즈 제출이 동작하지 않는다.
- 기존 테스트를 깨뜨리지 마라.
