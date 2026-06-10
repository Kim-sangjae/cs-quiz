# Step 0: board-api

## 읽어야 할 파일

먼저 아래 파일들을 읽고 게시판 명세를 파악하라:

- `CLAUDE.md`
- `docs/PRD.md` → *v2 기능 명세* → *6. 게시판* 섹션
- `docs/ADR.md` → ADR-017 (ILIKE 검색), ADR-019 (역정규화)
- `docs/ARCHITECTURE.md` → *v2 디렉토리 구조* 섹션
- `src/lib/prisma.ts`
- `src/lib/auth.ts`
- `prisma/schema.prisma` (Question, Like, Report 모델 확인)

## 작업

이 step은 게시판의 핵심 API 라우트를 구현한다.

### 1. `src/app/api/questions/route.ts` 생성

**GET**: 게시판 목록 조회

쿼리 파라미터:
- `q`: 키워드 (비어 있으면 전체)
- `cat`: 카테고리 (`all` 또는 `'ds'|'algo'|'os'|'network'|'db'|'arch'`)
- `status`: `'all'|'pending'|'approved'` (기본값: `all`)
- `sort`: `'newest'|'accuracy_asc'|'accuracy_desc'|'likes'` (기본값: `newest`)
- `page`: 숫자 (1-based, 기본값: 1)

처리 규칙:
- `BLINDED` 문제는 ADMIN이 아닌 경우 항상 제외
- `OFFICIAL` 문제는 게시판에서 제외 (커뮤니티 등록 문제만 표시)
- `status=all`일 때 PENDING + APPROVED 표시
- 키워드 검색: `question` 필드에 PostgreSQL ILIKE 적용
  ```ts
  where: { question: { contains: q, mode: 'insensitive' } }
  ```
- 정렬:
  - `newest`: `createdAt DESC`
  - `accuracy_asc`: `correctCount/attemptCount ASC` (attemptCount=0은 마지막)
  - `accuracy_desc`: `correctCount/attemptCount DESC`
  - `likes`: `Like` count DESC (관계형 집계 또는 좋아요 수 컬럼 추가)
- 페이지네이션: 20개/페이지, `skip: (page-1)*20`, `take: 20`
- 응답:
  ```ts
  {
    questions: (Question & { author: { nickname } | null, _count: { likes } })[],
    totalCount: number,
    pageCount: number
  }
  ```

**POST**: 문제 등록

- 로그인 + 닉네임 설정 필수 (401/403)
- Body: `{ category, question, options: string[4], answer: 0|1|2|3, explanation }`
- 유효성: 카테고리 유효성, 문자열 길이 체크 (question ≤ 500자, options 각 ≤ 200자, explanation ≤ 500자)
- 저장: `status: PENDING`, `authorId: session.user.id`
- 응답: 생성된 Question 객체

### 2. `src/app/api/questions/[id]/route.ts` 생성

**GET**: 문제 상세 조회

- 로그인 불필요
- Question include: author(nickname), _count(likes)
- BLINDED + ADMIN이 아닌 경우 → 404 반환
- 로그인 사용자의 경우 해당 문제 좋아요 여부, 신고 여부도 포함

## Acceptance Criteria

```bash
npm run build   # 컴파일 에러 없음
```

## 검증 절차

1. `src/app/api/questions/route.ts` 존재 확인
2. `src/app/api/questions/[id]/route.ts` 존재 확인
3. GET 핸들러에 ILIKE 검색 (`mode: 'insensitive'`) 포함 확인
4. GET 핸들러에 OFFICIAL 제외 조건 포함 확인
5. BLINDED 문제 필터링 로직 포함 확인
6. `npm run build` 통과 확인
7. 결과에 따라 `phases/3-board/index.json`의 step 0 status 업데이트:
   - 성공 → `"status": "completed"`, `"summary": "게시판 목록(GET+검색+필터+정렬+페이징) 및 문제 상세 API 구현 완료. ILIKE 키워드 검색 적용."`
   - 실패 → `"status": "error"`, `"error_message": "구체적 에러 내용"`

## 금지사항

- GET 목록 응답에 `answer` 필드를 포함하지 마라. 이유: 정답 노출 방지 원칙. 상세 페이지(`/board/[id]`)에서는 포함 가능 (문제를 직접 풀지 않으므로).
- `OFFICIAL` 문제를 게시판에 노출하지 마라. 이유: 게시판은 커뮤니티 등록 문제 전용. 공식 문제는 퀴즈에서만 출제된다.
- 기존 테스트를 깨뜨리지 마라.
