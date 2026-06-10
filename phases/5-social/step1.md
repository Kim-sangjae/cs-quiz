# Step 1: notifications

## 읽어야 할 파일

먼저 아래 파일들을 읽고 알림 명세를 파악하라:

- `CLAUDE.md`
- `docs/PRD.md` → *v2 기능 명세* → *10. 알림* 섹션
- `docs/ADR.md` → ADR-016 (TanStack Query 폴링)
- `src/lib/auth.ts`
- `src/lib/prisma.ts`
- `src/components/Header.tsx` (step 1-infra-2에서 생성)
- `prisma/schema.prisma` (Notification 모델 확인)

## 작업

이 step은 알림 API와 헤더 알림 벨 컴포넌트를 구현한다.

### 1. `src/app/api/notifications/route.ts` 생성

```ts
// GET: 현재 사용자의 알림 목록
// - 로그인 필수 (401)
// - 최신 20개, createdAt DESC
// - 응답: { notifications: Notification[], unreadCount: number }

// PATCH: 읽음 처리
// - 로그인 필수 (401)
// - Body: { id?: string }  → id 있으면 단일 읽음, 없으면 전체 읽음
// - isRead = true로 업데이트
// - 응답: 200
```

### 2. `src/components/NotificationBell.tsx` 생성 (Client Component)

구성:
- 벨 아이콘 버튼
- 미읽은 수 배지 (0이면 숨김, 99+ cap)
- 클릭 → 드롭다운 패널 열기/닫기 (토글)

드롭다운 패널:
- 헤더: "알림" + "모두 읽음" 버튼
- 알림 목록 (최대 20개):
  - `QUESTION_APPROVED`: "'{questionTitle}' 문제가 승인되었습니다."
  - `QUESTION_REJECTED`: "'{questionTitle}' 문제가 거절되었습니다. 사유: {rejectionReason}"
  - 읽지 않은 항목: 배경 강조
  - 클릭 → `actionUrl`로 이동 + 읽음 처리 (PATCH 호출)
- 알림 없음: "알림이 없습니다"
- 드롭다운 외부 클릭 시 닫힘

TanStack Query:
- `useQuery({ queryKey: ['notifications'], queryFn: ..., refetchInterval: 30_000 })`
- 읽음 처리: `useMutation` + 성공 시 쿼리 invalidate

### 3. `src/components/Header.tsx` 업데이트

로그인 상태일 때 `NotificationBell`을 우측 영역에 추가:

```tsx
{session && <NotificationBell />}
```

## Acceptance Criteria

```bash
npm run build   # 컴파일 에러 없음
```

## 검증 절차

1. `src/app/api/notifications/route.ts` 존재 확인
2. `src/components/NotificationBell.tsx` 존재 확인
3. `src/components/Header.tsx`에 `NotificationBell` 포함 확인
4. `refetchInterval: 30_000` 설정 확인
5. `npm run build` 통과 확인
6. 결과에 따라 `phases/5-social/index.json`의 step 1 status 업데이트:
   - 성공 → `"status": "completed"`, `"summary": "알림 API + NotificationBell 컴포넌트(30초 폴링, 드롭다운) 구현 완료. Header에 통합."`
   - 실패 → `"status": "error"`, `"error_message": "구체적 에러 내용"`

## 금지사항

- 알림을 Supabase Realtime으로 구현하지 마라. 이유: ADR-016에서 TanStack Query 폴링으로 결정. Realtime 설정은 추가 의존성이 있고 현재 규모에서 불필요하다.
- `refetchInterval`을 5초 미만으로 설정하지 마라. 이유: Supabase 무료 플랜의 DB 연결 한도 초과 위험.
- 기존 테스트를 깨뜨리지 마라.
