# 아키텍처

## 디렉토리 구조
```
src/
├── app/
│   ├── layout.tsx             # 루트 레이아웃 (폰트, 배경색)
│   ├── page.tsx               # 시작 화면 (Server Component)
│   ├── quiz/
│   │   └── page.tsx           # 퀴즈 진행 화면 (Client Component)
│   ├── result/
│   │   └── page.tsx           # 결과 화면 (Client Component)
│   └── mypage/
│       └── page.tsx           # 마이페이지 (Client Component) — 히스토리 + 오답 노트
├── components/
│   ├── QuizCard.tsx           # 단일 문제 + 보기 4개
│   ├── Navigator.tsx          # 1~30 번호 점프 네비게이터
│   ├── ProgressBar.tsx        # 선택 완료 문제 수 기반 진행률 바
│   └── ResultCard.tsx         # 오답 1건 해설 카드
├── data/
│   └── questions.ts           # 전체 문제 정적 배열 (단일 진실 공급원)
├── lib/
│   ├── sample.ts              # 랜덤 30문제 샘플링
│   ├── grade.ts               # 채점 및 QuizResult 생성
│   └── history.ts             # localStorage 히스토리 read/write
└── types/
    └── index.ts               # 공유 타입 정의
```

---

## 핵심 타입 (`src/types/index.ts`)

```ts
type Category = 'ds' | 'algo' | 'os' | 'network' | 'db' | 'arch';

interface Question {
  id: string;               // 형식: "{category}-{001}" (예: "os-001")
  category: Category;
  question: string;
  options: [string, string, string, string];  // 인덱스 0=A, 1=B, 2=C, 3=D
  answer: 0 | 1 | 2 | 3;   // 정답 보기 인덱스
  explanation: string;      // 정답 이유 + 핵심 개념 1~3문장
}

// 사용자가 선택한 답안 (미선택 문제는 entries에 포함되지 않음)
interface UserAnswer {
  questionId: string;
  selected: 0 | 1 | 2 | 3;
}

// 채점 완료 결과 — sessionStorage에 직렬화하여 저장
interface QuizResult {
  questions: Question[];    // 출제된 30문제 (순서 유지)
  answers: UserAnswer[];    // 사용자 답안 (30개 전부 포함, 제출 시 보장)
  score: number;            // 정답 수 (0~30)
  submittedAt: string;      // ISO 8601 타임스탬프
}
```

**`id` 생성 규칙**: `{category}-{세 자리 순번}` (예: `os-001`, `network-042`). 중복 금지, 한 번 부여된 id는 변경하지 않는다.

---

## 패턴 및 렌더링 전략

| 페이지/컴포넌트 | 타입 | 이유 |
|----------------|------|------|
| `app/page.tsx` | Server Component | 정적 컨텐츠 + 문제 총 개수만 전달. 상호작용 없음. |
| `app/quiz/page.tsx` | Client Component (`"use client"`) | useState로 퀴즈 상태 전체 관리 |
| `app/result/page.tsx` | Client Component (`"use client"`) | sessionStorage 읽기, useEffect, useRouter |
| `app/mypage/page.tsx` | Client Component (`"use client"`) | localStorage 읽기, accordion useState |
| `components/QuizCard.tsx` | Client Component (`"use client"`) | onClick 이벤트 핸들러 포함 |
| `components/Navigator.tsx` | Client Component (`"use client"`) | onClick 이벤트 핸들러 포함 |
| `components/ProgressBar.tsx` | Server Component 가능 | props만 받아 렌더링. 이벤트 없음. |
| `components/ResultCard.tsx` | Server Component 가능 | props만 받아 렌더링. 이벤트 없음. |

**규칙**: `"use client"` 경계는 이벤트 핸들러나 브라우저 API(sessionStorage, useRouter)가 필요한 가장 아래쪽 컴포넌트에 선언한다. 불필요하게 상위 컴포넌트를 Client로 만들지 않는다.

---

## 데이터 흐름

```
questions.ts (정적 배열, 120개+)
  │
  └─ [/ 페이지] getTotalCount() → 총 문제 수 표시
  │
  └─ [/quiz 마운트] sample(questions, 30) → QuizSession 초기화
       │
       ├─ useState: { questions: Question[], answers: UserAnswer[], currentIndex: number }
       │
       └─ [제출 버튼 클릭]
            │
            └─ grade(questions, answers) → QuizResult
                 │
                 └─ sessionStorage.setItem('quizResult', JSON.stringify(result))
                      │
                      └─ router.push('/result')
                           │
                           └─ [/result 마운트] sessionStorage.getItem('quizResult')
                                ├─ 성공 → JSON.parse → 결과 렌더링
                                └─ 실패 → router.replace('/')
```

