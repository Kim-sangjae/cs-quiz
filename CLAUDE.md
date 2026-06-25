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
