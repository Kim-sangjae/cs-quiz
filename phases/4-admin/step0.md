# Step 0: admin-panel

## 읽어야 할 파일

먼저 아래 파일들을 읽고 관리자 명세를 파악하라:

- `CLAUDE.md`
- `docs/PRD.md` → *v2 기능 명세* → *7. 관리자 패널* 섹션
- `docs/UI_GUIDE.md` → 색상 팔레트, 안티패턴
- `docs/ARCHITECTURE.md` → *미들웨어* 섹션
- `src/lib/prisma.ts`
- `src/lib/auth.ts`
- `prisma/schema.prisma` (Question, Report, Notification 모델 확인)
- `middleware.ts` (관리자 접근 제어 확인)

## 작업

이 step은 관리자 승인 패널 API와 UI를 구현한다.

### 1. `src/app/api/admin/questions/route.ts` 생성

```ts
// GET: PENDING 상태 문제 목록 (등록일순)
// - ADMIN 전용 (403)
// - include: author(nickname, email)
// - 응답: Question[]
```

### 2. `src/app/api/admin/questions/[id]/route.ts` 생성

```ts
// PATCH: 승인 또는 거절
// - ADMIN 전용 (403)
// - Body: { action: 'approve' | 'reject', rejectionReason?: string }
//
// approve:
//   - question.status = APPROVED
//   - Notification 생성: { userId: question.authorId, type: QUESTION_APPROVED,
//       payload: { questionId, questionTitle: question.question.slice(0, 50) },
//       actionUrl: `/board/${question.id}` }
//
// reject:
//   - question.status = REJECTED
//   - question.rejectionReason = rejectionReason (비어 있으면 기본값: "검토 결과 등록 기준에 맞지 않습니다.")
//   - Notification 생성: { userId: question.authorId, type: QUESTION_REJECTED,
//       payload: { questionId, questionTitle, rejectionReason },
//       actionUrl: `/mypage` }
//
// authorId가 null인 문제(OFFICIAL)는 알림 생성 생략
```

### 3. `src/app/api/admin/reports/route.ts` 생성

```ts
// GET: PENDING 신고 목록 (신고 수 많은 문제 우선)
// - ADMIN 전용 (403)
// - 문제별로 그룹핑: { question, reportCount, reports: Report[] }
// - REVIEWED 신고 제외
```

### 4. `src/app/api/admin/reports/[id]/route.ts` 생성

```ts
// id = questionId (문제 단위로 처리)
// PATCH: { action: 'blind' | 'dismiss' }
//
// blind:
//   - question.status = BLINDED
//   - 해당 문제의 모든 PENDING 신고 → status = REVIEWED
//
// dismiss:
//   - 해당 문제의 모든 PENDING 신고 → status = REVIEWED
//   - question.status 변경 없음
```

### 5. `src/app/admin/page.tsx` 생성 (Client Component)

탭 구성:
- **탭 1: 승인 대기** — PENDING 문제 목록
  - 각 항목: 작성자 닉네임, 카테고리, 문제 텍스트(앞 80자)
  - 버튼: `승인` / `거절`
  - 거절 클릭 → 인라인 이유 입력 폼 → 확인 버튼
- **탭 2: 신고 접수** — 신고 목록 (문제별 그룹)
  - 각 항목: 문제 링크, 신고 수, 신고 이유들
  - 버튼: `블라인드` / `무시`

접근 제어: `useSession()`으로 role 확인. ADMIN이 아니면 `/`로 리다이렉트 (미들웨어에서도 처리되지만 클라이언트 단 추가 가드).

TanStack Query `useQuery` (목록 조회) + `useMutation` (승인/거절/처리).

## Acceptance Criteria

```bash
npm run build   # 컴파일 에러 없음
```

## 검증 절차

1. API 라우트 4개 존재 확인
2. `src/app/admin/page.tsx` 존재 확인
3. approve/reject 시 Notification 생성 로직 포함 확인
4. blind 시 Question.status = BLINDED로 변경되는 로직 확인
5. `npm run build` 통과 확인
6. 결과에 따라 `phases/4-admin/index.json`의 step 0 status 업데이트:
   - 성공 → `"status": "completed"`, `"summary": "관리자 패널 구현 완료 (승인/거절 + 신고 블라인드/무시). 승인/거절 시 Notification 생성."`
   - 실패 → `"status": "error"`, `"error_message": "구체적 에러 내용"`

## 금지사항

- `/api/admin/*` 라우트에서 role 검증을 생략하지 마라. 이유: 미들웨어는 페이지 수준 보호이고, API는 직접 호출 가능하다. 반드시 `session.user.role === 'ADMIN'` 검증 후 403 반환.
- 알림(Notification) 생성을 별도 API로 분리하지 마라. 이유: 승인/거절과 알림은 같은 트랜잭션으로 처리해야 데이터 일관성이 보장된다.
- 기존 테스트를 깨뜨리지 마라.
