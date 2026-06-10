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

### ADR-007: 퀴즈 진행 상태 미저장 (새로고침 시 초기화)
**결정**: `/quiz`의 퀴즈 진행 상태(선택 답안, 현재 문제 번호)를 sessionStorage나 localStorage에 저장하지 않는다  
**이유**: 진행 상태 저장/복원은 직렬화·역직렬화 코드 + 엣지 케이스(부분 데이터 복원, 문제 풀 변경 후 잔여 상태 처리 등)가 추가됨. MVP에서 이 기능의 사용자 가치 대비 구현 비용이 높음.  
**트레이드오프**: 사용자가 퀴즈 도중 새로고침하면 처음부터 다시 시작해야 함. 일반적인 퀴즈 앱에서 허용 가능한 UX.

---

### ADR-008: `/result` 진입 시 sessionStorage 즉시 삭제
**결정**: `/result` 컴포넌트 마운트 시 데이터 파싱 직후 `sessionStorage.removeItem('cs-quiz-result')` 호출  
**이유**: 결과 데이터를 한 번만 소비하도록 강제. 브라우저 뒤로가기로 `/result` 재진입 시 데이터가 없으므로 자동으로 홈 리다이렉트됨 — 의도치 않은 결과 재열람 방지 및 일관된 플로우 유지.  
**트레이드오프**: "뒤로가기로 결과 다시 보기" 불가. 결과를 다시 보려면 퀴즈를 다시 풀어야 함. 학습 목적 앱에서 재시도를 유도하는 UX이므로 의도적 제약.

---

### ADR-010: 보기 선택 후 자동 다음 문제 이동 없음 (Auto-advance 미적용)
**결정**: 보기를 선택해도 다음 문제로 자동 이동하지 않는다. 사용자가 수동으로 "다음" 버튼 또는 네비게이터를 눌러야 한다.  
**이유**: Auto-advance는 빠른 풀이를 유도하지만 오클릭 시 의도치 않게 다음 문제로 넘어가는 UX 문제가 있다. 학습 목적의 퀴즈에서 검토·변경 기회를 보장하는 것이 더 중요하다.  
**트레이드오프**: 풀이 속도가 약간 느려짐. 그러나 학습 앱에서는 의도적인 제약.

---

### ADR-011: 보기 순서 고정 (셔플 없음)
**결정**: `questions.ts`에 정의된 보기(options) 순서를 그대로 사용한다. 보기 셔플 없음.  
**이유**: 보기 셔플은 `sample.ts`와 별도의 로직이 필요하고, 정답 인덱스(`answer: 0|1|2|3`)를 셔플 후에도 올바르게 매핑해야 하므로 버그 발생 가능성이 높다. 문제 작성자가 의도한 보기 순서가 있을 수 있으므로 고정.  
**트레이드오프**: 문제를 여러 번 풀면 보기 순서가 외워질 수 있음. MVP 규모(~120문제)에서는 허용 가능.

---

### ADR-012: 풀이 히스토리 저장에 localStorage 사용
**결정**: 퀴즈 완료 시 `QuizResult`를 `localStorage['cs-quiz-history']`에 누적 저장 (최근 20회)  
**이유**:
- sessionStorage: 탭 닫으면 소멸 → 히스토리 보존 불가
- 외부 DB/서버: 인프라 추가 필요, MVP 범위 초과
- localStorage: 브라우저 닫아도 유지, 추가 인프라 없음, 기기 단위 히스토리로 충분

**트레이드오프**:
- 기기/브라우저 간 동기화 불가
- 브라우저 캐시 삭제 시 히스토리 소멸
- `questions[].answer` 필드가 localStorage에 포함됨 — 이미 클라이언트 번들에 노출된 데이터이므로 보안 수준 동일
- 최대 20회로 제한 (무한 누적 방지)

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
- Realtime 내장 (알림 폴링 대안으로 추후 활용 가능)

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
