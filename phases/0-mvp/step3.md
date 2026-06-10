# Step 3: quiz-logic

## 읽어야 할 파일

먼저 아래 파일들을 읽고 로직 설계를 파악하라:

- `CLAUDE.md`
- `docs/ARCHITECTURE.md` (모듈별 상세 명세, 데이터 흐름 섹션)
- `docs/ADR.md` (ADR-006: Fisher-Yates, ADR-007: 진행상태 미저장)
- `src/types/index.ts`
- `src/data/questions.ts` (문제 데이터 구조 파악용 — 처음 몇 개만 확인)

이전 step에서 생성된 파일을 읽고 설계 의도를 확인하라:

- `src/lib/guard.ts`
- `src/lib/guard.test.ts`

## 작업

이 step은 퀴즈 핵심 로직 두 가지 — 랜덤 샘플링과 채점 — 을 순수 함수로 구현하고 테스트한다.

### 1. `src/lib/sample.ts` 생성

```ts
import type { Question } from '@/types';

export function sample(pool: Question[], n: number): Question[]
```

구현 규칙:
- **반드시 Fisher-Yates 셔플 알고리즘**을 사용한다
- 원본 `pool` 배열을 직접 변경하지 않는다 (얕은 복사 후 셔플)
- `pool.length === 0` → 빈 배열 반환
- `pool.length < n` → `console.error('[sample] pool size(' + pool.length + ') < requested(' + n + '). Returning full pool.')` 출력 후 셔플된 pool 전체 반환
- `pool.length >= n` → 셔플 후 앞 `n`개 반환
- 순수 함수 — 부수효과 없음 (console.error 제외)

### 2. `src/lib/grade.ts` 생성

```ts
import type { Question, UserAnswer, QuizResult } from '@/types';

export function grade(questions: Question[], answers: UserAnswer[]): QuizResult
```

구현 규칙:
- 각 question에 대해 `answers.find(a => a.questionId === question.id)`로 답안 조회
- 답안이 없거나 `userAnswer.selected !== question.answer`이면 오답
- `score` = 정답 수 (0 이상 정수)
- `submittedAt` = `new Date().toISOString()`
- 순수 함수 (submittedAt 제외)

### 3. `src/lib/sample.test.ts` 생성

아래 케이스를 모두 테스트하라:

```ts
// 반환 길이 == n (pool.length > n 인 경우)
// 반환 배열에 중복 없음 (id 기준 Set)
// pool.length < n → 전체 pool 반환 (길이 == pool.length)
// pool.length === 0 → 빈 배열 반환
// pool.length === n → pool 전체 반환 (셔플됨)
// 원본 pool 배열이 변경되지 않음 (호출 전후 길이 동일)
```

### 4. `src/lib/grade.test.ts` 생성

아래 케이스를 모두 테스트하라:

```ts
// 30문제 전부 정답 → score === 30
// 30문제 전부 오답 → score === 0
// 일부 정답 (예: 15개) → score === 15
// answers에 일부 questionId 누락 → 누락된 문제 오답 처리 (score에 포함 안 됨)
// 반환 QuizResult에 questions, answers, score, submittedAt 필드 모두 존재
// submittedAt이 ISO 8601 형식 (new Date(submittedAt)이 유효한 Date)
```

## Acceptance Criteria

```bash
npm run build   # 타입 에러 없음
npm test        # sample.test.ts + grade.test.ts 포함 모든 테스트 통과
```

## 검증 절차

1. `npm run build` 실행 — 에러 없이 통과
2. `npm test` 실행 — 전체 테스트 통과 (guard, sample, grade)
3. `src/lib/sample.ts` 코드에 `Array.sort`가 없는지 확인
4. 결과에 따라 `phases/0-mvp/index.json`의 step 3 status 업데이트:
   - 성공 → `"status": "completed"`, `"summary": "sample.ts(Fisher-Yates) + grade.ts 순수 함수 구현. 유닛 테스트 전부 통과."`
   - 실패 → `"status": "error"`, `"error_message": "구체적 에러 내용"`

## 금지사항

- `Array.sort(() => Math.random() - 0.5)`로 셔플하지 마라. 이유: ADR-006 — sort 기반 셔플은 분포가 불균일하다.
- `pool` 원본 배열을 직접 변경(splice, in-place sort 등)하지 마라. 이유: 순수 함수여야 하며 호출부의 데이터를 변경하면 안 된다.
- `grade.ts`에서 `sessionStorage`, `localStorage`, DOM API를 사용하지 마라. 이유: 순수 함수이므로 브라우저 환경에 의존하지 않아야 한다.
- 기존 테스트를 깨뜨리지 마라.
