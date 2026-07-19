# CS Quiz

## Stack

Next.js 15 (App Router) · TypeScript strict · Tailwind CSS · Vitest  
Supabase (PostgreSQL) · Prisma ORM v7 · NextAuth.js v5 · TanStack Query

## Commands

```bash
npm run dev        # localhost:3000
npm run build && npm run test && npm run lint   # 검증 순서
npx prisma migrate dev   # 스키마 변경 후
npx prisma generate      # Prisma Client 재생성
npm run db:seed          # 초기 데이터 시딩
python scripts/execute.py {phase}        # harness 실행
python scripts/execute.py {phase} --push # 실행 후 push
```

---

## Think Before Coding

- 요구사항이 모호하면 구현 전 질문한다
- 여러 구현 방식이 있으면 선택지와 트레이드오프를 먼저 제시한다

## Simplicity First

- 요청된 기능 외 추가 금지
- 불필요한 추상화·미래 확장성 고려 금지

## Surgical Changes

- 필요한 파일만 수정, 관련 없는 리팩토링 금지
- 기존 코드 스타일·주석 유지

## Verification

수정 후 반드시: `npm run build && npm run test && npm run lint`

---

## Non-Obvious Rules

- **정답 prop 전달 금지**: `answer` 필드는 `grade.ts` 제출 시점에만 접근
- **셔플은 Fisher-Yates만**: `Array.sort(() => Math.random() - 0.5)` 사용 금지
- **TDD**: 새 순수 함수 구현 시 테스트 먼저
- **커밋**: conventional commits (`feat:`, `fix:`, `refactor:`, `chore:`)
- API 인증·Prisma·JWT 무효화 규칙 → ./docs/BACKEND.md

---

## 구현 현황

phases 0~6 + UX 개선 전부 완료. 아래 기능이 모두 구현된 상태다.

