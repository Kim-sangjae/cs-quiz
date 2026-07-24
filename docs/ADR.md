# Architecture Decision Records

## 철학
MVP 속도 최우선. 외부 의존성 최소화. 작동하는 최소 구현을 선택한다.
문제 데이터는 코드와 함께 관리 — DB, CMS, 외부 API 없음.

---

### ADR-001: Next.js 15 App Router 선택
**결정**: Next.js 15 + App Router  
**이유**: 파일 기반 라우팅으로 `/`, `/quiz`, `/result` 세 페이지를 빠르게 구성. Server/Client Component 혼용으로 초기 렌더링 최적화 가능.  
**트레이드오프**: Pages Router 대비 학습 곡선 존재. 그러나 App Router가 Next.js의 표준 방향이므로 선택.

---

### ADR-002: 문제 데이터를 정적 TypeScript 배열로 관리
**결정**: `src/data/questions.ts`에 `Question[]` 배열로 하드코딩  
**이유**: DB, CMS, 외부 API 없이 즉시 시작 가능. 타입 안전성 보장 (컴파일 타임 검증). 빌드 타임에 문제 형식 오류 감지 가능.  
**트레이드오프**: 문제 추가/수정 시 코드 변경 및 재배포 필요. 관리자 UI 없음. MVP에서는 수용 가능.

---

### ADR-003: 퀴즈 상태를 useState로 클라이언트 관리 (전역 상태 라이브러리 없음)
**결정**: Zustand, Redux, React Context 사용 안 함 — `useState` + props drilling  
**이유**: 퀴즈 상태(`questions`, `answers`, `currentIndex`)가 단일 페이지(`/quiz`) 내에 국한됨. 두 페이지(`/quiz` ↔ `/result`) 간 상태 공유는 sessionStorage로 처리하므로 전역 상태가 필요한 시나리오 없음. 의존성 추가 없이 코드 단순화.  
**트레이드오프**: 컴포넌트 트리가 깊어지면 props drilling 증가. 현재 구조(QuizPage → QuizCard, Navigator)는 2단계 이내라 무관.

---

### ADR-004: 페이지 간 결과 전달에 sessionStorage 사용
**결정**: `/quiz` → `/result` 전환 시 `QuizResult`를 `sessionStorage`에 JSON 직렬화하여 전달  
**이유**:
- URL query param: 30문제 × 데이터 크기가 너무 커 URL 길이 제한 초과 가능
- 서버 세션/DB: 인프라 추가 필요, MVP 범위 초과
- localStorage: 브라우저를 닫아도 데이터 잔류 — 개인정보 리스크
- sessionStorage: 탭 단위 격리, 탭 닫으면 자동 소멸, 추가 인프라 없음

**트레이드오프**:
- `/result`에 직접 URL 접근 시 데이터 없음 → 홈 리다이렉트 필요 (구현됨)
- 일부 브라우저 private 모드에서 sessionStorage 차단 가능 → try/catch + 홈 리다이렉트 fallback (구현됨)
- 탭 복제 시 결과 데이터가 공유되지 않음 (새 탭에서 `/result` 접근 불가) — 허용 가능한 제약

---

### ADR-005: Vitest 선택 (Jest 대신)
**결정**: 테스트 프레임워크로 Vitest 사용  
**이유**: Next.js + TypeScript 환경에서 Jest 설정(babel-jest, ts-jest 등) 없이 ESM 기본 지원. vite 기반이라 설정이 단순.  
**트레이드오프**: Jest 생태계(일부 커뮤니티 매처 라이브러리)와 100% 호환 안 될 수 있음. 현재 필요 테스트(`sample.ts`, `grade.ts` 순수 함수 단위 테스트) 범위에서는 문제 없음.

---

### ADR-006: Fisher-Yates 셔플 알고리즘 사용
**결정**: `sample.ts`의 랜덤 추출에 Fisher-Yates 셔플 사용  
**이유**: `Array.sort(() => Math.random() - 0.5)` 방식은 분포가 균일하지 않음 (정렬 알고리즘의 비교 횟수에 따라 편향 발생). Fisher-Yates는 O(n), 균일 분포 보장.  
**트레이드오프**: 코드가 sort 방식보다 조금 길어짐. 그러나 정확성이 우선.

---

### ADR-007: ~~퀴즈 진행 상태 미저장~~ → localStorage 저장으로 변경 (UX 개선)
**원래 결정**: 진행 상태를 저장하지 않는다 (MVP 범위 외).  
**변경 결정**: `answers` + `currentIndex`를 localStorage(`quiz-progress-{category}-{firstQuestionId}`)에 저장. 마운트 시 questionIds 일치 여부 검증 후 복원. 제출 완료 시 삭제.  
**이유**: 구현 복잡도가 예상보다 낮았고(직렬화 + questionIds 검증만), 새로고침 시 답변 손실은 실제 UX 마찰이 있어 우선순위 상향.  
**엣지케이스 처리**: 저장된 questionIds와 현재 문제 목록이 다르면(문제 풀 변경) 저장 데이터 무시하고 새로 시작.

---