---

## 모듈별 상세 명세

### `src/lib/sample.ts`

```ts
// Fisher-Yates 셔플 후 앞 n개 반환
function sample(pool: Question[], n: number): Question[]
```

- `pool.length < n`인 경우: `console.error` 출력 후 pool 전체 반환 (앱이 죽지 않음)
- `pool.length === 0`인 경우: 빈 배열 반환
- 순수 함수 (부수효과 없음) — 테스트 용이성을 위해 PRNG를 주입 가능하게 설계 가능

### `src/lib/grade.ts`

```ts
function grade(questions: Question[], answers: UserAnswer[]): QuizResult
```

- `answers`에서 각 questionId로 selected를 조회, 없으면 해당 문제 오답 처리
- `score` = 정답 수 (answer 인덱스 === selected 인덱스인 문제 수)
- `submittedAt` = `new Date().toISOString()`
- 순수 함수

### `src/data/questions.ts`

```ts
export const questions: Question[] = [ ... ];
```

- 기본 export 없음, named export만 사용
- 최소 120개 유지 (CI 테스트로 검증)
- 카테고리별 최소 15개 (CI 테스트로 검증)

### `src/lib/history.ts`

```ts
function saveHistory(result: QuizResult): void  // localStorage에 최신 항목으로 prepend, 최대 20회 유지
function loadHistory(): QuizResult[]             // localStorage에서 배열 파싱, 실패 시 []
```

- 두 함수 모두 try/catch로 감싸 localStorage 차단 환경에서 조용히 실패
- `saveHistory`는 `/result` 컴포넌트 useEffect에서 sessionStorage 삭제 직후 호출

### `src/lib/guard.ts`

```ts
// sessionStorage에서 파싱한 unknown 값이 QuizResult인지 검증
function isQuizResult(data: unknown): data is QuizResult
```

검증 항목:
- `data`가 object이고 null이 아님
- `data.questions`가 비어있지 않은 배열
- `data.answers`가 배열
- `data.score`가 0 이상의 숫자
- `data.submittedAt`이 string

검증 실패 시 `false` 반환 → 호출부에서 `router.replace('/')` 처리.
`data.questions` 배열 내 각 Question의 모든 필드까지 검증하면 과도함 — 최상위 필드 존재 여부만 확인.

---

## 상태 관리

### QuizPage 상태 구조

```ts
// /quiz/page.tsx 내부
const [questions, setQuestions] = useState<Question[]>([]);   // 출제된 30문제
const [answers, setAnswers] = useState<UserAnswer[]>([]);      // 선택한 답안
const [currentIndex, setCurrentIndex] = useState(0);           // 현재 문제 인덱스 (0-based)
```

- `questions`는 마운트 시 1회 `sample()` 호출로 초기화, 이후 변경 없음
- `answers`는 보기 클릭 시 upsert (기존 답 있으면 교체, 없으면 추가)
- 전역 상태 라이브러리 없음 — 상태가 단일 페이지 내에 국한됨

### sessionStorage 사용 규칙

- **키**: `'cs-quiz-result'`
- **쓰기**: `/quiz` 제출 시 `JSON.stringify(QuizResult)`
- **읽기**: `/result` 마운트 시 `JSON.parse`
- **삭제**: `/result`에서 "다시 풀기" 클릭 시 `removeItem` 후 이동
- **읽기 후 삭제**: `/result` 진입 성공 시 즉시 `removeItem` — 브라우저 뒤로가기로 재진입 시 리다이렉트 처리

### localStorage 사용 규칙

- **키**: `'cs-quiz-history'`
- **쓰기**: `/result` 파싱 성공 후 `saveHistory(result)` 호출 (`src/lib/history.ts`)
- **읽기**: `/mypage` 마운트 시 `loadHistory()` 호출
- **최대 항목**: 20회 (초과 시 오래된 항목 자동 제거)
- try/catch 필수 — private 모드 등 localStorage 차단 환경에서 앱이 죽으면 안 됨

