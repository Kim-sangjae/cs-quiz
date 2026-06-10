# Step 7: result-page

## 읽어야 할 파일

먼저 아래 파일들을 읽고 결과 화면 설계를 파악하라:

- `CLAUDE.md`
- `docs/PRD.md` (3. 결과 화면 섹션 전체, 에러 케이스 E-1~E-2)
- `docs/ARCHITECTURE.md` (에러 핸들링 섹션, sessionStorage 규칙)
- `docs/ADR.md` (ADR-004, ADR-008)
- `docs/UI_GUIDE.md` (점수 색상 기준, 오답 카드 구조, 상태별 UI 정의 섹션)

이전 step에서 생성된 파일을 꼼꼼히 읽어라:

- `src/types/index.ts`
- `src/lib/guard.ts`
- `src/components/ResultCard.tsx`
- `src/app/quiz/page.tsx` (sessionStorage key 확인: `'cs-quiz-result'`)

## 작업

이 step은 결과 화면(`/result`)을 구현한다.

### `src/app/result/page.tsx` 생성

```ts
"use client";
```

**상태**:

```ts
const [result, setResult] = useState<QuizResult | null>(null);
```

**초기화** (useEffect, 의존성 배열 `[]`):

```ts
useEffect(() => {
  try {
    const raw = sessionStorage.getItem('cs-quiz-result');
    if (!raw) {
      router.replace('/');
      return;
    }
    const parsed = JSON.parse(raw);
    if (!isQuizResult(parsed)) {
      router.replace('/');
      return;
    }
    sessionStorage.removeItem('cs-quiz-result'); // 즉시 삭제 — ADR-008
    setResult(parsed);
  } catch (e) {
    console.error('[ResultPage] sessionStorage read failed:', e);
    router.replace('/');
  }
}, []);
```

**로딩 상태**:

```ts
if (result === null) return null; // 리다이렉트 대기 중 — 빈 화면
```

**점수 색상 계산**:

```ts
// result.score >= 27 → 'text-green-400'
// result.score >= 21 → 'text-yellow-400'
// 그 외              → 'text-red-400'
```

**평가 메시지**:

```ts
// result.score >= 27 → '우수 — CS 기초가 탄탄합니다'
// result.score >= 21 → '양호 — 취약 부분을 확인하세요'
// 그 외              → '분발 — 오답 해설을 꼼꼼히 읽어보세요'
```

**오답 목록 계산**:

```ts
const wrongItems = result.questions
  .map((q, i) => ({
    question: q,
    questionNumber: i + 1,
    userAnswer: result.answers.find(a => a.questionId === q.id),
  }))
  .filter(({ question, userAnswer }) =>
    !userAnswer || userAnswer.selected !== question.answer
  );
```

**UI 구성**:

```
max-w-2xl mx-auto px-4 py-8
├── 점수 영역 (text-center):
│   ├── "{result.score}" (text-4xl font-bold + 점수 색상)
│   ├── "/ 30" (text-4xl text-neutral-500)
│   ├── 평가 메시지 (text-sm + 점수 색상)
│   └── "정답 {result.score}개 · 오답 {30 - result.score}개" (text-sm text-neutral-400)
│
├── 오답 목록:
│   - wrongItems.length === 0 → "모든 문제를 맞혔습니다! 🎉" (text-green-400 text-center)
│   - wrongItems.length > 0  → ResultCard 목록 (space-y-4)
│
└── 하단 버튼 행 (flex gap-3 justify-center mt-8):
    ├── "다시 풀기" 버튼 → router.push('/quiz') (Primary 버튼 스타일)
    └── "홈으로" 버튼 → router.push('/') (Secondary 버튼 스타일)
```

**ResultCard에 전달할 props**:

```ts
<ResultCard
  key={item.question.id}
  questionNumber={item.questionNumber}
  question={item.question}
  userSelected={item.userAnswer!.selected}
/>
```

## Acceptance Criteria

```bash
npm run build   # 컴파일 에러 없음
npm run lint    # lint 에러 없음
npm test        # 기존 테스트 모두 통과
```

## 검증 절차

1. `npm run build` 실행 — 에러 없음 확인
2. `npm run lint` 실행 — 에러 없음 확인
3. `npm test` 실행 — 기존 테스트 전부 통과 확인
4. `sessionStorage.removeItem`이 `setResult(parsed)` **이전**에 호출되는지 확인 (ADR-008)
5. `result === null`일 때 `return null`로 처리되는지 확인
6. `isQuizResult` 검증 실패 시 `router.replace('/')`로 처리되는지 확인
7. 결과에 따라 `phases/0-mvp/index.json`의 step 7 status 업데이트:
   - 성공 → `"status": "completed"`, `"summary": "결과 화면(/result) 구현 완료. 점수 색상, 오답 해설 목록, sessionStorage 에러 핸들링 포함."`
   - 실패 → `"status": "error"`, `"error_message": "구체적 에러 내용"`

## 금지사항

- `sessionStorage.removeItem`을 useEffect 마지막(setResult 이후)에 호출하지 마라. 이유: ADR-008 — 파싱 직후 즉시 삭제해야 뒤로가기로 재진입 시 리다이렉트된다.
- `result === null`일 때 에러 UI나 로딩 스피너를 렌더링하지 마라. 이유: 이 상태는 리다이렉트 대기 중이며 사용자에게 보여줄 내용이 없다.
- `isQuizResult` 검증 없이 sessionStorage 데이터를 직접 사용하지 마라. 이유: JSON.parse 성공과 타입 일치는 별개다.
- 기존 테스트를 깨뜨리지 마라.
