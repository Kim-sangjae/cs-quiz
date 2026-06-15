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
│   ├── inquiry/
│   │   ├── page.tsx                      # 1:1 문의 목록 (내 문의)
│   │   └── new/page.tsx                  # 문의 등록
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
│       │   ├── similar/route.ts          # GET?q= — pgvector 코사인 유사도 검색
│       │   ├── generate-options/route.ts # POST — GPT로 오답 보기 + 해설 생성
│       │   └── [id]/
│       │       ├── route.ts
│       │       ├── like/route.ts
│       │       └── report/route.ts
│       ├── quiz/sessions/
│       │   ├── route.ts
│       │   └── [id]/route.ts
│       ├── rankings/route.ts
│       ├── notifications/route.ts
│       ├── inquiries/
│       │   ├── route.ts                  # GET(내 문의 목록), POST(등록)
│       │   └── [id]/route.ts             # GET(상세)
│       ├── mypage/
│       │   ├── stats/route.ts
│       │   ├── sessions/route.ts
│       │   ├── wrong-answers/route.ts
│       │   ├── my-questions/route.ts
│       │   └── liked-questions/route.ts
│       └── admin/
│           ├── badge/route.ts            # GET — 미처리 건수 + newTotal(방문 후 초기화)
│           ├── badge/seen/route.ts       # POST — adminLastSeenAt 갱신
│           ├── questions/route.ts
│           ├── questions/[id]/route.ts
│           ├── board/route.ts
│           ├── reports/route.ts
│           ├── reports/[id]/route.ts
│           ├── inquiries/route.ts        # GET — 전체 문의 목록
│           ├── inquiries/[id]/route.ts   # PATCH — 답변/상태 변경
│           ├── logs/route.ts             # GET — 감사 로그 (페이지네이션, 필터)
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
│   ├── audit.ts         # writeLog() — fire-and-forget 감사 로그 기록
│   ├── embedding.ts     # OpenAI text-embedding-3-small 호출 유틸
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
| `app/inquiry/page.tsx` | Client | TanStack Query |
| `app/inquiry/new/page.tsx` | Client | 폼 상태 |
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