### ADR-008: `/result` 진입 시 sessionStorage 즉시 삭제
**결정**: `/result` 컴포넌트 마운트 시 데이터 파싱 직후 `sessionStorage.removeItem('cs-quiz-result')` 호출  
**이유**: 결과 데이터를 한 번만 소비하도록 강제. 브라우저 뒤로가기로 `/result` 재진입 시 데이터가 없으므로 자동으로 홈 리다이렉트됨 — 의도치 않은 결과 재열람 방지 및 일관된 플로우 유지.  
**트레이드오프**: "뒤로가기로 결과 다시 보기" 불가. 결과를 다시 보려면 퀴즈를 다시 풀어야 함. 학습 목적 앱에서 재시도를 유도하는 UX이므로 의도적 제약.

---

### ADR-010: 자동 이동 토글 (기본 켜짐)
**원래 결정**: Auto-advance 미적용.  
**변경 결정**: 자동 이동을 기본 켜짐으로 구현하되 사용자가 토글 가능하게 함. 설정은 localStorage(`quiz-auto-advance`)에 영구 저장.  
**이유**: 빠른 풀이를 원하는 사용자와 검토·변경을 원하는 사용자 모두를 수용. 토글로 기존 UX 마찰(수동 이동)과 속도 사이를 사용자가 직접 결정.  
**트레이드오프**: 기본 켜짐이라 처음 접한 사용자가 의도치 않게 넘어갈 수 있음. 토글 위치를 진행률 바 옆에 표시해 발견성 보장.

---

### ADR-011: 보기 순서 고정 (셔플 없음)
**결정**: `questions.ts`에 정의된 보기(options) 순서를 그대로 사용한다. 보기 셔플 없음.  
**이유**: 보기 셔플은 `sample.ts`와 별도의 로직이 필요하고, 정답 인덱스(`answer: 0|1|2|3`)를 셔플 후에도 올바르게 매핑해야 하므로 버그 발생 가능성이 높다. 문제 작성자가 의도한 보기 순서가 있을 수 있으므로 고정.  
**트레이드오프**: 문제를 여러 번 풀면 보기 순서가 외워질 수 있음. MVP 규모(~120문제)에서는 허용 가능.

---

### ADR-012: ~~풀이 히스토리 저장에 localStorage 사용~~ (phase 6에서 DB로 대체)
**결정**: ~~퀴즈 완료 시 `QuizResult`를 `localStorage['cs-quiz-history']`에 누적 저장~~  
**→ 대체됨**: phase 6-mypage-v2에서 QuizSession DB 저장으로 전환. 히스토리는 `/api/quiz/sessions`, 오답노트는 `/api/mypage/wrong-answers`에서 조회.

---

### ADR-009: 문제 id 형식 규칙 (`{category}-{순번}`)
**결정**: 문제 id를 `"{category}-{세 자리 순번}"` 형식으로 고정 (예: `os-001`, `network-042`)  
**이유**: id가 자기 설명적(self-descriptive)이어서 데이터 관리 시 카테고리 파악이 용이. 숫자 id(1, 2, 3...)는 카테고리 간 충돌 및 의미 파악 어려움.  
**트레이드오프**: id 부여 시 수동으로 순번 관리 필요. 자동 생성 id(UUID 등)보다 관리 부담 있음. 문제 수가 적은 MVP 규모에서는 수용 가능.

---

### ADR-013: Supabase를 데이터베이스로 선택
**결정**: PostgreSQL 호스팅으로 Supabase 사용  
**이유**:
- 무료 티어로 개발/소규모 프로덕션 충분
- 관리 UI (Table Editor), 마이그레이션 히스토리 제공
- Prisma와 완전 호환 (PostgreSQL 표준)
- Realtime 내장 (알림·대결·채팅·프로필 공개 설정 실시간 동기화에 활용 중)

**트레이드오프**: Supabase 의존성 추가. 다른 PostgreSQL 호스팅으로 이전 시 환경 변수만 변경하면 됨 (Prisma 덕분에 코드 변경 최소).

---

### ADR-014: NextAuth.js v5로 Google OAuth 구현
**결정**: NextAuth.js v5 (Auth.js) + Google Provider  
**이유**:
- Next.js App Router 네이티브 지원
- 세션 관리, CSRF 보호, OAuth 플로우 자동 처리
- Prisma Adapter로 DB 세션 저장 가능
- Next.js 커뮤니티 표준 인증 라이브러리

**트레이드오프**: v5는 beta. v4와 일부 API 변경. 그러나 App Router 공식 지원은 v5만.

---

### ADR-015: Prisma ORM 선택
**결정**: Prisma를 DB 접근 레이어로 사용  
**이유**:
- TypeScript 타입 자동 생성 → 런타임 오류 최소화
- 스키마 기반 마이그레이션 → DB 변경 이력 추적
- Supabase (PostgreSQL)와 완전 호환

**트레이드오프**: Prisma Client 번들 크기 (~600KB). Edge Runtime 사용 제한 → API Routes는 Node.js Runtime으로 운영.

---

### ADR-016: TanStack Query로 클라이언트 서버 상태 관리
**결정**: 클라이언트 컴포넌트의 서버 데이터 fetching에 TanStack Query 사용  
**이유**:
- 캐싱, 리페치, 로딩/에러 상태 자동 관리
- `useMutation`으로 낙관적 업데이트 지원 (좋아요 즉시 반영)
- `refetchInterval`로 알림 폴링 구현

**트레이드오프**: 번들 크기 추가 (~40KB gzip). 서버 컴포넌트에서는 불필요 — 서버 컴포넌트는 직접 fetch.

---

