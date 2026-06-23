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
