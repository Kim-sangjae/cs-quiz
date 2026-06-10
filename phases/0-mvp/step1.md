# Step 1: core-types

## 읽어야 할 파일

먼저 아래 파일들을 읽고 타입 설계를 파악하라:

- `CLAUDE.md`
- `docs/ARCHITECTURE.md`
- `docs/ADR.md`

이전 step에서 생성된 파일도 확인하라:

- `src/` 디렉토리 구조 (step 0에서 생성)
- `package.json` (vitest 설정 확인)

## 작업

이 step은 프로젝트 전체에서 사용하는 공유 타입과 sessionStorage 타입 가드를 구현한다.

### 1. `src/types/index.ts` 생성

아래 타입들을 정확히 이 인터페이스로 정의하라:

```ts
export type Category = 'ds' | 'algo' | 'os' | 'network' | 'db' | 'arch';

export interface Question {
  id: string;               // 형식: "{category}-{세 자리 순번}" (예: "os-001")
  category: Category;
  question: string;
  options: [string, string, string, string];  // 인덱스 0=A, 1=B, 2=C, 3=D
  answer: 0 | 1 | 2 | 3;   // 정답 보기 인덱스
  explanation: string;      // 정답 이유 1~3문장
}

export interface UserAnswer {
  questionId: string;
  selected: 0 | 1 | 2 | 3;
}

export interface QuizResult {
  questions: Question[];
  answers: UserAnswer[];
  score: number;            // 정답 수 (0~30)
  submittedAt: string;      // ISO 8601
}
```

위 4개 타입 외에 추가 타입은 이 step에서 만들지 않는다.

### 2. `src/lib/guard.ts` 생성

```ts
import type { QuizResult } from '@/types';

export function isQuizResult(data: unknown): data is QuizResult
```

검증 항목 (순서대로, 하나라도 실패하면 `false` 반환):
1. `data`가 object이고 `null`이 아님
2. `'questions' in data` && `Array.isArray(data.questions)` && `data.questions.length > 0`
3. `'answers' in data` && `Array.isArray(data.answers)`
4. `'score' in data` && `typeof data.score === 'number'` && `data.score >= 0`
5. `'submittedAt' in data` && `typeof data.submittedAt === 'string'` && `data.submittedAt.length > 0`

`data.questions` 배열 내 각 Question의 필드까지 재귀 검증하지 않는다.

### 3. `src/lib/guard.test.ts` 생성

아래 케이스를 모두 테스트하라:

```ts
// 통과해야 하는 케이스
- 유효한 QuizResult 객체 → true

// 실패해야 하는 케이스
- questions가 빈 배열([]) → false
- questions 필드 없음 → false
- answers 필드 없음 → false
- score가 string → false
- score가 음수(-1) → false
- submittedAt이 빈 문자열("") → false
- null 입력 → false
- 문자열("string") 입력 → false
- 빈 배열([]) 입력 → false
```

## Acceptance Criteria

```bash
npm run build   # 타입 에러 없음
npm test        # guard.test.ts 모든 케이스 통과
```

## 검증 절차

1. `npm run build` 실행 — TypeScript 컴파일 에러 없어야 함
2. `npm test` 실행 — 모든 guard 테스트 통과 확인
3. `src/types/index.ts`에 4개 타입이 모두 export되어 있는지 확인
4. 결과에 따라 `phases/0-mvp/index.json`의 step 1 status 업데이트:
   - 성공 → `"status": "completed"`, `"summary": "Category/Question/UserAnswer/QuizResult 타입 정의 + isQuizResult 가드 + 테스트 10개 통과"`
   - 실패 → `"status": "error"`, `"error_message": "구체적 에러 내용"`

## 금지사항

- `any` 타입을 사용하지 마라. 이유: TypeScript strict mode이며 타입 안전성이 핵심이다.
- `Question.answer`를 optional(`answer?`)로 만들지 마라. 이유: 모든 문제는 반드시 정답이 있어야 한다.
- guard.ts에서 `data.questions` 내부 각 Question 필드까지 재귀 검증하지 마라. 이유: 과도한 검증은 유지보수 부담을 높이고 이 step의 scope를 벗어난다.
- 기존 테스트를 깨뜨리지 마라.