### ADR-017: 키워드 검색에 PostgreSQL ILIKE 사용
**결정**: 게시판 키워드 검색은 서버사이드 PostgreSQL ILIKE로 구현  
**이유**:
- 클라이언트 필터링: 전체 데이터 로드 후 필터 → 데이터 증가 시 성능 저하
- Elasticsearch/Algolia: 외부 서비스 의존성, MVP 범위 초과
- PostgreSQL ILIKE: 추가 인프라 없이 대소문자 무시 부분 매칭. 현재 규모에서 충분.

**트레이드오프**: ILIKE는 인덱스를 완전히 활용 못함. `pg_trgm` GIN 인덱스로 개선 가능 (Supabase 대시보드에서 활성화 가능).

---

### ADR-018: 게시판 문제 상세에서 직접 풀기 기능 제외
**결정**: `/board/[id]`에서 문제를 직접 풀 수 없다. 퀴즈 플로우(`/quiz`)에서만 풀기.  
**이유**: 단일 문제 즉시 채점은 기존 세션 기반 채점·히스토리 로직과 별도 구현 필요. 게시판의 목적은 탐색과 커뮤니티 상호작용이며 학습은 퀴즈 플로우에 집중.  
**트레이드오프**: 흥미로운 문제를 바로 풀 수 없는 UX 마찰. 추후 "이 문제 포함하여 퀴즈" 기능으로 개선 가능.

---

### ADR-019: question.attemptCount/correctCount 역정규화
**결정**: `Question` 테이블에 `attemptCount`, `correctCount` 컬럼을 두어 집계 결과를 캐싱  
**이유**: 게시판 목록에서 매 요청마다 `QuestionAttempt` 전체 집계 쿼리를 날리면 성능 저하. 퀴즈 제출 시 `$transaction`으로 원자적 업데이트하여 일관성 보장.  
**트레이드오프**: 캐시 불일치 가능성 (트랜잭션 실패 시). 데이터 수정이 퀴즈 제출 1경로뿐이므로 리스크 낮음.

---

### ADR-020: 보기 자동 생성에 OpenAI gpt-4o-mini 사용
**결정**: 문제 제출 시 정답만 입력하면 오답 보기 3개를 `gpt-4o-mini` API로 자동 생성한다.

**이유**:
- 문제를 등록할 때 정답보다 그럴듯한 오답 3개를 만드는 것이 기여자에게 가장 어려운 부분
- GPT는 CS 도메인 지식을 보유하고 있어 주제에 맞는 그럴듯한 오답(distractor) 생성 품질이 높음
- `gpt-4o-mini`는 OpenAI 최저가 채팅 모델 — 요청 1건당 약 $0.0001 (0.01원) 수준으로 운영 비용 무시 가능
- 생성된 보기는 사용자가 수정 가능하고, 최종 승인은 관리자가 검토하므로 품질 리스크 낮음
- 보기 자동 생성은 제출 폼에서 버튼 클릭 시에만 실행 — 핵심 제출 플로우와 분리되어 API 실패가 제출을 막지 않음

**트레이드오프**:
- OpenAI 외부 API 의존성 추가 (API 장애 시 자동 생성 버튼만 비활성화, 수동 입력으로 폴백)
- AI 생성 오답이 너무 쉽거나 부정확할 수 있음 → 관리자 검토 단계에서 보정 가능
- `gpt-4o-mini` 대신 더 강력한 모델로 교체 시 비용 증가 가능 (현재 불필요)

**기각한 대안**:
- Claude API: 임베딩 API가 없어 ADR-021의 유사 문제 감지와 같이 쓸 수 없음. 단일 API 키 관리를 위해 OpenAI 선택
- 규칙 기반 오답 생성 (유사어 치환 등): CS 도메인 특성상 정확한 오답 생성이 어렵고 유지보수 비용 높음

---

### ADR-021: 유사 문제 감지에 pgvector + OpenAI 임베딩 사용
**결정**: 문제 제출 시 실시간 힌트와 관리자 승인 화면의 유사 문제 표시에 `pgvector` 확장 + OpenAI `text-embedding-3-small` 임베딩을 사용한다.  
임베딩 대상 텍스트는 **문제 + 정답 텍스트 결합**(`"${question} ${correctAnswer}"`)으로 한다.

**이유**:
- 실제 운영 중 pg_trgm으로는 탐지 불가능한 케이스 발생 — `제1정규형(1NF)의 조건은?` vs `"모든 속성값이 원자값이어야 한다" 몇 정규형에 해당하나요?` → 같은 개념, 완전히 다른 표현, 트라이그램 유사도 0.05 수준으로 탐지 불가
- 임베딩 방식은 의미(semantic) 기반 비교라 표현이 달라도 같은 개념이면 높은 유사도 반환
- Supabase가 pgvector 기본 지원 → 별도 인프라 불필요
- HNSW 인덱스로 수만 건에서도 밀리초 수준 검색 가능 → 1,000문제 이상 규모에서도 성능 문제 없음
- 이미 ADR-020에서 OpenAI API 키가 도입됨 → 추가 의존성 없음
- 임베딩 비용: 문제 1개당 $0.000002 (사실상 무료)

