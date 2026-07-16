# 아키텍처

## 디렉토리 구조

```
src/
├── app/
│   ├── layout.tsx
│   ├── page.tsx                          # 홈 (히어로 + 개인화 배너 + 랭킹)
│   ├── about/page.tsx                    # 서비스 소개
│   ├── leaderboard/page.tsx              # 기여도 순위
│   ├── friends/page.tsx                  # 친구 목록 전체 페이지
│   ├── quiz/
│   │   ├── page.tsx                      # 카테고리 선택 (서버 컴포넌트)
│   │   └── play/
│   │       ├── page.tsx                  # 퀴즈 진행 진입점 (searchParams → mode 결정)
│   │       └── QuizPlayClient.tsx        # 퀴즈 진행 UI (normal/review/timed 모드 처리)
│   ├── result/[sessionId]/
│   │   ├── page.tsx                      # 결과 서버 컴포넌트 (generateMetadata + OG 태그)
│   │   └── ResultClient.tsx              # 결과 UI 클라이언트 컴포넌트
│   ├── board/
│   │   ├── page.tsx                      # 목록 (서버 컴포넌트 + SSR 검색)
│   │   ├── [id]/page.tsx                 # 상세
│   │   └── submit/page.tsx               # 문제 등록
│   ├── inquiry/
│   │   ├── page.tsx                      # 내 문의 목록
│   │   └── new/page.tsx                  # 문의 등록
│   ├── admin/page.tsx                    # 관리자 패널 (탭: 통계/승인대기/게시판/신고/유저/문의/활동로그/오류내역/AI생성/금칙어/포인트내역)
│   ├── mypage/
│   │   ├── page.tsx                      # 마이페이지 (클라이언트 — 통계/히스토리/뱃지/북마크 등)
│   │   └── [category]/page.tsx           # 카테고리별 오답 상세
│   ├── settings/page.tsx                 # 계정 설정 (닉네임 변경, 로그아웃)
│   ├── auth/setup-nickname/page.tsx      # 닉네임 최초 설정
│   ├── battle/[id]/page.tsx             # 대결 진행 (클라이언트 — TanStack Query + Supabase Broadcast)
│   ├── u/[nickname]/page.tsx            # 공개 프로필 (서버 컴포넌트)
│   └── api/
│       ├── auth/[...nextauth]/route.ts
│       ├── users/
│       │   ├── nickname/route.ts         # POST(최초설정) / PATCH(변경) — 닉네임 필터링 적용
│       │   └── [id]/
│       │       ├── profile/route.ts      # GET — 공개 프로필 데이터 (UserProfileModal용)
│       │       └── report/route.ts       # POST — 유저 신고
│       ├── questions/
│       │   ├── route.ts                  # GET(목록+검색), POST(등록)
│       │   ├── similar/route.ts          # GET?q= — pgvector+pg_trgm+희귀토큰 가중치 하이브리드 재정렬 (상세: BACKEND.md)
│       │   ├── generate-options/route.ts # POST — GPT-4o-mini 오답 보기 + 해설 자동 생성
│       │   └── [id]/
│       │       ├── route.ts
│       │       ├── like/route.ts         # GET(상태조회) / POST(토글)
│       │       └── report/route.ts       # POST — 문제 신고
│       ├── quiz/sessions/
│       │   ├── route.ts                  # POST — 퀴즈 제출 ($transaction)
│       │   ├── summary/route.ts          # GET — 경량 세션 요약 (차트용)
│       │   └── [id]/route.ts             # GET — 세션 상세
│       ├── rankings/route.ts
│       ├── notifications/route.ts        # GET(목록) / PATCH(읽음처리)
│       ├── inquiries/
│       │   ├── route.ts                  # GET(내 문의 목록), POST(등록)
│       │   └── [id]/route.ts             # GET(상세)
│       ├── mypage/
│       │   ├── stats/route.ts
│       │   ├── sessions/route.ts         # 서버사이드 페이지네이션
│       │   ├── summary/route.ts          # 경량 요약 엔드포인트 (차트/달력용)
│       │   ├── wrong-answers/route.ts
│       │   ├── my-questions/route.ts
│       │   ├── liked-questions/route.ts
│       │   ├── battle-history/route.ts   # 서버사이드 페이지네이션
│       │   └── profile-visibility/route.ts # GET/PATCH — 공개 설정 (변경 시 Broadcast)
│       ├── friends/
│       │   ├── route.ts                  # GET(목록+온라인상태) / POST(친구 추가)
│       │   └── [id]/route.ts             # DELETE(친구 삭제)
│       ├── chat/messages/route.ts        # GET(대화 기록) / POST(전송) / DELETE(로그아웃 시 삭제)
│       ├── presence/heartbeat/route.ts   # POST — 온라인 상태 갱신 (15초 간격)
│       ├── achievements/route.ts         # GET — 주간 목표 진행률
│       ├── battle/
│       │   ├── rooms/route.ts            # POST — 대결방 생성
│       │   └── rooms/[id]/
│       │       ├── route.ts              # GET — 방 상태 폴링 + 서버사이드 타임아웃 자동제출
│       │       ├── answer/route.ts       # POST — 답변 제출 + Broadcast 발화
│       │       ├── join/route.ts         # POST — 대결 수락
│       │       ├── reject/route.ts       # POST — 대결 거절
│       │       ├── cancel/route.ts       # POST — 대결방 취소 (WAITING 상태)
│       │       └── quit/route.ts         # POST — 대결 중단
│       ├── me/quiz-status/route.ts       # GET — 퀴즈 진행 상태
│       ├── stats/
│       │   ├── online/route.ts            # GET — 실시간 온라인 수
│       │   └── online-users/route.ts      # GET — 온라인 유저 목록
│       └── admin/
│           ├── badge/route.ts            # GET — 미처리 건수 + newTotal(방문 후 초기화)
│           ├── badge/seen/route.ts       # POST — adminLastSeenAt 갱신
│           ├── generate-questions/route.ts # POST — GPT-4o 배치 문제 자동생성
│           ├── questions/route.ts
│           ├── questions/[id]/route.ts
│           ├── questions/bulk/route.ts   # POST — 일괄 승인/거절/블라인드
│           ├── board/route.ts
│           ├── reports/route.ts
│           ├── reports/[id]/route.ts
│           ├── reports/bulk/route.ts
│           ├── inquiries/route.ts
│           ├── inquiries/[id]/route.ts
│           ├── inquiries/bulk/route.ts
│           ├── logs/route.ts             # GET — 활동 로그 (페이지네이션, 필터)
│           ├── errors/route.ts           # GET — 오류 로그
│           ├── analytics/route.ts        # GET — 통계 대시보드 데이터
│           ├── blocked-words/route.ts    # GET / POST(bulk) / DELETE — 금칙어 CRUD
│           ├── comment-reports/route.ts  # GET / PATCH — 댓글 신고 처리
│           ├── user-reports/route.ts     # GET / PATCH — 유저 신고 처리
│           └── users/
│               ├── route.ts
│               ├── [id]/route.ts
│               └── bulk/route.ts         # POST — 일괄 권한 변경/삭제
├── components/
│   ├── Header.tsx                        # 공통 헤더 (PWA 설치 버튼, 관리자 배지 포함)
│   ├── NotificationBell.tsx              # 알림 벨 (Supabase Realtime + 30초 폴링 fallback)
│   ├── BattleInviteAlert.tsx             # 대결 초대 알림 모달 (5초 폴링)
│   ├── FriendPanel.tsx                   # 친구 목록 + 대결 신청 + 채팅 진입 FAB (클라이언트)
│   ├── ChatWindow.tsx                    # 1:1 채팅 창 (Supabase Broadcast 실시간)
│   ├── UserProfileModal.tsx              # 유저 프로필 모달 (친구 패널 / 게시판 등에서 공용)
│   ├── ProfileVisibilityListener.tsx     # 공개 프로필 실시간 업데이트 리스너 (클라이언트)
│   ├── DailyChallenge.tsx                # 오늘의 문제 (홈 페이지)
│   ├── OnlineCountBadge.tsx              # 실시간 접속자 수 배지 (홈 페이지)
│   ├── RankingSection.tsx                # 랭킹 섹션 (홈 페이지)
│   ├── ResultCard.tsx                    # 오답/전체 리뷰 카드 (신고+북마크 버튼 포함)
│   ├── QuizCard.tsx                      # 퀴즈 문제 카드
│   ├── QuestionDrawer.tsx                # 문제 상세 슬라이드 패널 (북마크 포함)
│   ├── Navigator.tsx                     # 문제 번호 점프 네비게이터 (lockedBefore 지원)
│   ├── ProgressBar.tsx                   # 진행률 바
│   ├── PaginationNav.tsx                 # 공용 페이지네이션(원형 화살표+숫자목록, onChange 콜백형)
│   └── board/
│       ├── SearchBar.tsx
│       ├── AuthorSearchBar.tsx
│       ├── FilterBar.tsx
│       ├── BoardListClient.tsx
│       ├── QuestionCard.tsx
│       ├── Pagination.tsx                # PaginationNav를 감싸는 URL(router.push) 래퍼
│       ├── LikeButton.tsx
│       └── ReportModal.tsx
├── contexts/
│   └── RealtimeContext.tsx               # Supabase Presence 전역 컨텍스트 (앱 최상단 1회 구독)
├── hooks/
│   └── useSupabaseRealtime.ts            # RealtimeContext 소비 훅
├── lib/
│   ├── auth.ts                           # NextAuth + getServerUser() — DB 접근, 서버 전용
│   ├── auth.config.ts                    # Edge-safe config — 미들웨어 전용
│   ├── prisma.ts                         # Prisma client singleton
│   ├── supabase-browser.ts              # Supabase 브라우저 클라이언트 (Realtime 구독용)
│   ├── supabase-server.ts               # Supabase 서버 클라이언트 (service role, Broadcast 발신용)
│   ├── battle-broadcast.ts              # broadcastBattleUpdate() — 대결방 변경 시 Broadcast 발화
│   ├── audit.ts                          # writeLog() — fire-and-forget 활동 로그 기록
│   ├── embedding.ts                      # OpenAI text-embedding-3-small 호출 유틸
│   ├── similar-search.ts                # 유사문제 검색 순수 함수 (토큰 추출, 희귀토큰 가중치, 한/영 동의어 사전)
│   ├── pagination.ts                     # buildPageList() — 페이지 번호+말줄임표(…) 목록 계산 순수 함수
│   ├── review-schedule.ts               # 오답 복습 스케줄링 (1/3/7/30일 간격)
│   ├── rankings.ts                       # 랭킹 집계 SQL (review 모드 세션 제외)
│   ├── sample.ts                         # Fisher-Yates 랜덤 샘플링
│   ├── grade.ts                          # 채점 (순수 함수)
│   ├── guard.ts                          # QuizResult 타입 가드
│   ├── badges.ts                         # BADGE_META — 배지 메타데이터 (아이콘, 설명)
│   ├── chat-store.ts                     # 채팅 로컬 상태 유틸 (clearAllChats)
│   ├── korcen-check.ts                  # Tanat05/korcen.ts 이식 — 한국어/영어 욕설 검사
│   ├── nickname-filter.ts               # isNicknameAllowed() — 닉네임 필터링 진입점
│   ├── user-level.ts                    # 유저 레벨(XP) 순수 함수 — getLevelInfo, XP_REWARDS (클라/서버 공용)
│   ├── award-xp.ts                      # awardBattleXp() — 대전 종료 시 승/무/패 XP 지급 (서버 전용)
│   └── notify.ts                        # PC 알림 (탭 제목 깜빡임·OS 알림·앱 뱃지, 모바일 비활성)
├── data/
│   └── questions.ts                     # OFFICIAL 문제 정적 배열 (120개+)
└── types/
    └── index.ts
```

