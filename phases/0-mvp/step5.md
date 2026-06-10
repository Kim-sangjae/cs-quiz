# Step 5: start-page

## 읽어야 할 파일

먼저 아래 파일들을 읽고 시작 화면 설계를 파악하라:

- `CLAUDE.md`
- `docs/PRD.md` (1. 시작 화면 섹션)
- `docs/ARCHITECTURE.md` (패턴 및 렌더링 전략 섹션)
- `docs/UI_GUIDE.md` (레이아웃, 타이포그래피 섹션)

이전 step에서 생성된 파일을 읽어라:

- `src/data/questions.ts` (총 문제 수 파악용)
- `src/components/` 하위 컴포넌트들 (어떤 컴포넌트가 있는지 파악)

## 작업

이 step은 루트 레이아웃과 시작 화면(`/`)을 구현한다.

### 1. `src/app/layout.tsx` 수정

create-next-app이 생성한 기본 `layout.tsx`를 아래 요구사항에 맞게 수정하라:

```ts
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'CS Quiz',
  description: 'CS 기초 지식을 30문제로 점검하세요',
};
```

레이아웃 요소:
- `<html lang="ko">`
- `<body>` 클래스에 `bg-[#0a0a0a] min-h-screen text-white` 포함
- 기본 Next.js 폰트(Inter 또는 Geist) 유지 또는 제거 (선택)
- `children` 렌더링

### 2. `src/app/page.tsx` 수정 또는 생성

**Server Component** — `"use client"` 선언하지 말 것.

```ts
import { questions } from '@/data/questions';

const total = questions.length;
```

UI 구성:
- 페이지 래퍼: `min-h-screen flex flex-col items-center justify-center px-4`
- 컨텐츠 영역: `max-w-2xl w-full`
- 타이틀: `"CS Quiz"` — `text-2xl font-semibold text-white mb-2`
- 부제: `"CS 기초 지식을 30문제로 점검하세요"` — `text-neutral-400 mb-8`
- 통계 텍스트: `"전체 {total}문제 중 30개 랜덤 출제"` — `text-sm text-neutral-500 mb-8`
- 시작 버튼: `next/link`의 `<Link href="/quiz">` — Primary 버튼 스타일 적용
  - `rounded-md bg-white text-black text-sm font-medium px-6 py-2.5 hover:bg-neutral-200 transition-colors`

## Acceptance Criteria

```bash
npm run build   # 컴파일 에러 없음
```

## 검증 절차

1. `npm run build` 실행 — 에러 없이 완료 확인
2. `src/app/page.tsx`에 `"use client"` 없는지 확인 (Server Component)
3. `useState`, `useEffect` 등 클라이언트 훅이 없는지 확인
4. `questions.length`를 사용해 총 문제 수를 표시하는지 확인
5. 결과에 따라 `phases/0-mvp/index.json`의 step 5 status 업데이트:
   - 성공 → `"status": "completed"`, `"summary": "layout.tsx(메타데이터/다크 배경) + 시작 화면(/) Server Component 구현 완료"`
   - 실패 → `"status": "error"`, `"error_message": "구체적 에러 내용"`

## 금지사항

- `src/app/page.tsx`에 `"use client"`를 붙이지 마라. 이유: 시작 화면은 상호작용이 없는 정적 컨텐츠로 Server Component여야 한다.
- `useState`, `useEffect`를 `page.tsx`에서 사용하지 마라.
- create-next-app이 생성한 기본 페이지 내용(Next.js 로고, 링크 목록 등)을 그대로 두지 마라. 이유: CS Quiz 시작 화면으로 교체해야 한다.
- 기존 테스트를 깨뜨리지 마라.
