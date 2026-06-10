# Step 6: quiz-page

## 읽어야 할 파일

먼저 아래 파일들을 읽고 퀴즈 화면 설계를 파악하라:

- `CLAUDE.md`
- `docs/PRD.md` (2. 퀴즈 진행 화면 섹션 전체, 에러 케이스 E-1~E-6)
- `docs/ARCHITECTURE.md` (상태 관리, sessionStorage 규칙, 에러 핸들링 섹션)
- `docs/ADR.md` (ADR-003, ADR-004, ADR-007, ADR-010, ADR-011)
- `docs/UI_GUIDE.md` (보기 버튼 상태, 하단 컨트롤 영역, 반응형 섹션)

이전 step에서 생성된 파일을 꼼꼼히 읽어라:

- `src/types/index.ts`
- `src/data/questions.ts` (import 경로 확인)
- `src/lib/sample.ts`
- `src/lib/grade.ts`
- `src/components/QuizCard.tsx`
- `src/components/Navigator.tsx`
- `src/components/ProgressBar.tsx`

## 작업

이 step은 퀴즈 진행 화면(`/quiz`)을 구현한다.

### `src/app/quiz/page.tsx` 생성

```ts
"use client";
```

**상태**:

```ts
const [questions, setQuestions] = useState<Question[]>([]);
const [answers, setAnswers] = useState<UserAnswer[]>([]);
const [currentIndex, setCurrentIndex] = useState(0);
```

**초기화** (컴포넌트 마운트 시 1회, useEffect 또는 useState initializer):

```ts
// import { questions as allQuestions } from '@/data/questions';
// import { sample } from '@/lib/sample';
// 마운트 시: sample(allQuestions, 30) 결과를 questions state에 설정
```

**답안 upsert 함수**:

```ts
// questionId가 answers에 이미 있으면 selected 교체, 없으면 새 항목 추가
function handleSelect(questionId: string, selected: 0 | 1 | 2 | 3): void
```

**제출 처리**:

```ts
function handleSubmit(): void {
  try {
    const result = grade(questions, answers);
    sessionStorage.setItem('cs-quiz-result', JSON.stringify(result));
    router.push('/result');
  } catch (e) {
    console.error('[QuizPage] sessionStorage write failed:', e);
    router.replace('/');
  }
}
```

**레이아웃 구성**:

```
max-w-2xl mx-auto px-4 py-8
├── 상단: "{currentIndex + 1} / {questions.length}" + ProgressBar
├── 중간: QuizCard (현재 문제)
└── 하단(sticky bottom-0 bg-[#0a0a0a] border-t border-neutral-800 py-4):
    ├── Navigator
    └── 버튼 행 (flex justify-between):
        ├── 이전 버튼 (currentIndex === 0이면 disabled)
        └── 오른쪽:
            ├── 미선택 카운트 (answers.length < questions.length이면 표시):
            │   "{questions.length - answers.length}문제 미선택" text-xs text-neutral-500
            ├── 다음 버튼 (currentIndex === questions.length - 1이면 disabled)
            └── 제출 버튼 (answers.length < questions.length이면 disabled)
```

**QuizCard에 전달할 props**:

```ts
<QuizCard
  questionNumber={currentIndex + 1}
  total={questions.length}
  question={questions[currentIndex].question}
  options={questions[currentIndex].options}
  selectedIndex={answers.find(a => a.questionId === questions[currentIndex].id)?.selected ?? null}
  onSelect={(idx) => handleSelect(questions[currentIndex].id, idx)}
/>
```

## Acceptance Criteria

```bash
npm run build   # 컴파일 에러 없음
```

## 검증 절차

1. `npm run build` 실행 — 에러 없이 통과
2. `"use client"` 선언 있는지 확인
3. `QuizCard`에 `answer`, `explanation`을 넘기지 않는지 확인
4. sessionStorage 쓰기가 try/catch로 감싸져 있는지 확인
5. 제출 버튼이 `answers.length < questions.length`일 때 `disabled`인지 확인
6. 결과에 따라 `phases/0-mvp/index.json`의 step 6 status 업데이트:
   - 성공 → `"status": "completed"`, `"summary": "퀴즈 진행 화면(/quiz) 구현 완료. 답안 upsert, 네비게이션, sessionStorage 에러 핸들링 포함."`
   - 실패 → `"status": "error"`, `"error_message": "구체적 에러 내용"`

## 금지사항

- `QuizCard`에 `questions[currentIndex].answer`를 prop으로 넘기지 마라. 이유: CLAUDE.md CRITICAL — 퀴즈 진행 중 정답 노출 금지.
- 보기 선택 시 자동으로 다음 문제로 이동하지 마라. 이유: ADR-010 — 사용자가 검토·변경할 기회를 보장해야 한다.
- `questions.ts`의 보기(options) 순서를 셔플하지 마라. 이유: ADR-011 — answer 인덱스 매핑이 깨진다.
- sessionStorage 쓰기를 try/catch 없이 호출하지 마라. 이유: 일부 브라우저 private 모드에서 쓰기가 차단된다.
- 기존 테스트를 깨뜨리지 마라.
