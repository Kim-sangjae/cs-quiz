# Step 0: main-ranking

## 읽어야 할 파일

먼저 아래 파일들을 읽고 랭킹 명세를 파악하라:

- `CLAUDE.md`
- `docs/PRD.md` → *v2 기능 명세* → *8. 메인 랭킹* 섹션
- `docs/ADR.md` → ADR-013
- `docs/UI_GUIDE.md`
- `src/app/page.tsx` (기존 메인 화면)
- `src/lib/prisma.ts`
- `src/lib/auth.ts`

## 작업

이 step은 메인 페이지에 카테고리별 TOP 5 랭킹 섹션을 추가한다.

### 1. `src/app/api/rankings/route.ts` 생성

```ts
// GET: 카테고리별 TOP 5 유저 랭킹
// 캐시: next.js fetch revalidation 60초
//
// 각 카테고리에 대해:
// - QuestionAttempt를 userId + category(question.category) 기준으로 집계
// - 최소 조건: 해당 카테고리 시도 횟수 10개 이상
// - 정렬: 정답률(correctCount/attemptCount) DESC, 동률 시 attemptCount DESC
// - TOP 5만 반환
//
// 응답:
// {
//   ds: RankEntry[], algo: RankEntry[], os: RankEntry[],
//   network: RankEntry[], db: RankEntry[], arch: RankEntry[]
// }
//
// RankEntry: { rank: number, userId: string, nickname: string, attemptCount: number, accuracy: number }
```

Prisma로 직접 집계 쿼리 작성. Raw SQL 또는 groupBy 활용.

### 2. `src/app/page.tsx` 업데이트 (Server Component)

기존 시작 화면 내용을 유지하고 하단에 랭킹 섹션 추가:

```ts
const rankings = await fetch('/api/rankings', { next: { revalidate: 60 } }).then(r => r.json());
// 또는 Server Component이므로 Prisma 직접 호출 권장
```

랭킹 섹션 UI:
- 카테고리 탭 (DS / Algo / OS / Network / DB / Arch)
- 선택된 카테고리 TOP 5 테이블: 순위 | 닉네임 | 시도 횟수 | 정답률
- 데이터 없으면 "아직 랭킹 데이터가 없습니다"
- 본인 행 하이라이트: 서버에서 `getServerUser()`로 userId 확인 후 전달

카테고리 탭 전환은 Client Component로 분리 (`src/components/RankingSection.tsx`):
- 탭 상태는 `useState`
- 랭킹 데이터는 서버에서 전달받은 props (재fetch 없이)

## Acceptance Criteria

```bash
npm run build   # 컴파일 에러 없음
```

## 검증 절차

1. `src/app/api/rankings/route.ts` 존재 확인
2. `src/components/RankingSection.tsx` 존재 확인
3. `src/app/page.tsx`에 RankingSection 포함 확인
4. API 응답에 6개 카테고리 키 모두 포함 확인
5. `npm run build` 통과 확인
6. 결과에 따라 `phases/5-social/index.json`의 step 0 status 업데이트:
   - 성공 → `"status": "completed"`, `"summary": "메인 페이지에 카테고리별 TOP5 랭킹 섹션 추가. 60초 revalidation 적용."`
   - 실패 → `"status": "error"`, `"error_message": "구체적 에러 내용"`

## 금지사항

- 랭킹 섹션 전체를 Client Component로 만들지 마라. 이유: 랭킹 데이터는 서버에서 fetch 후 props로 전달하고, 탭 전환 상태만 Client Component에서 관리하면 된다.
- 최소 시도 횟수 조건(10회) 없이 랭킹을 표시하지 마라. 이유: 1회 풀고 100%인 사람이 1위가 되는 문제가 생긴다.
- 기존 테스트를 깨뜨리지 마라.