**임베딩 텍스트 전략**:
- 문제 텍스트만 임베딩 시: 짧은 질문은 맥락 부족으로 코사인 유사도가 0.4 수준으로 낮아 임계값 설정 불가
- 문제 + 정답 텍스트 결합 시: `제1정규형(1NF)의 조건은? 모든 속성값이 원자값(Atomic Value)이어야 한다` → 유사도 0.7 수준으로 상승, 임계값 0.5로 안정적 탐지

**운영 방식**:
- 문제 승인 시: 임베딩 생성 후 DB 저장 (비동기, 승인 플로우 블로킹 없음)
- 유사 문제 검색: 코사인 유사도 0.5 이상인 문제 TOP 3 반환
- 기존 문제 백필: `/api/admin/backfill-embeddings` 엔드포인트로 일괄 처리

**트레이드오프**:
- Prisma가 vector 타입 미지원 → `$queryRaw` / `$executeRaw` 직접 작성 필요
- OpenAI API 장애 시 임베딩 생성 실패 → 승인은 정상 처리, 해당 문제만 백필로 보완
- 임계값 0.5는 운영하며 조정 가능 (오탐 많으면 올리고, 탐지율 낮으면 내림)

**기각한 대안**:
- pg_trgm: 문자 수준 비교라 의미 기반 중복 탐지 불가. 실제 운영에서 한계 확인 후 폐기

