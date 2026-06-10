# Step 1: board-list-ui

## 읽어야 할 파일

먼저 아래 파일들을 읽고 UI 스타일과 기존 컴포넌트 패턴을 파악하라:

- `CLAUDE.md`
- `docs/UI_GUIDE.md` → 색상 팔레트, 컴포넌트 스타일 토큰, 안티패턴
- `docs/PRD.md` → *v2 기능 명세* → *6. 게시판 목록* 섹션
- `docs/ARCHITECTURE.md` → *v2 렌더링 전략* 섹션
- `src/app/api/questions/route.ts` (step 0에서 생성)
- `src/components/Header.tsx` (기존 컴포넌트 스타일 참고)

## 작업

이 step은 게시판 목록 페이지와 관련 컴포넌트를 구현한다.

### 1. `src/components/board/SearchBar.tsx` 생성 (Client Component)

- 검색어 입력 필드
- URL 파라미터 `q`를 읽고 씀 (`useSearchParams`, `useRouter`)
- 입력 후 300ms debounce → URL 업데이트 (페이지는 1로 리셋)
- 클리어(X) 버튼 포함

### 2. `src/components/board/FilterBar.tsx` 생성 (Client Component)

- 카테고리 필터: `전체 | 자료구조 | 알고리즘 | OS | 네트워크 | DB | 컴퓨터구조`
- 상태 필터: `전체 | 등록요청 | 승인`
- 정렬: `최신순 | 정답률 낮은순 | 정답률 높은순 | 좋아요순`
- 각 변경 시 URL 파라미터 업데이트 (페이지는 1로 리셋)

### 3. `src/components/board/QuestionCard.tsx` 생성

표시 항목:
- 카테고리 뱃지 (색상은 UI_GUIDE.md 카테고리 색상 참고)
- 상태 뱃지: `등록요청` (amber) / `승인` (green)
- 작성자 닉네임 (없으면 "익명")
- 시도 횟수, 정답률 (attemptCount=0이면 "–")
- 좋아요 수
- 등록일 (간략 형식: "3일 전")
- 문제 텍스트 앞 50자 + "..."

### 4. `src/components/board/Pagination.tsx` 생성 (Client Component)

- 현재 페이지, 전체 페이지 수 props 받기
- 이전/다음 버튼 + 페이지 번호 버튼 (최대 5개 표시)
- 클릭 시 URL `?page=N` 업데이트

### 5. `src/app/board/page.tsx` 생성 (Server Component)

```ts
// searchParams: { q, cat, status, sort, page }
// fetch('/api/questions', { params }) → questions, totalCount, pageCount
// Server Component이므로 직접 Prisma 호출도 가능 (API 호출 대신)
```

레이아웃: 상단 SearchBar + FilterBar → 질문 카드 목록 → 하단 Pagination

빈 결과: "검색 결과가 없습니다." 안내 메시지

## Acceptance Criteria

```bash
npm run build   # 컴파일 에러 없음
```

## 검증 절차

1. `src/components/board/` 하위 4개 컴포넌트 존재 확인
2. `src/app/board/page.tsx` 존재 확인
3. `npm run build` 통과 확인
4. 결과에 따라 `phases/3-board/index.json`의 step 1 status 업데이트:
   - 성공 → `"status": "completed"`, `"summary": "게시판 목록 UI 구현 완료 (SearchBar, FilterBar, QuestionCard, Pagination, board/page.tsx)."`
   - 실패 → `"status": "error"`, `"error_message": "구체적 에러 내용"`

## 금지사항

- `SearchBar`, `FilterBar`, `Pagination`을 Server Component로 만들지 마라. 이유: URL 파라미터를 읽고 업데이트하는 `useSearchParams`, `useRouter`는 클라이언트 전용 훅이다.
- `board/page.tsx`를 Client Component로 만들지 마라. 이유: 검색 결과는 URL 파라미터 기반 SSR로 처리해야 SEO와 공유 링크를 지원한다.
- UI_GUIDE.md 안티패턴 (blur, gradient-text, 보라색 등)을 사용하지 마라.
- 기존 테스트를 깨뜨리지 마라.
