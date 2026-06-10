# Step 4: ui-components

## 읽어야 할 파일

먼저 아래 파일들을 읽고 컴포넌트 설계와 스타일 가이드를 파악하라:

- `CLAUDE.md`
- `docs/ARCHITECTURE.md` (컴포넌트 인터페이스, Client Component 경계 섹션)
- `docs/UI_GUIDE.md` (컴포넌트 스타일, 색상, 상태별 UI 정의 섹션 전체)
- `src/types/index.ts`

이전 step에서 생성된 파일을 읽어라:

- `src/lib/sample.ts`
- `src/lib/grade.ts`

## 작업

이 step은 퀴즈와 결과 화면에서 공유하는 UI 컴포넌트 4개를 구현한다.

### 공통 규칙

- `"use client"`: `QuizCard`, `Navigator`에만 선언. `ProgressBar`, `ResultCard`에는 붙이지 않는다.
- 스타일: `docs/UI_GUIDE.md`의 색상과 클래스를 그대로 사용한다.
- Props 인터페이스: 아래 명세 그대로. 임의 prop 추가 금지.
- 모든 파일은 `src/components/` 하위에 생성한다.

---

### 1. `src/components/QuizCard.tsx`

```ts
"use client";
import type { Question } from '@/types';

interface QuizCardProps {
  questionNumber: number;    // 1-based 표시용
  total: number;             // 30
  question: string;
  options: [string, string, string, string];
  selectedIndex: number | null;
  onSelect: (index: 0 | 1 | 2 | 3) => void;
}
```

UI 구성:
- 카드 래퍼: `bg-[#111111] border border-neutral-800 rounded-lg p-6`
- 보기 버튼 4개. 각 버튼 앞에 `A.` / `B.` / `C.` / `D.` 레이블 표시
- 미선택 보기: `w-full text-left rounded-md border border-neutral-800 bg-[#1a1a1a] px-4 py-3 text-sm text-neutral-200 hover:border-neutral-600 hover:bg-[#222222] transition-colors`
- 선택된 보기: `border-blue-500 bg-blue-500/10 text-white`

**QuizCard에 `answer`, `explanation` prop을 추가하지 않는다.**

---

### 2. `src/components/Navigator.tsx`

```ts
"use client";

interface NavigatorProps {
  total: number;             // 30
  currentIndex: number;      // 0-based
  answeredIndices: number[]; // 답안 선택 완료된 문제 인덱스 목록
  onJump: (index: number) => void;
}
```

UI 구성:
- 번호 버튼 grid: `grid grid-cols-10 gap-1 sm:grid-cols-15`
- 미선택: `w-8 h-8 rounded text-xs font-medium bg-neutral-900 text-neutral-500 hover:bg-neutral-800`
- 선택됨(answeredIndices에 포함): `bg-neutral-700 text-white`
- 현재(currentIndex): `bg-white text-black`
- 버튼 표시 숫자: 1-based (index + 1)

---

### 3. `src/components/ProgressBar.tsx`

```ts
interface ProgressBarProps {
  answered: number;   // 선택 완료한 문제 수
  total: number;      // 30
}
```

UI 구성:
- 배경: `w-full bg-neutral-800 rounded-full h-1`
- 채움: `bg-white rounded-full h-1 transition-all duration-200`
- width: `${Math.min((answered / total) * 100, 100)}%`

---

### 4. `src/components/ResultCard.tsx`

```ts
import type { Question } from '@/types';

interface ResultCardProps {
  questionNumber: number;       // 1-based
  question: Question;
  userSelected: 0 | 1 | 2 | 3;
}
```

UI 구성:
- 카드 래퍼: `bg-[#111111] border border-neutral-800 rounded-lg p-6`
- 카테고리 배지: `text-xs text-neutral-500 border border-neutral-800 rounded px-2 py-0.5`
- 문제 번호: `Q.{questionNumber}` `text-sm text-neutral-500`
- 문제 텍스트: `text-base font-medium text-white leading-relaxed`
- 보기 4개 (클릭 불가, `cursor-default`):
  - 정답(`question.answer`): `border-green-500 bg-green-500/10 text-green-400`
  - 내 오답(`userSelected`, 정답과 다를 때): `border-red-500 bg-red-500/10 text-red-400`
  - 나머지: `border-neutral-800 bg-[#1a1a1a] text-neutral-600 opacity-40`
- 해설 영역: `border-t border-neutral-800 mt-4 pt-4 text-sm text-neutral-300 leading-relaxed`

## Acceptance Criteria

```bash
npm run build   # 컴파일 에러 없음
```

## 검증 절차

1. `npm run build` 실행 — TypeScript 에러 없음 확인
2. `QuizCard.tsx`, `Navigator.tsx`에 `"use client"` 있는지 확인
3. `ProgressBar.tsx`, `ResultCard.tsx`에 `"use client"` 없는지 확인
4. `QuizCard`의 props에 `answer`, `explanation`이 없는지 확인
5. 결과에 따라 `phases/0-mvp/index.json`의 step 4 status 업데이트:
   - 성공 → `"status": "completed"`, `"summary": "QuizCard/Navigator/ProgressBar/ResultCard 4개 컴포넌트 구현 완료. Client Component 경계 준수."`
   - 실패 → `"status": "error"`, `"error_message": "구체적 에러 내용"`

## 금지사항

- `ProgressBar`, `ResultCard`에 `"use client"`를 붙이지 마라. 이유: 이벤트 핸들러가 없으므로 Server Component로 사용 가능하며, 불필요한 Client Component 확장을 피한다.
- `QuizCard`에 `answer` 또는 `explanation` prop을 추가하지 마라. 이유: CLAUDE.md CRITICAL — 퀴즈 진행 중 정답 노출 금지.
- `UI_GUIDE.md`에 없는 보라/인디고 계열 색상을 사용하지 마라. 이유: UI_GUIDE.md의 AI 슬롭 안티패턴 금지 목록에 포함된다.
- 기존 테스트를 깨뜨리지 마라.
