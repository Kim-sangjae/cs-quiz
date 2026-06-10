# Step 1: session-persist

## 읽어야 할 파일

먼저 아래 파일들을 읽고 현재 퀴즈 플로우를 파악하라:

- `CLAUDE.md`
- `docs/ARCHITECTURE.md` → *데이터 흐름*, *v2 데이터베이스 스키마* 섹션
- `src/app/quiz/play/page.tsx` (step 0에서 이동)
- `src/app/result/page.tsx` (현재 sessionStorage 기반)
- `src/lib/prisma.ts`
- `src/lib/auth.ts`
- `prisma/schema.prisma` (QuizSession 모델 확인)

## 작업

이 step은 퀴즈 세션을 sessionStorage 대신 DB에 저장하고, 결과 페이지를 DB 조회 기반으로 전환한다.

### 1. `src/app/api/quiz/sessions/route.ts` 생성

```ts
// POST: 퀴즈 세션 저장
// Request body: { category: string, questionIds: string[], answers: UserAnswer[], score: number }
// - 로그인 필수 (401)
// - QuizSession 레코드 생성
// - 생성된 sessionId 반환: { sessionId: string }
// - DB에서 문제 ID를 동적으로 조회하여 사용 (questions.ts ID가 아닌 DB ID)

// GET: 현재 사용자의 퀴즈 히스토리 (최신순, 최대 20개)
// - 로그인 필수 (401)
// - QuizSession include: { attempts: false } (목록에서는 경량 조회)
```

### 2. `src/app/api/quiz/sessions/[id]/route.ts` 생성

```ts
// GET: 특정 세션 상세 조회
// - 로그인 필수 (401)
// - 세션 소유자 검증 (403)
// - QuizSession + 연결된 Question 전체 데이터 반환
// 응답:
// {
//   session: QuizSession,
//   questions: Question[],  // questionIds 순서대로 DB에서 조회
//   answers: UserAnswer[]
// }
```

### 3. `src/app/quiz/play/page.tsx` 업데이트

퀴즈 진행 및 제출 로직 변경:

**문제 샘플링 변경**: questions.ts 배열 대신 DB에서 조회
```ts
// DB에서 status: OFFICIAL 또는 APPROVED인 문제를 조회
// category 파라미터에 따라 필터 적용
// 랜덤 샘플링은 기존 sample.ts의 Fisher-Yates 로직 재사용 가능
// 단, DB에서 전체 로드 후 샘플링 (현재 규모에서 충분)
```

**제출 로직 변경**: sessionStorage → API POST
```ts
// 기존: sessionStorage.setItem + router.push('/result')
// 변경: POST /api/quiz/sessions → { sessionId } → router.push(`/result/${sessionId}`)
// sessionStorage 관련 코드 전부 제거
// useRef 가드도 제거 (더 이상 필요 없음)
```

### 4. `src/app/result/page.tsx` 업데이트 및 이동

기존 `/result/page.tsx` → `/result/[sessionId]/page.tsx`로 이동:

```
src/app/result/page.tsx → src/app/result/[sessionId]/page.tsx
```

변경 내용:
- `params.sessionId`로 세션 ID 획득
- GET `/api/quiz/sessions/[id]`로 결과 데이터 조회
- sessionStorage 읽기/삭제 코드 전부 제거
- `saveHistory` import 제거 (DB에 이미 저장됨)
- useRef 가드 제거
- "다시 풀기" 버튼 → `/quiz`로 이동

## Acceptance Criteria

```bash
npm run build   # 컴파일 에러 없음
npm run test    # 기존 테스트 통과
```

## 검증 절차

1. `src/app/api/quiz/sessions/route.ts`, `src/app/api/quiz/sessions/[id]/route.ts` 존재 확인
2. `src/app/result/[sessionId]/page.tsx` 존재 확인 (`src/app/result/page.tsx`는 삭제 또는 redirect 처리)
3. `src/app/quiz/play/page.tsx`에 sessionStorage 관련 코드 없음 확인
4. `src/app/result/[sessionId]/page.tsx`에 sessionStorage/saveHistory 관련 코드 없음 확인
5. `npm run build && npm run test` 통과 확인
6. 결과에 따라 `phases/2-quiz-v2/index.json`의 step 1 status 업데이트:
   - 성공 → `"status": "completed"`, `"summary": "QuizSession DB 저장 API 생성. /result/[sessionId] 페이지로 전환. sessionStorage 의존성 완전 제거."`
   - 실패 → `"status": "error"`, `"error_message": "구체적 에러 내용"`

## 금지사항

- `src/lib/history.ts`를 삭제하지 마라. 이유: 아직 `mypage/page.tsx`에서 localStorage 기반으로 사용 중. 6-mypage-v2 phase에서 제거한다.
- `grade.ts`를 수정하지 마라. 이유: 채점 로직은 순수 함수로 그대로 재사용 가능하다.
- 기존 단위 테스트 파일(`sample.test.ts`, `grade.test.ts`, `guard.test.ts`, `questions.test.ts`)을 수정하지 마라.