→ 임베딩 전략 탐색 과정(pg_trgm → 문제만 임베딩 → 결합 임베딩)은 [TROUBLESHOOTING.md#TS-001](./TROUBLESHOOTING.md#ts-001-유사-문제-감지--임베딩-전략-탐색) 참조.

---

### ADR-022: 좋아요와 북마크를 단일 Like 모델로 통합

**결정**: 기존 `Like` 모델을 그대로 유지하고 UI 명칭만 "좋아요" → "북마크"로 변경. DB 스키마 변경 없음.

**이유**:
- 좋아요와 북마크의 데이터 구조가 동일 (`userId + questionId` 토글)
- 마이페이지의 "좋아요한 문제"와 "북마크한 문제"는 기능이 완전히 겹침 — 분리 시 두 개의 중복 테이블 필요
- 퀴즈·대결·결과·게시판 전 영역에서 단일 API(`/api/questions/[id]/like`)로 통합 관리

**트레이드오프**: 좋아요(공감)와 북마크(저장)를 의미론적으로 구분할 수 없음. 현재 규모에서는 하나의 목적(나중에 다시 보기)으로 충분.

---

### ADR-023: result 페이지 서버/클라이언트 분리 (OG 메타태그)

**결정**: `result/[sessionId]/page.tsx`를 서버 컴포넌트로 전환, 모든 클라이언트 코드는 `ResultClient.tsx`로 분리.

**이유**:
- Next.js `generateMetadata`는 서버 컴포넌트에서만 동작
- `"use client"` 파일에서는 `generateMetadata` export 불가 → 페이지 분리 필수
- 서버 컴포넌트에서 Prisma로 QuizSession 직접 조회 → `score`, `category`, `questionIds` 기반 동적 OG 태그 생성
- Discord·카카오톡 등에서 URL 붙여넣기 시 결과별 개인화된 미리보기 카드 표시

**트레이드오프**: 파일이 두 개로 늘어나 구조가 복잡해짐. 그러나 Next.js의 표준 서버/클라이언트 분리 패턴이므로 유지보수 부담 낮음.

---

### ADR-024: 카카오 공유에 SDK 방식 + Web Share API fallback 적용

**결정**: "공유하기" 버튼 클릭 시 공유 모달을 표시. 모달 내에서 ① 카카오 SDK (`sendDefault`) ② Web Share API ③ 링크 복사 순으로 선택.

**이유**:
- Web Share API는 Windows 시스템 공유 시트를 열지만 KakaoTalk이 Windows 공유 대상으로 등록되지 않음 → 카카오 전송 불가
- 카카오 SDK (`sharer.kakao.com`)는 Windows 데스크탑에서도 웹 팝업으로 친구 선택 후 전송 가능
- 모바일에서는 Web Share API가 시스템 공유 시트(카카오톡 포함)를 열기 때문에 두 옵션 모두 제공하는 게 최적
- 단일 "공유하기" 버튼에 모달로 통합해 상단 버튼 수를 최소화

**트레이드오프**: 카카오 SDK는 `NEXT_PUBLIC_KAKAO_APP_KEY` 환경변수 + Kakao Developers 플랫폼 도메인 등록이 필요. 키 미설정 시 카카오 버튼 미표시(graceful degradation).

**localhost 주의**: `localhost` URL은 카카오/Discord 서버가 접근 불가 → OG 미리보기·카카오 SDK 공유가 정상 동작하지 않음. 배포 도메인에서만 확인 가능.

---

### ADR-025: 대결 실시간 동기화에 Supabase Broadcast 사용

**결정**: 대결 화면(`/battle/[id]`)에서 GameRoom 상태 변경을 Supabase Realtime Broadcast로 즉시 전파. 클라이언트는 신호만 받고 인증된 API로 refetch.

**이유**:
- 폴링만으로는 5초 타이머 구간에서 양쪽 클라이언트가 상태를 다른 시각에 보는 문제 발생 (최대 폴링 간격만큼 지연)
- `postgres_changes` 대신 Broadcast를 선택한 이유: `postgres_changes`는 Supabase Dashboard에서 테이블별 Replication 활성화 필요 + anon 키로 구독 시 RLS 없으면 전체 GameRoom row 데이터(questionIds, answers 등) 노출
- Broadcast는 신호만 전달(payload 없음) → 실제 데이터는 인증된 API 경유 → 보안 문제 없음
- Dashboard 설정 불필요 (DB Replication 활성화 없이 동작)

**구현**:
- 서버: `broadcastBattleUpdate(roomId)` — `supabaseServer.channel().send()` via HTTP fallback (서버리스 친화적, await으로 응답 전 완료 보장)
- 클라이언트: `supabaseBrowser.channel('battle-room-{id}').on('broadcast', ...)` → `queryClient.invalidateQueries`
- Fallback: Broadcast 실패 시 TanStack Query 폴링 (일반 1s, 5초 단축 모드 500ms)

**연속 쌍방 스킵 로직**:
- `consecutiveAllSkip >= 1` → 5초 단축 타이머 적용
- `consecutiveAllSkip >= 3` → 무효(void) 종료
- 클라이언트 auto-mode 타이머: `questionStartedAt + 5000ms` 절대 시각 기준 → 폴링 타이밍 무관하게 양쪽 동시 제출

**트레이드오프**:
- Broadcast가 100% 신뢰 보장은 아님 → 폴링 fallback 필수
- `supabaseServer.channel().send()` 미구독 상태 HTTP fallback은 내부 구현에 의존적 → supabase-js 메이저 버전 업 시 재검증 필요

---

### ADR-026: 퀴즈 모드(normal/review/timed) — review 모드 랭킹 제외

**결정**: 오답복습·북마크 재풀이는 `mode: 'review'`로 저장하고 랭킹·뱃지·레벨업·스트릭에서 제외한다. 시간제한 모드(`timed`)는 일반과 동일하게 반영한다.

**이유**:
- review 모드는 이미 틀렸거나 저장해둔 문제만 풀므로 정답률이 인위적으로 낮음 → 랭킹에 반영 시 공정하지 않음
- timed 모드는 동일한 문제 풀에서 랜덤 출제 → 시간 압박만 다르므로 랭킹 반영이 타당
- `isRanked = mode !== 'review'` 한 줄로 판단 가능 → 구현 복잡도 낮음

**구현**:
- `POST /api/quiz/sessions`: `isRanked = safeMode !== 'review'`로 판단, if 블록으로 뱃지/스트릭 갱신 감쌈
- 뱃지 카운트 쿼리: `mode: { in: ['normal', 'timed'] }` 필터
- `src/lib/rankings.ts`: `JOIN "QuizSession" qs ON qa."sessionId" = qs.id AND qs.mode != 'review'`

**트레이드오프**: review 세션이 마이페이지 히스토리에는 기록되지만 통계에서 제외되어 "실제 실력과 다른" 문제 개수로 혼동 가능. 현재는 모드 배지로 구분해 명확히 표시.

---

### ADR-027: 시간제한 타이머 — 단일 useEffect + 로컬 변수 패턴

**결정**: 타이머를 3개의 분리된 `useEffect`가 아닌 단일 `useEffect`에서 `setInterval` + 로컬 `remaining` 변수로 구현한다.

**이유**:
- React는 동일 이벤트 루프 내 여러 setState를 배칭할 수 있어, 기존의 `setTimeLeft` + `currentIndex` 변경 감지를 여러 effect로 나누면 `currentIndex` 변경 시 두 effect가 동시에 fire → 2문제씩 건너뛰는 버그 발생
- 단일 effect에서 `remaining` 지역 변수를 쓰면 setState를 거치지 않고 즉시 감소 → 단일 interval에서 정확히 1초에 1 감소 보장
- `handleSubmitRef.current = handleSubmit` 패턴으로 stale closure 문제 없이 최신 `handleSubmit` 참조 유지

**트레이드오프**: `setTimeLeft`는 UI 표시용으로만 사용, 실제 제어 흐름은 지역 변수로 관리 — 두 값의 역할이 분리되어 코드 읽기가 처음엔 직관적이지 않을 수 있음.

→ 시행착오 기록: [TROUBLESHOOTING.md#TS-003](./TROUBLESHOOTING.md#ts-003-시간제한-타이머-race-condition)

---

### ADR-028: AI 문제생성 배치 방식 (GPT json_object 10개 제한 우회)

**결정**: `POST /api/admin/generate-questions`에서 GPT-4o `json_object` 모드로 한 번에 N개를 요청하지 않고 `BATCH_SIZE = 10`씩 나눠 순차 호출한다.

**이유**:
- GPT-4o `json_object` 모드는 `max_tokens`와 무관하게 배열 크기를 자체적으로 약 10개로 제한함 — 20개 요청 시에도 10개만 반환
- `json_object`를 유지해야 파싱 실패 없이 안정적으로 구조화 데이터를 받을 수 있음
- 배치당 이전 결과를 `excludedTitles`로 전달해 중복 생성 억제
- 이후 pgvector 코사인 유사도(임계값 0.85) 검사로 DB 기존 문제와 중복 최종 필터링

**트레이드오프**: N/10번의 순차 API 호출 → 30개 요청 시 최대 ~15-20초 소요. 어드민 전용 기능이므로 latency 허용.

→ 시행착오 기록: [TROUBLESHOOTING.md#TS-002](./TROUBLESHOOTING.md#ts-002-gpt-4o-json_object-모드-배열-10개-제한)

---

### ADR-030: 유사 문제 검색 — 벡터+pg_trgm+희귀토큰 가중치 하이브리드 재정렬

**결정**: `GET /api/questions/similar`를 순수 코사인 유사도 임계값 단일 판정에서, 벡터 유사도(0.5) + pg_trgm 문자열 유사도(0.2) + 코퍼스 희귀 토큰 가중치(0.3)를 합산하는 하이브리드 재정렬 방식으로 변경한다. 벡터 유사도 게이트는 0.35로 낮춰 후보군만 넉넉히 확보하고, 최종 정렬은 하이브리드 점수로 한다.

**이유**:
- ADR-021의 단일 임계값 방식은 "데이터베이스에서 트리거" 같은 실사용 쿼리에서 반복적으로 실패함 — "데이터베이스" 패턴의 문제가 코퍼스에 81건 있어 벡터 유사도 순위 상단을 차지하고, 실제 정답인 "트리거" 문제 2건은 임계값(0.5) 미만으로 밀려남
- 임계값을 0.52→0.55로 올리는 시도는 다른 정상 쿼리를 깨뜨림 (whack-a-mole) — 임계값 자체가 문제가 아니라 순위 결정 방식이 문제였음
- 희귀 토큰(코퍼스 등장 빈도 `1/√count`) 가중치를 추가하면, "트리거"처럼 드문 핵심어가 포함된 문제가 "데이터베이스"처럼 흔한 단어만 겹치는 문제보다 우선순위를 가짐 — 별도 불용어 사전 유지 없이 빈도 기반으로 자동 처리
- "트리거"/"trigger"처럼 언어가 달라 벡터·트라이그램 모두 못 잡는 케이스는 CS 용어 한/영 동의어 사전(`SYNONYM_GROUPS`)으로 별도 정규화

**트레이드오프**:
- 사전에 없는 동의어(수동 등록 방식)는 여전히 못 잡음 — 커버리지가 사전 크기에 의존
- 코퍼스 카운트 조회(토큰당 쿼리 1회)가 추가돼 지연시간 소폭 증가 — 토큰 수가 보통 2~4개 수준이라 무시 가능
- 점수 가중치(0.5/0.2/0.3)는 경험적으로 조정한 값 — 운영 데이터 축적 후 재조정 가능

**기각한 대안**: 임계값만 계속 낮추는 방식 — 관련 없는 문제가 대량 유입돼 노이즈 증가.

→ 재현 사례와 시행착오는 [TROUBLESHOOTING.md#TS-004](./TROUBLESHOOTING.md#ts-004-유사-문제-검색--흔한-단어에-드문-핵심어가-묻히는-문제) 참조.

---

### ADR-031: 페이지네이션 UI를 콜백형 공용 컴포넌트로 통합

**결정**: 관리자·마이페이지·게시판 등 13곳에 중복 구현되어 있던 "이전/다음"류 페이지네이션을 `PaginationNav`(콜백형, `src/components/PaginationNav.tsx`) 하나로 통합한다. URL 기반 페이지네이션이 필요한 게시판은 `board/Pagination.tsx`가 `PaginationNav`를 감싸 `router.push`만 연결하는 얇은 래퍼로 둔다.

**이유**:
- 기존 코드가 페이지 수가 많을 때(관리자 78페이지 등) 이전/다음 버튼만 제공해 첫/끝 페이지 이동이 번거로움
- 각 탭마다 동일한 버튼 마크업이 복붙되어 있어 디자인을 한 번에 바꾸기 어려움
- 페이지가 많을 때 숫자를 전부 나열하면 좁은 화면에서 넘치므로, 첫/끝 번호 + 현재 페이지 주변 + 말줄임표(`…`)를 계산하는 순수 함수(`buildPageList`, `src/lib/pagination.ts`)로 분리 — 테스트 용이성 확보(TDD로 먼저 작성)
- 컴포넌트 자체를 `inline-flex`가 아닌 폭을 채우는 `flex justify-center` 블록으로 만들어, 호출부의 래퍼 div가 가운데 정렬을 신경 쓰지 않아도 항상 중앙에 오도록 구조화

**트레이드오프**: 페이지 수가 매우 많을 때(예: 78페이지) 현재 페이지 주변 5개 + 처음/끝만 보이고 그 사이 페이지는 화살표로 한 칸씩만 이동 가능 — 임의 페이지로 한 번에 점프하는 기능은 없음. 필요시 숫자 직접 입력 UI로 확장 가능하나 현재 규모에서는 불필요.

---

### ADR-029: Navigator lockedBefore — 시간제한 모드 이전 문제 잠금

**결정**: `Navigator` 컴포넌트에 `lockedBefore?: number` prop을 추가한다. 이 인덱스 미만의 번호는 클릭 불가 + 비활성 스타일로 표시한다.

**이유**:
- 시간제한 모드에서는 이전 문제로 돌아가면 타이머가 리셋되어 무한 시간 확보 가능 → 반드시 차단 필요
- `lockedBefore={isTimed ? currentIndex : 0}`로 일반 모드에서는 동작 변화 없음 — 기존 사용처 수정 불필요
- disabled + pointer-events-none이 아닌 `onClick` 내 가드 처리를 병행해 접근성 속성 충돌 방지

**트레이드오프**: 시간제한 모드에서 지나간 문제가 "선택 완료(초록)" 상태로 보여도 클릭이 안 되어 혼란스러울 수 있음 → `opacity-40` 처리로 비활성임을 명시.

---

### ADR-032: DB 기반 레이트리밋 도입 (Redis 없이)

**결정**: 별도 인프라(Redis/Upstash) 없이 `RateLimit` 테이블(key, count, windowStart)로 고정 윈도우 레이트리밋을 구현한다. `src/lib/rate-limit.ts`의 `isRateLimited(key, limit, windowSeconds)` 하나로 모든 엔드포인트가 공용.

**이유**:
- 보안 점검 중 댓글/신고/문의/채팅 등 일반 API에 스팸 방지 장치가 전혀 없고, 비로그인 문제 목록 API(`/api/questions`)는 프론트에서 아무도 안 쓰는데도 공개돼 있어 스크립트로 페이지네이션 순회하면 전체 문제 데이터를 몇 분 안에 긁어갈 수 있는 상태였음
- 프로젝트 규모상 Redis 등 외부 인프라를 새로 들이는 건 과함 — 이미 Postgres/Prisma가 있고, `AuditLog` 카운팅(AI 생성 일일 제한)으로 DB 기반 카운팅 패턴이 이미 검증됨
- 단순 read-then-write라 완벽히 원자적이진 않지만(동시 요청 시 카운트 1~2개 오차 가능), 이 프로젝트 규모의 위협 모델에서는 충분

**트레이드오프**: 매 요청마다 DB 조회 1~2회 추가(지연 미미). 정확한 동시성 보장이 필요하면 추후 원자적 UPSERT(raw SQL)로 교체 가능하나 현재는 불필요.

---

### ADR-033: 채팅 API에 친구관계 서버 검증 추가

**결정**: `POST /api/chat/messages`에서 발신자·수신자 간 `Friendship(status: ACCEPTED)` 존재 여부를 서버에서 직접 확인한다.

**이유**:
- 기존엔 `FriendPanel`이 친구에게만 메시지 버튼을 보여주는 것으로만 막혀 있었음 — 이건 UI 단속이지 보안이 아님
- `userId`가 공개 프로필(`/u/[nickname]`)에서 노출되므로, 닉네임만 알면 API를 직접 호출해 친구 아닌 사람에게도 DM 전송이 가능했음
- 클라이언트 검증은 항상 우회 가능하다는 전제하에, 상태를 변경하는 모든 API는 서버에서 권한을 다시 검증해야 함

**트레이드오프**: 없음 — 순수 방어 로직 추가, 기존 정상 흐름(친구끼리 채팅)에는 영향 없음.

---

### ADR-034: 퀴즈 플레이 화면 정답 비노출 + 제출 레이트리밋

**결정**: `quiz/play/page.tsx`가 `QuizPlayClient`로 내려주는 문제 목록에서 `answer`/`explanation` 필드를 제거한다(`Omit<Question, "answer" | "explanation">`). `POST /api/quiz/sessions`에 재제출 레이트리밋(60초 10회)을 추가한다.

**이유**:
- CLAUDE.md에 "정답 prop 전달 금지"가 이미 규칙으로 있었는데도 실제로는 지켜지지 않아, devtools/React DevTools로 문제를 풀기 전에 20문제 정답을 전부 볼 수 있었음 — 코드 확인 결과 `QuizPlayClient`는 애초에 `answer`/`explanation`을 전혀 사용하지 않아(채점은 서버에서만) 제거해도 기능 손실 없음
- 채점 자체(`api/quiz/sessions`)는 서버가 DB 정답과 재대조해 원래 안전했지만, 동일 요청을 무한 반복 제출하는 걸 막는 장치가 없어 XP·포인트·연속출석·뱃지를 무제한 파밍 가능했음
- `sample()`(`src/lib/sample.ts`)이 `Question[]`에 하드코딩돼 있어 제네릭(`<T>(pool: T[], n: number): T[]`)으로 변경 — 순수 셔플 로직이라 타입만 넓혀도 동작 동일

**트레이드오프**: 없음 — 게시판(`/board/[id]`)에서 승인된 문제의 정답을 공개하는 건 의도된 커뮤니티 기능이라 그대로 유지(이걸로 문제ID→정답을 사전에 수집해 우회하는 건 이론상 가능하지만, 이건 게시판 설계 자체의 트레이드오프이지 이번 수정의 범위 밖).

---

### ADR-035: 대결 생성 레이트리밋을 친구쌍(pair) 단위로 설계

**결정**: 대결방 생성(`POST /api/battle/rooms`)에 하루 상한(50회)을 두되, 키를 `battle-create:{userId}`가 아닌 `battle-create:{[userId,friendId].sort().join('-')}`(친구쌍 정렬 조합)로 설계한다.

**이유**:
- 대결 하나가 물리적으로 몇 초면 끝날 수 있는데(문항당 즉시 답변해도 통과) 대결 생성 자체엔 제한이 없어, 알트 계정 2개가 대결 생성→즉시 답변→종료→재생성을 반복하면 대전 XP(15/10/5)를 무제한 파밍할 수 있었음
- XP는 마이페이지 프로필 카드의 레벨 배지 표시용일 뿐 기능적 이득이 없어(랭킹·잠금해제 등에 미사용) 파밍 자체의 피해는 크지 않음 → 상한을 유저 전체 합산이 아닌 **같은 상대와의 반복만** 제한해, 친구가 여러 명인 유저의 정상적인 다회 대결을 막지 않으면서 원래 막으려던 "같은 두 계정끼리 자작극" 패턴에 오히려 더 정확히 대응
- 하루 50회는 실사용에서 거의 도달 불가능한 여유값 — 스크립트의 무한 생성만 차단하는 안전장치 목적

**트레이드오프**: 상대가 거절해도 재초대를 막는 쿨다운은 없음(별도 이슈, 우선순위 낮음).

---

### ADR-036: 커스텀 도메인(csora.co.kr) 채택, 대표 도메인은 www 없는 apex

**결정**: `csora.vercel.app` 대신 자체 구매한 `csora.co.kr`을 대표 도메인으로 쓴다. `www.csora.co.kr`과 `csora.vercel.app`은 둘 다 308로 `csora.co.kr`에 리다이렉트한다.

**이유**:
- 서비스 정체성과 신뢰도를 위해 자체 도메인 필요
- www 유무는 개인 선호이나, 국내 주요 서비스(네이버·다음 등) 관례를 따라 apex(www 없음)를 대표로 선택 — 공유 링크가 더 짧고 간결함
- `csora.vercel.app`도 그대로 살려두고 리다이렉트만 걸어 기존에 공유된 링크(카카오톡 공유 이력 등)가 깨지지 않게 함

**구현 시 발견한 함정**: `NEXTAUTH_URL`을 단일 도메인(`csora.co.kr`)으로 고정하자, **구 도메인(`csora.vercel.app`)에서의 로그인이 `MissingCSRF` 에러로 깨짐** — 로그인 폼이 쿠키 없는 다른 도메인으로 제출되며 CSRF 검증이 실패하는 구조. 근본 해결책은 두 도메인의 NEXTAUTH_URL을 각각 동적으로 대응시키는 게 아니라, **애초에 구 도메인 접근 자체를 플랫폼(Vercel Domains) 레벨에서 새 도메인으로 리다이렉트**시켜 이 경로에 도달하지 못하게 막는 것 — 리다이렉트 설정 후 문제 재현 안 됨을 확인.

**트레이드오프**: Google/카카오 OAuth 콘솔에는 신·구 도메인 리디렉션 URI를 당분간 둘 다 등록해둠(전환 기간 안전장치, 신 도메인 리다이렉트가 100% 안정화되면 구 도메인 URI는 정리 가능).

---

### ADR-037: 유사문제 검색 동의어를 하드코딩 사전 + 관리자 DB 오버레이 병합 방식으로

**결정**: 기존 하드코딩 `SYNONYM_GROUPS`(`src/lib/similar-search.ts`)를 유지하면서, 관리자가 `/admin`에서 직접 추가·삭제할 수 있는 `SynonymGroup`/`SynonymTerm` DB 모델을 새로 만들고, `buildSynonymLookup()`으로 두 출처를 런타임에 병합한 단일 조회 테이블을 만든다.

**이유**:
- 하드코딩 사전만으로는 새로운 CS 용어 동의어(예: 신조어, 특정 강의에서만 쓰는 표현)를 발견할 때마다 코드 배포가 필요해 대응이 느림
- 반대로 처음부터 전부 DB 기반으로 바꾸면 이미 검증된 기본 사전을 굳이 마이그레이션 스크립트로 옮겨야 하고, 실수로 삭제될 위험도 생김
- 두 출처를 병합하는 방식은 기존 동작(테스트로 이미 검증된 하드코딩 사전)을 전혀 건드리지 않으면서 운영 중 유연하게 확장 가능한 지점만 추가

**트레이드오프**: 동의어 조회가 요청마다 DB 쿼리(`SynonymGroup.findMany`) 1회 추가됨 — 그룹 수가 많지 않아 성능 영향은 미미.

---

### ADR-038: 계정 완전삭제(하드 딜리트)를 비활성화(소프트딜리트)와 별도 기능으로 추가

**결정**: 관리자 유저 관리에 기존 "비활성화"(`deletedAt` 설정)와 별개로 `DELETE /api/admin/users/[id]`로 유저 로우 자체를 삭제하는 "완전삭제" 버튼을 추가한다. FK RESTRICT 관계 테이블은 `$transaction`으로 먼저 정리한다.

**이유**:
- 비활성화만으로는 개인정보(이메일 등)가 DB에 영구히 남아, 사용자가 명시적으로 완전 삭제를 요청하는 경우(예: 개인정보 삭제 요청) 대응할 수단이 없었음
- `schema.prisma`의 관계 선언만으로는 실제 FK 동작(RESTRICT/CASCADE/SET NULL)을 알 수 없어, `information_schema.referential_constraints`를 직접 조회해 어떤 테이블을 먼저 지워야 하는지 확인 후 구현 — 확인 없이 바로 `user.delete()`만 호출했다면 실사용 중인 계정(풀이기록 있는 계정) 삭제 시 FK 위반으로 500 에러가 났을 것
- `Question.authorId`는 SET NULL이라 문제 자체(및 댓글)는 남기고 작성자 표시만 지워지는 게 의도된 동작 — 커뮤니티에 기여한 콘텐츠까지 함께 삭제하지 않음

**트레이드오프**: 완전삭제는 되돌릴 수 없음(비활성화는 재활성화 가능, 완전삭제는 불가) — 관리자 UI에서 확인 모달에 이 점을 명시. 자기 자신은 삭제 불가 처리.
