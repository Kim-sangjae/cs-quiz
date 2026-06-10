# Step 0: mypage-enhance

## 읽어야 할 파일

먼저 아래 파일들을 읽고 현재 마이페이지 구조를 파악하라:

- `CLAUDE.md`
- `docs/PRD.md` → *v2 기능 명세* → *9. 마이페이지 확장* 섹션
- `src/app/mypage/page.tsx` (기존 localStorage 기반)
- `src/app/mypage/[category]/page.tsx` (기존 localStorage 기반)
- `src/lib/history.ts` (삭제 예정, 현재 로직 확인용)
- `src/lib/prisma.ts`
- `src/lib/auth.ts`
- `prisma/schema.prisma` (QuizSession, QuestionAttempt, Question, Like 모델 확인)

## 작업

이 step은 마이페이지를 localStorage → DB 기반으로 전환하고 기능을 확장한다.

### 1. 마이페이지 API 라우트 생성

**`src/app/api/mypage/stats/route.ts`**
```ts
// GET: 사용자 요약 통계
// - 로그인 필수 (401)
// 응답:
// {
//   totalSessions: number,       // 전체 퀴즈 횟수
//   overallAccuracy: number,     // 전체 정답률 (%)
//   weakestCategory: string | null, // 정답률 가장 낮은 카테고리 (최소 5회 이상 시도)
//   streakCount: number,         // user.streakCount
// }
```

**`src/app/api/mypage/sessions/route.ts`**
```ts
// GET: 퀴즈 히스토리 (최신순, 최대 20개)
// - 로그인 필수 (401)
// - QuizSession + questionIds로 Question 조회 + answers 포함
// 응답: QuizSession[] (questions 전체 포함)
```

**`src/app/api/mypage/wrong-answers/route.ts`**
```ts
// GET: ?category=ds 형식으로 카테고리별 오답 목록
// - 로그인 필수 (401)
// - 기존 history.ts의 2-pass 알고리즘을 DB 기반으로 재구현:
//   1패스: 카테고리 + 유저 기준 틀린 횟수 집계 (QuestionAttempt에서)
//   2패스: 문제별 최신 오답 1개 dedup
// - 기존 마이페이지의 색상 로직(3회 미만/3회 이상/5회 이상)은 프론트에서 처리
```

**`src/app/api/mypage/my-questions/route.ts`**
```ts
// GET: 내가 등록한 문제 목록
// - 로그인 필수 (401)
// - Query: ?status=all|pending|approved|rejected (기본: all)
// - Question include: _count(likes), rejectionReason
```

**`src/app/api/mypage/liked-questions/route.ts`**
```ts
// GET: 내가 좋아요한 문제 목록
// - 로그인 필수 (401)
// - Like를 통해 Question 조회 (최신순)
```

### 2. `src/app/mypage/page.tsx` 업데이트

localStorage → DB API 기반으로 전환:
- `loadHistory()` 제거 → `/api/mypage/sessions` 호출
- `computeProfileStats()` 제거 → `/api/mypage/stats` + QuizSession 기반 카테고리 통계

추가 섹션:
- **요약 카드**: 총 퀴즈 횟수, 전체 정답률, 연속 기록(스트릭 N일)
- **내가 등록한 문제** 탭:
  - 상태 필터 버튼 (전체/요청/승인/거절)
  - 거절된 문제: 거절 이유 표시 + "수정 후 재요청" 버튼 (미구현, 링크만)
- **내가 좋아요한 문제** 탭:
  - 문제 제목 목록 → `/board/[id]` 링크

기존 기능 (풀이 히스토리 accordion, 카테고리 통계, 카테고리별 오답 노트 링크)은 동일하게 유지.

### 3. `src/app/mypage/[category]/page.tsx` 업데이트

localStorage → DB API 기반으로 전환:
- `loadHistory()` 제거 → `/api/mypage/wrong-answers?category={cat}` 호출
- 기존 UI 구조 (accordion, wrongCountColor 함수) 그대로 유지

### 4. `src/lib/history.ts` 삭제

모든 import가 제거되었는지 확인 후 파일 삭제.

## Acceptance Criteria

```bash
npm run build && npm run test   # 컴파일 에러 없음, 기존 테스트 통과
```

## 검증 절차

1. `src/app/api/mypage/` 하위 5개 API 라우트 존재 확인
2. `src/app/mypage/page.tsx`에 localStorage/loadHistory 참조 없음 확인
3. `src/app/mypage/[category]/page.tsx`에 localStorage/loadHistory 참조 없음 확인
4. `src/lib/history.ts` 파일 삭제 확인
5. `npm run build && npm run test` 통과 확인
6. 결과에 따라 `phases/6-mypage-v2/index.json`의 step 0 status 업데이트:
   - 성공 → `"status": "completed"`, `"summary": "마이페이지 localStorage → DB 전환 완료. 요약 통계/스트릭/내 문제/좋아요 탭 추가. history.ts 삭제."`
   - 실패 → `"status": "error"`, `"error_message": "구체적 에러 내용"`

## 금지사항

- `history.ts`를 삭제하기 전에 import를 모두 제거했는지 반드시 확인하라. 이유: import가 남아 있으면 빌드 에러가 발생한다.
- 기존 오답 노트의 wrongCountColor 로직(3회/5회 기준 색상)을 변경하지 마라. 이유: 기존 UX를 유지해야 한다. 데이터 소스만 변경.
- 기존 테스트(`sample.test.ts`, `grade.test.ts` 등)를 수정하거나 깨뜨리지 마라.
