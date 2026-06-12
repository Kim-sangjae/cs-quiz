# 아키텍처

## 디렉토리 구조

```
src/
├── app/
│   ├── layout.tsx
│   ├── page.tsx                          # 홈 (시작 화면 + 랭킹)
│   ├── quiz/
│   │   ├── page.tsx                      # 카테고리 선택
│   │   └── play/page.tsx                 # 퀴즈 진행
│   ├── result/[sessionId]/page.tsx       # 결과
│   ├── board/
│   │   ├── page.tsx                      # 목록
│   │   ├── [id]/page.tsx                 # 상세
│   │   └── submit/page.tsx               # 문제 등록
│   ├── admin/page.tsx                    # 관리자 패널
│   ├── mypage/
│   │   ├── page.tsx
│   │   └── [category]/page.tsx
│   ├── settings/page.tsx
│   ├── auth/setup-nickname/page.tsx
│   └── api/
│       ├── auth/[...nextauth]/route.ts
│       ├── users/nickname/route.ts
│       ├── questions/
│       │   ├── route.ts                  # GET(목록+검색), POST(등록)
│       │   └── [id]/
│       │       ├── route.ts
│       │       ├── like/route.ts
│       │       └── report/route.ts
│       ├── quiz/sessions/
│       │   ├── route.ts
│       │   └── [id]/route.ts
│       ├── rankings/route.ts
│       ├── notifications/route.ts
│       ├── mypage/
│       │   ├── stats/route.ts
│       │   ├── sessions/route.ts
│       │   ├── wrong-answers/route.ts
│       │   ├── my-questions/route.ts
│       │   └── liked-questions/route.ts
│       └── admin/
│           ├── questions/route.ts
│           ├── questions/[id]/route.ts
│           ├── board/route.ts
│           ├── reports/route.ts
│           ├── reports/[id]/route.ts
│           └── users/
│               ├── route.ts
│               └── [id]/route.ts
├── components/
│   ├── Header.tsx                        # 공통 헤더 (Client)
│   ├── NotificationBell.tsx              # 알림 벨 (Client, 30초 폴링)
│   └── board/
│       ├── SearchBar.tsx
│       ├── FilterBar.tsx
│       ├── QuestionCard.tsx
│       ├── Pagination.tsx
│       ├── LikeButton.tsx
│       └── ReportModal.tsx
├── lib/
│   ├── auth.ts          # NextAuth + getServerUser() — DB 접근, 서버 전용
│   ├── auth.config.ts   # Edge-safe config — 미들웨어 전용
│   ├── prisma.ts        # Prisma client singleton
│   ├── sample.ts        # Fisher-Yates 랜덤 샘플링
│   ├── grade.ts         # 채점 (순수 함수)
│   └── guard.ts         # QuizResult 타입 가드
├── data/
│   └── questions.ts     # OFFICIAL 문제 정적 배열 (120개+)
└── types/
    └── index.ts
```

---

## 렌더링 전략

| 페이지/컴포넌트 | 타입 | 이유 |
|---|---|---|
| `app/page.tsx` | Server | 정적 + 랭킹 SSR |
| `app/quiz/page.tsx` | Server | 문제 수 조회 |
| `app/quiz/play/page.tsx` | Client | useState 퀴즈 상태 |
| `app/result/[sessionId]/page.tsx` | Client | sessionStorage + router |
| `app/board/page.tsx` | Server + Client 검색바 | URL params SSR |
| `app/board/[id]/page.tsx` | Server + Client 버튼 | 좋아요/신고만 Client |
| `app/board/submit/page.tsx` | Client | 폼 상태 |
| `app/admin/page.tsx` | Client | TanStack Query |
| `app/mypage/page.tsx` | Client | DB fetching |
| `components/Header.tsx` | Client | useSession, useRouter |
| `components/NotificationBell.tsx` | Client | 30초 폴링 |

`"use client"` 경계는 이벤트 핸들러·브라우저 API가 필요한 가장 아래쪽 컴포넌트에만 선언.

---

## 미들웨어 (`src/middleware.ts`)

보호 경로: `/quiz/*`, `/board/submit`, `/mypage/*`, `/settings`, `/admin/*`

1. 비로그인 → `/auth/login?callbackUrl=...`
2. 닉네임 미설정 → `/auth/setup-nickname?callbackUrl=...`
3. `/admin/*` + `role !== ADMIN` → `/`

미들웨어는 `auth.config.ts` (Edge Runtime, DB 미사용).  
세션 무효화(`tokenVersion`, `deletedAt`)는 API 호출 시 `auth.ts` JWT 콜백에서 처리.

---

## 데이터 흐름 (퀴즈)

```
questions.ts (OFFICIAL 120개) + DB 승인 문제
  └─ /quiz: 카테고리 선택
       └─ /quiz/play: 30문제 샘플링
            └─ 제출 → POST /api/quiz/sessions ($transaction)
                 ├─ QuizSession 저장
                 ├─ QuestionAttempt N개 저장
                 └─ Question.attemptCount / correctCount 업데이트
                      └─ /result/[sessionId] 결과 표시
```
