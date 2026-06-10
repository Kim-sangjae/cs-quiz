# Step 2: board-detail

## 읽어야 할 파일

먼저 아래 파일들을 읽고 상세 페이지 명세를 파악하라:

- `CLAUDE.md`
- `docs/PRD.md` → *v2 기능 명세* → *6. 게시판 상세* 섹션
- `docs/UI_GUIDE.md` → 색상 팔레트, 안티패턴
- `docs/ARCHITECTURE.md` → *v2 렌더링 전략* 섹션
- `src/app/api/questions/[id]/route.ts` (step 0에서 생성)
- `src/lib/auth.ts`
- `src/lib/prisma.ts`
- `prisma/schema.prisma` (Like, Report 모델 확인)

## 작업

이 step은 게시판 상세 페이지, 좋아요 API, 신고 API를 구현한다.

### 1. `src/app/api/questions/[id]/like/route.ts` 생성

```ts
// POST: 좋아요 토글
// - 로그인 필수 (401)
// - 이미 좋아요 → 취소 (Like 레코드 삭제)
// - 아직 좋아요 없음 → 추가 (Like 레코드 생성)
// - 응답: { liked: boolean, likeCount: number }
```

### 2. `src/app/api/questions/[id]/report/route.ts` 생성

```ts
// POST: 신고 제출
// - 로그인 필수 (401)
// - 본인 문제 신고 불가 (403)
// - 중복 신고 불가 (409: "이미 신고한 문제입니다")
// - Body: { reason: ReportReason, description?: string }
// - Report 레코드 생성 (status: PENDING)
// - 응답: 201
```

### 3. `src/components/board/LikeButton.tsx` 생성 (Client Component)

- 하트 아이콘 + 좋아요 수 표시
- 클릭 시 POST `/api/questions/[id]/like`
- 낙관적 업데이트: 클릭 즉시 UI 반영 후 API 응답으로 동기화
- 비로그인 클릭 → `signIn('google')` 호출로 로그인 유도
- TanStack Query `useMutation` 사용

### 4. `src/components/board/ReportModal.tsx` 생성 (Client Component)

- "신고" 버튼 + 모달
- 모달 내: 이유 선택(4개 라디오) + 설명 textarea (선택, 최대 200자)
- 제출 → POST `/api/questions/[id]/report`
- 409 응답 시 "이미 신고한 문제입니다" 표시
- 성공 시 모달 닫기 + 버튼을 "신고 완료" 상태로 변경 (비활성화)

### 5. `src/app/board/[id]/page.tsx` 생성 (Server Component)

표시 내용:
- 카테고리 뱃지, 상태 뱃지, 작성자 닉네임, 등록일
- 문제 전체 텍스트
- 보기 A~D (정답 표시: 초록 강조, 나머지: 기본)
- 해설
- 통계: 시도 N회, 정답률 N%
- `LikeButton` 컴포넌트 (Client, 현재 사용자 좋아요 여부 전달)
- `ReportModal` 컴포넌트 (Client, 본인 문제면 숨김)
- ← 게시판으로 돌아가기 링크

문제를 찾을 수 없거나 BLINDED + 비관리자 → `notFound()` 처리.

## Acceptance Criteria

```bash
npm run build   # 컴파일 에러 없음
```

## 검증 절차

1. `src/app/api/questions/[id]/like/route.ts` 존재 확인
2. `src/app/api/questions/[id]/report/route.ts` 존재 확인
3. `src/components/board/LikeButton.tsx`, `ReportModal.tsx` 존재 확인
4. `src/app/board/[id]/page.tsx` 존재 확인
5. `npm run build` 통과 확인
6. 결과에 따라 `phases/3-board/index.json`의 step 2 status 업데이트:
   - 성공 → `"status": "completed"`, `"summary": "게시판 상세 페이지 + 좋아요 API + 신고 API + LikeButton + ReportModal 구현 완료."`
   - 실패 → `"status": "error"`, `"error_message": "구체적 에러 내용"`

## 금지사항

- `board/[id]/page.tsx`에서 신고 버튼을 본인 문제에도 표시하지 마라. 이유: PRD에서 본인 문제 신고 불가로 정의. 서버 컴포넌트에서 `session.user.id === question.authorId` 비교로 숨김 처리.
- LikeButton에서 낙관적 업데이트 없이 API 응답 후에만 UI를 갱신하지 마라. 이유: 응답 지연 시 UX가 떨어진다. TanStack Query의 `onMutate` 콜백으로 즉시 반영하라.
- 기존 테스트를 깨뜨리지 마라.