---

## 에러 핸들링

### sessionStorage 쓰기 실패 (`/quiz`)

```ts
try {
  sessionStorage.setItem('cs-quiz-result', JSON.stringify(result));
  router.push('/result');
} catch (e) {
  // private 모드 등 sessionStorage 차단 환경
  console.error('[QuizPage] sessionStorage write failed:', e);
  router.replace('/');  // 홈으로 fallback
}
```

### sessionStorage 읽기 실패 또는 데이터 없음 (`/result`)

```ts
useEffect(() => {
  try {
    const raw = sessionStorage.getItem('cs-quiz-result');
    if (!raw) { router.replace('/'); return; }
    const result: QuizResult = JSON.parse(raw);
    sessionStorage.removeItem('cs-quiz-result');  // 즉시 삭제
    setResult(result);
  } catch (e) {
    console.error('[ResultPage] sessionStorage read failed:', e);
    router.replace('/');
  }
}, []);
```

### 파싱 실패 / 타입 불일치

- `JSON.parse` 성공했더라도 필드 누락 가능 → `result.questions` 배열 존재 여부 등 최소 검증
- 검증 실패 시 `router.replace('/')`

### `/result` 직접 접근 (데이터 없음)

- `sessionStorage.getItem` 반환값이 `null` → `router.replace('/')` 처리로 해결됨 (위와 동일)

### 문제 풀 부족 guard (`sample.ts`)

```ts
if (pool.length < n) {
  console.error(`[sample] pool size(${pool.length}) < requested(${n}). Returning full pool.`);
  return shuffle(pool);  // 앱은 정상 작동, 단 문제 수가 30개 미만일 수 있음
}
```

---

## 테스트 전략

### 테스트 파일 목록

| 파일 | 대상 | 검증 내용 |
|------|------|----------|
| `src/lib/sample.test.ts` | `sample()` | 반환 수 == n, 중복 없음, pool 부족 guard, 빈 pool |
| `src/lib/grade.test.ts` | `grade()` | 전부 정답, 전부 오답, 일부 오답, 미선택 문제 오답 처리 |
| `src/lib/guard.test.ts` | `isQuizResult()` | 정상 객체, 필드 누락, null, 타입 오류 케이스 |
| `src/data/questions.test.ts` | `questions` 배열 | 총 120개+, 카테고리별 15개+, id 중복 없음, answer 범위(0~3) |

### 테스트 제외 대상
- React 컴포넌트 (UI 테스트는 MVP 범위 외, 순수 함수만 테스트)
- 페이지 컴포넌트 (sessionStorage/router 모킹 비용이 높음)

### 데이터 무결성 테스트 (`questions.test.ts`) 상세
```ts
// 반드시 검증해야 할 불변조건
- questions.length >= 120
- 카테고리별 count >= 15
- id 중복 없음 (Set으로 확인)
- 모든 answer가 0 | 1 | 2 | 3 범위
- 모든 options 배열 길이 == 4
- 모든 explanation 필드가 비어있지 않음
```

---

## 번들 크기 고려사항

`questions.ts`의 120개 문제는 클라이언트 번들에 포함된다.

- 문제당 예상 크기: ~600바이트 (질문 + 4개 보기 + 해설)
- 120개 × 600B = ~72KB raw → gzip 후 ~25KB 예상
- Next.js 기본 코드 스플리팅에서 `/quiz` 페이지 chunk에만 포함됨
- 25KB는 허용 가능한 수준. 별도 code splitting이나 lazy load 불필요.
- 문제 수가 500개 이상으로 증가하면 dynamic import를 고려한다 (현재 MVP 범위 외)

---

## 정답 노출 방지 전략

- `questions.ts`의 `answer` 필드는 클라이언트 번들에 포함됨 — 완전한 은폐는 불가
- **UI 레벨 보호**: 퀴즈 진행 중 `answer` 필드를 어떤 컴포넌트에도 prop으로 전달하지 않는다
- `QuizCard`는 `question: string`, `options: string[]`, `selectedIndex: number | null` 만 받음. `answer` 없음
- `grade.ts`는 제출 시점에만 `answer` 필드에 접근
- 번들 분석에서 `answer` 접근 경로가 `grade.ts` 외에 나타나면 버그로 간주

---

## 컴포넌트 인터페이스