| 페이즈 | 구현 내용 |
|--------|-----------|
| 0-mvp | 퀴즈 진행(`/quiz/play`), 결과(`/result/[sessionId]`), 120문제 데이터 |
| 1-infra | Prisma 스키마, Google OAuth(NextAuth v5), 닉네임 온보딩, 공통 헤더, 시드 |
| 2-quiz-v2 | 퀴즈 선택 화면(`/quiz`), QuizSession DB 저장, 시도 통계 트랜잭션 업데이트 |
| 3-board | 게시판 목록/상세/등록, 좋아요, 신고 |
| 4-admin | 관리자 패널(승인/거절/블라인드) |
| 5-social | 메인 랭킹(카테고리별 TOP5), 알림(30초 폴링) |
| 6-mypage-v2 | 마이페이지 DB 전환, 계정 설정(닉네임 변경/로그아웃) |
| 7-ux | 오답 신고 버튼(ResultCard), 자동이동 토글, 카테고리 오답 상세(`/mypage/[category]`), 거절 문제 재요청(`/board/submit?resubmit=`), 결과 전체 리뷰 탭, Web Share API, 키보드 단축키(←/→/1~4), 퀴즈 진행 상태 localStorage 저장 |
| 8-share | 북마크(좋아요 통합, 퀴즈·대결·결과·게시판 전반), PWA 설치 버튼(Header), 결과 공유 개편(Web Share+카카오SDK 통합 모달), OG 메타태그(result 서버/클라이언트 분리+generateMetadata), OG 이미지(`public/og-image-dark.png`), 관리자 일괄처리 API(bulk) |
| 9-battle | 대결 초대/수락/거절(BattleInviteAlert), GameRoom DB(consecutiveAllSkip/questionStartedAt), 연속 쌍방 스킵 시 5초 단축 타이머, 2회 연속 쌍방 스킵 무효(void) 처리, 자동진행(auto-mode) 블러+타이머 동기화, 문제 제한 시간 20초, Supabase Realtime Broadcast로 양쪽 클라이언트 실시간 동기화(`src/lib/battle-broadcast.ts`), 폴링 1s(일반)/500ms(5초모드) fallback |
| 10-infra | 서비스명 CSORA, 카카오 로그인(NextAuth), 오답 복습 스케줄링(1/3/7/30일 간격반복, `src/lib/review-schedule.ts`), 뱃지/업적 시스템, Supabase Realtime 알림, 관리자 애널리틱스 대시보드, 친구 패널 대결 실시간 반영, 서비스 소개·기여도 순위 페이지, 접속자 슬라이드 패널, 감사 로그 확장, 모바일 헤더 친구 메뉴 |
| 11-scale | 서버사이드 페이지네이션 전면 적용(mypage sessions/battle-history, admin users/inquiries), sessions/summary 경량 엔드포인트 분리, 퀴즈 진입 시 북마크 초기 상태 서버 로드, 최근 3세션 문제 제외 샘플링(다양성), 대전 누적 승무패 서버 집계, admin 서버사이드 검색 debounce |
| 12-modes | 퀴즈 모드 구분(normal/review/timed), QuizSession.mode DB 필드, 오답복습·북마크 퀴즈는 랭킹/뱃지/레벨업/스트릭 제외(review 모드), 시간제한 모드(15초/문제, 타이머 단일 effect로 race condition 수정, 이전 문제 잠금), Navigator lockedBefore prop, ResultCard null 선택 처리(미답변 시간 초과), 마이페이지 모드 배지(오답복습/시간제한), AI 문제생성 배치 방식(GPT json_object 10개 제한 우회, BATCH_SIZE=10), se(소프트웨어공학) 카테고리 추가 |
| 13-moderation | 닉네임 욕설·예약어 필터링(`src/lib/nickname-filter.ts`), Tanat05/korcen.ts 소스 직접 이식(`src/lib/korcen-check.ts`, 한국어 8카테고리+영어 600+), DB 기반 커스텀 금칙어(`BlockedWord` 모델, 관리자 bulk 등록/삭제), 관리자 패널 금칙어 관리 탭(통합 목록), 관리자 계정 예약어 우회(`isAdmin` 파라미터), 전역 마우스 드래그 스크롤(`DragScroll` 컴포넌트) |
| 14-level | 유저 레벨(XP) 시스템(`User.xp`, `src/lib/user-level.ts`, 최대 200Lv, 곡선 150+(n-1)×10, 백필 `scripts/backfill-xp.ts`), XP 지급(퀴즈 10+정답1·데일리 20·문제승인 50·대전 15/10/5), 대전 10문제, 카테고리 현황은 단계명만 표시+등급 Lv2부터, 마이페이지 프로필 카드 개편(경험치바+툴팁), PC 알림(`src/lib/notify.ts` 탭깜빡임·OS알림·앱뱃지·`public/sw.js`, 모바일 비활성), 채팅 개인별 숨김(hiddenBySender/Receiver, 로그아웃·재로그인 시 정리), UA 분기 manifest(PC 투명 아이콘), 친구패널 드래그 이동, 관리자 가입일 정렬 |
| 15-polish | 유사문제 검색 하이브리드 재정렬(벡터+pg_trgm+희귀토큰 가중치, 한/영 CS 용어 동의어 사전 `src/lib/similar-search.ts`), AI 오답생성 이탈경고(board/submit·admin 양쪽), 채팅 Realtime 폴링 폴백(5s), 문제 보기 글자수 200→100자·문의 내용 2000→1000자 축소, AI 오답생성 시 정답과 글자수 유사화(±10자) 프롬프트, 공용 페이지네이션 컴포넌트(`PaginationNav`+`buildPageList`, 원형 화살표+숫자목록+말줄임표, 13곳 통합) |
| 16-security | 내 게시글 댓글 알림(`QUESTION_COMMENTED`), 알림 개별 확인 시 즉시 삭제, 보안 점검 후 발견된 취약점 수정 5건(채팅 친구관계 서버 미검증, 일반 API 레이트리밋 부재, 퀴즈 플레이 화면 정답 노출, 퀴즈 세션 무한 재제출, 대결 생성 무제한으로 인한 XP 파밍) — DB 기반 레이트리밋 인프라(`RateLimit` 모델 + `src/lib/rate-limit.ts`) 신규 도입, 커스텀 도메인(csora.co.kr) 이전(DNS·HTTPS·OAuth 리디렉션·카카오 공유 도메인·GitHub Actions APP_URL, 구도메인 308 리다이렉트) |

---

## Documentation

세션 시작 시 이 파일(CLAUDE.md)만 읽는다. 작업에 따라 아래 문서를 추가로 읽는다.

| 작업 유형 | 읽을 문서 |
|-----------|----------|
| 새 페이지·컴포넌트·라우트 추가, 파일 위치 확인 | `./docs/ARCHITECTURE.md` |
| UI 색상·레이아웃·컴포넌트 스타일, 안티패턴 확인 | `./docs/UI_GUIDE.md` |
| API 엔드포인트 추가·수정, DB 스키마 변경, 인증·JWT 관련 | `./docs/BACKEND.md` |
| 기능 명세·접근 제어 정책·엣지케이스 확인 | `./docs/PRD.md` |
| 기술 결정 배경·트레이드오프가 궁금할 때 | `./docs/ADR.md` |
| 과거 디버깅 원인·실패한 접근법 확인 | `./docs/TROUBLESHOOTING.md` |

**규칙**: 필요 없는 문서는 읽지 않는다. 여러 작업이 섞인 경우에만 여러 문서를 읽는다.
