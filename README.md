# CSORA — CS Quiz, Level Up!

CS 핵심 개념을 문제로 빠르게 점검하는 웹 서비스. 틀린 문제는 자동으로 복습 예약되고, 친구와 실시간 1:1 대결도 즐길 수 있습니다.

🔗 **[csora.vercel.app](https://csora.vercel.app)**

---

## 주요 기능

| 기능 | 설명 |
|------|------|
| **CS 퀴즈** | 자료구조·알고리즘·OS·네트워크·DB·컴퓨터구조·소프트웨어공학 870+ 문제 |
| **오답 복습** | 1·3·7·30일 간격 반복 학습 스케줄링 |
| **1:1 대결** | Supabase Realtime 기반 실시간 퀴즈 대결 |
| **오늘의 문제** | 매일 1문제, 전체 참여자 정답률 공개 |
| **랭킹** | 카테고리별 + 전체 합산 TOP 5, 내 순위 |
| **게시판** | 문제 제보·질문·좋아요·신고 |
| **북마크** | 퀴즈·결과·게시판 전반 문제 즐겨찾기 |
| **뱃지·업적** | 풀이 수·정답률·연속 출석 기반 업적 시스템 |
| **AI 문제 생성** | GPT 기반 관리자 문제 배치 생성 |
| **카카오 공유** | 결과·같은문제 도전 Kakao SDK 공유 (OG 메타 포함) |
| **PWA** | Android·iOS·Windows 앱 설치 지원 |
| **관리자 패널** | 문제 승인/거절/블라인드, 사용자 관리, 애널리틱스, 금칙어 |

---

## 기술 스택

### Frontend
- **Next.js 15** (App Router, Server Components)
- **TypeScript** strict mode
- **Tailwind CSS**
- **TanStack Query** — 서버 상태 관리

### Backend / DB
- **Supabase** (PostgreSQL) — 데이터베이스 + Realtime Broadcast
- **Prisma ORM v7** — 스키마 관리, 마이그레이션
- **NextAuth.js v5** — Google / 카카오 OAuth

### 인프라
- **Vercel** — 배포, Edge Runtime
- **GitHub Actions** — 매일 08:00 KST 관리자 Daily Digest 메일 발송

### 테스트
- **Vitest** — 순수 함수 단위 테스트 (샘플링·채점·가드 로직)

---

## 로컬 실행

```bash
# 의존성 설치
npm install

# 환경변수 설정 (.env.local)
cp .env.example .env.local   # 파일 없으면 직접 생성

# DB 초기화
npx prisma migrate dev
npm run db:seed

# 개발 서버
npm run dev   # http://localhost:3000
```

### 필수 환경변수

```env
DATABASE_URL=
DIRECT_URL=
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=
AUTH_GOOGLE_ID=
AUTH_GOOGLE_SECRET=
AUTH_KAKAO_ID=
AUTH_KAKAO_SECRET=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_KAKAO_APP_KEY=
OPENAI_API_KEY=
CRON_SECRET=
SMTP_HOST=
SMTP_PORT=
SMTP_USER=
SMTP_PASS=
ADMIN_EMAIL=
```

---

## 검증

```bash
npm run build && npm run test && npm run lint
```