---

## 렌더링 전략

| 페이지/컴포넌트 | 타입 | 이유 |
|---|---|---|
| `app/page.tsx` | Server | 랭킹·통계 SSR |
| `app/about/page.tsx` | Server | 정적 콘텐츠 |
| `app/leaderboard/page.tsx` | Server | 기여도 집계 SSR |
| `app/friends/page.tsx` | Server + Client | 목록 SSR, 온라인 상태 클라이언트 |
| `app/quiz/page.tsx` | Server | 문제 수 조회 |
| `app/quiz/play/page.tsx` | Client | 퀴즈 상태 관리 |
| `app/result/[sessionId]/page.tsx` | **Server** | generateMetadata (OG 태그) |
| `app/result/[sessionId]/ResultClient.tsx` | Client | 결과 UI, 공유, 북마크 |
| `app/board/page.tsx` | Server + Client SearchBar | URL params SSR |
| `app/board/[id]/page.tsx` | Server + Client 버튼 | 좋아요/신고만 Client |
| `app/board/submit/page.tsx` | Client | 폼 상태 |
| `app/battle/[id]/page.tsx` | Client | Supabase Broadcast 실시간 |
| `app/u/[nickname]/page.tsx` | Server | 접근 제어 + 프로필 SSR |
| `app/admin/page.tsx` | Client | TanStack Query |
| `app/mypage/page.tsx` | Client | DB fetching |
| `app/mypage/[category]/page.tsx` | Client | 카테고리별 오답 목록 |
| `components/Header.tsx` | Client | useSession, useRouter |
| `components/NotificationBell.tsx` | Client | Supabase Realtime + 30초 폴링 |
| `components/FriendPanel.tsx` | Client | Supabase Presence, 채팅, 대결 |
| `components/ChatWindow.tsx` | Client | Supabase Broadcast 실시간 채팅 |
| `components/UserProfileModal.tsx` | Client | TanStack Query + visibility 구독 |
| `components/ProfileVisibilityListener.tsx` | Client | Supabase Broadcast → router.refresh() |