### `QuizCard`
```ts
interface QuizCardProps {
  questionNumber: number;    // 1-based 표시용
  total: number;             // 30
  question: string;
  options: [string, string, string, string];
  selectedIndex: number | null;
  onSelect: (index: 0 | 1 | 2 | 3) => void;
}
```

### `Navigator`
```ts
interface NavigatorProps {
  total: number;             // 30
  currentIndex: number;      // 0-based
  answeredIndices: number[]; // 답안 선택 완료된 문제의 인덱스 목록
  onJump: (index: number) => void;
}
```

### `ResultCard`
```ts
interface ResultCardProps {
  questionNumber: number;   // 원래 출제 순서 (1-based)
  question: Question;
  userSelected: 0 | 1 | 2 | 3;
}
// answer, explanation은 question에서 직접 읽음
```

---

## v2: 풀스택 아키텍처

### 디렉토리 구조 (v2 추가)

```
src/
├── app/
│   ├── quiz/
│   │   ├── page.tsx               # 카테고리/ALL 선택 화면 (신규)
│   │   └── play/
│   │       └── page.tsx           # 퀴즈 진행 (기존 /quiz → 이동)
│   ├── board/
│   │   ├── page.tsx               # 게시판 목록
│   │   ├── [id]/page.tsx          # 게시판 상세
│   │   └── submit/page.tsx        # 문제 등록
│   ├── admin/page.tsx             # 관리자 패널
│   ├── settings/page.tsx          # 계정 설정
│   ├── auth/setup-nickname/
│   │   └── page.tsx               # 닉네임 설정 온보딩
│   └── api/
│       ├── auth/[...nextauth]/route.ts
│       ├── users/nickname/route.ts        # POST/PATCH: 닉네임
│       ├── questions/
│       │   ├── route.ts                   # GET(목록+검색), POST(등록)
│       │   └── [id]/
│       │       ├── route.ts               # GET(상세)
│       │       ├── like/route.ts          # POST: 좋아요 토글
│       │       └── report/route.ts        # POST: 신고
│       ├── quiz/
│       │   └── sessions/
│       │       ├── route.ts               # POST: 세션 저장, GET: 히스토리
│       │       └── [id]/route.ts          # GET: 세션 상세
│       ├── rankings/route.ts              # GET: 카테고리별 TOP5
│       ├── notifications/route.ts         # GET: 알림 목록, PATCH: 읽음
│       ├── mypage/
│       │   ├── stats/route.ts
│       │   ├── sessions/route.ts
│       │   ├── wrong-answers/route.ts
│       │   ├── my-questions/route.ts
│       │   └── liked-questions/route.ts
│       └── admin/
│           ├── questions/
│           │   ├── route.ts
│           │   └── [id]/route.ts
│           └── reports/route.ts
├── components/
│   ├── Header.tsx                 # 공통 헤더 (Client Component)
│   ├── NotificationBell.tsx       # 알림 벨 + 드롭다운 (Client Component)
│   └── board/
│       ├── SearchBar.tsx
│       ├── FilterBar.tsx
│       ├── QuestionCard.tsx
│       ├── Pagination.tsx
│       ├── LikeButton.tsx
│       └── ReportModal.tsx
├── lib/
│   ├── auth.ts                    # NextAuth config + getSession 헬퍼
│   └── prisma.ts                  # Prisma client singleton
└── prisma/
    ├── schema.prisma              # DB 스키마
    └── seed.ts                    # 초기 데이터 시딩
```

---

### 데이터베이스 스키마 (Prisma)

```prisma
model User {
  id           String    @id @default(cuid())
  email        String    @unique
  nickname     String?   @unique
  avatarUrl    String?
  role         Role      @default(USER)
  streakCount  Int       @default(0)
  lastQuizDate DateTime?
  createdAt    DateTime  @default(now())

  sessions      QuizSession[]
  questions     Question[]
  attempts      QuestionAttempt[]
  likes         Like[]
  reports       Report[]
  notifications Notification[]
}

enum Role { USER ADMIN }

model Question {
  id              String         @id @default(cuid())
  authorId        String?
  category        String         // 'ds'|'algo'|'os'|'network'|'db'|'arch'
  question        String
  options         Json           // [string, string, string, string]
  answer          Int            // 0|1|2|3
  explanation     String
  status          QuestionStatus @default(PENDING)
  rejectionReason String?
  attemptCount    Int            @default(0)  // 역정규화 캐시
  correctCount    Int            @default(0)  // 역정규화 캐시
  createdAt       DateTime       @default(now())

  author   User?             @relation(fields: [authorId], references: [id])
  attempts QuestionAttempt[]
  likes    Like[]
  reports  Report[]
}

enum QuestionStatus { OFFICIAL PENDING APPROVED REJECTED BLINDED }

model QuizSession {
  id          String   @id @default(cuid())
  userId      String
  category    String   // 'all' | category code
  questionIds Json     // string[]
  answers     Json     // { questionId: string, selected: number }[]
  score       Int
  submittedAt DateTime @default(now())

  user     User              @relation(fields: [userId], references: [id])
  attempts QuestionAttempt[]
}

model QuestionAttempt {
  id          String   @id @default(cuid())
  userId      String
  questionId  String
  sessionId   String
  selected    Int
  isCorrect   Boolean
  attemptedAt DateTime @default(now())

  user     User        @relation(fields: [userId], references: [id])
  question Question    @relation(fields: [questionId], references: [id])
  session  QuizSession @relation(fields: [sessionId], references: [id])
}

model Like {
  userId     String
  questionId String
  createdAt  DateTime @default(now())

  user     User     @relation(fields: [userId], references: [id])
  question Question @relation(fields: [questionId], references: [id])

  @@id([userId, questionId])
}

model Report {
  id          String       @id @default(cuid())
  reporterId  String
  questionId  String
  reason      ReportReason
  description String?
  status      ReportStatus @default(PENDING)
  createdAt   DateTime     @default(now())

  reporter User     @relation(fields: [reporterId], references: [id])
  question Question @relation(fields: [questionId], references: [id])

  @@unique([reporterId, questionId])
}

enum ReportReason { INAPPROPRIATE ERROR DUPLICATE OTHER }
enum ReportStatus { PENDING REVIEWED }

model Notification {
  id        String           @id @default(cuid())
  userId    String
  type      NotificationType
  payload   Json             // { questionId, questionTitle, rejectionReason? }
  actionUrl String?
  isRead    Boolean          @default(false)
  createdAt DateTime         @default(now())

  user User @relation(fields: [userId], references: [id])
}

enum NotificationType { QUESTION_APPROVED QUESTION_REJECTED }
```

---

### 렌더링 전략 (v2 추가)

| 페이지/컴포넌트 | 타입 | 이유 |
|----------------|------|------|
| `app/quiz/page.tsx` | Server Component | 문제 수 조회, 정적에 가까움 |
| `app/board/page.tsx` | Server Component + Client 검색바 | 검색/정렬은 URL params + SSR |
| `app/board/[id]/page.tsx` | Server Component + Client 버튼 | 좋아요/신고 버튼만 Client 분리 |
| `app/board/submit/page.tsx` | Client Component | 폼 상태 관리 |
| `app/admin/page.tsx` | Client Component | 실시간 상태 변경 |
| `components/Header.tsx` | Client Component | useSession, useRouter |
| `components/NotificationBell.tsx` | Client Component | 30초 폴링 |

---

### 미들웨어 (`middleware.ts`)

```
보호 경로: /quiz/*, /board/submit, /mypage/*, /settings, /admin
1. 비로그인 → /api/auth/signin?callbackUrl=...
2. 닉네임 미설정 → /auth/setup-nickname?callbackUrl=...
3. /admin → role !== ADMIN → /
```

---

### 환경 변수

```bash
DATABASE_URL=          # Supabase connection pooler URL (Prisma용)
DIRECT_URL=            # Supabase direct connection URL (마이그레이션용)
NEXTAUTH_SECRET=       # openssl rand -base64 32
NEXTAUTH_URL=          # http://localhost:3000 (dev)
GOOGLE_CLIENT_ID=      # Google OAuth App Client ID
GOOGLE_CLIENT_SECRET=  # Google OAuth App Client Secret
```

---

### TanStack Query 사용 규칙

- 클라이언트 컴포넌트에서 서버 데이터 fetching: TanStack Query (`useQuery`, `useMutation`)
- 서버 컴포넌트: `fetch()` 또는 Prisma 직접 호출
- 폴링이 필요한 데이터(알림): `refetchInterval: 30_000`
- `QueryClientProvider`는 `src/app/providers.tsx`에서 최상위 래핑