`"use client"` 경계는 이벤트 핸들러·브라우저 API가 필요한 가장 아래쪽 컴포넌트에만 선언.

---

## 미들웨어 (`src/middleware.ts`)

보호 경로: `/quiz/*`, `/board/submit`, `/mypage/*`, `/settings`, `/admin/*`, `/inquiry/*`, `/battle/*`, `/friends/*`

예외: `/quiz/play` — 비로그인 허용 (Kakao OG 스크래핑 + `?sharedFrom=` 공유 링크 지원)

1. 비로그인 → `/auth/login?callbackUrl=...`
2. 닉네임 미설정 → `/auth/setup-nickname?callbackUrl=...`
3. `/admin/*` + `role !== ADMIN` → `/`

미들웨어는 `auth.config.ts` (Edge Runtime, DB 미사용).  
세션 무효화(`tokenVersion`, `deletedAt`)는 API 호출 시 `auth.ts` JWT 콜백에서 처리.

**비로그인 접근 가능 경로**: `/`, `/about`, `/leaderboard`, `/board`, `/board/[id]`, `/result/[sessionId]`, `/u/[nickname]`, `/quiz/play?sharedFrom=...`

---

## 데이터 흐름 (퀴즈)

```
questions.ts (OFFICIAL 120개+) + DB 승인 문제
  └─ /quiz: 카테고리 선택 (normal / timed 모드 분기)
       └─ /quiz/play: 20문제 샘플링 (최근 3세션 문제 제외로 다양성 확보)
            └─ 제출 → POST /api/quiz/sessions ($transaction)
                 ├─ QuizSession 저장 (mode: normal|review|timed)
                 ├─ QuestionAttempt N개 저장
                 ├─ Question.attemptCount / correctCount 업데이트
                 ├─ ReviewSchedule 생성/갱신 (오답 → 1/3/7/30일 스케줄)
                 └─ 랭킹/뱃지/레벨업/연속출석 업데이트 (review 모드 제외)
                      └─ /result/[sessionId] 결과 표시
```

## 실시간 동기화 구조

```
Supabase Realtime Broadcast
  ├─ csora-battle-{roomId}       — 대결 상태 변경 (battle-broadcast.ts)
  ├─ csora-chat-{userId}         — 채팅 메시지 수신 알림 (ChatWindow → FriendPanel)
  ├─ csora-chat-notif-{userId}   — 미읽 채팅 카운트 (FriendPanel FAB 배지)
  ├─ csora-notifications-{userId}— 새 알림 (NotificationBell)
  └─ csora-profile-{userId}      — 공개 설정 변경 (ProfileVisibilityListener)

Supabase Presence
  └─ realtime:online-users       — 접속자 목록 (RealtimeContext → FriendPanel, OnlineCountBadge)
```
