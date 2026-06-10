# Step 3: board-submit

## 읽어야 할 파일

먼저 아래 파일들을 읽고 문제 등록 명세를 파악하라:

- `CLAUDE.md`
- `docs/PRD.md` → *v2 기능 명세* → *6. 게시판 문제 등록* 섹션
- `docs/UI_GUIDE.md` → 색상 팔레트, 안티패턴
- `src/app/api/questions/route.ts` (step 0에서 생성, POST 핸들러 확인)
- `src/lib/auth.ts`

## 작업

이 step은 문제 등록 폼 페이지를 구현한다.

### 1. `src/app/board/submit/page.tsx` 생성 (Client Component)

폼 필드:
- **카테고리** — `<select>`: 자료구조 / 알고리즘 / OS / 네트워크 / DB / 컴퓨터구조
- **문제** — `<textarea>`, 최대 500자, 글자 수 카운터 표시
- **보기 A~D** — 각 `<input>`, 최대 200자
- **정답** — 라디오 버튼 (A / B / C / D)
- **해설** — `<textarea>`, 최대 500자, 글자 수 카운터 표시

제출 버튼:
- 모든 필드 입력 완료 시만 활성화
- 제출 → POST `/api/questions`
- 성공 → `/board`로 이동
- 실패 → 에러 메시지 인라인 표시 (toast 대신)

접근 제어:
- 페이지 진입 시 `useSession()`으로 로그인 여부 확인
- 비로그인이면 로그인 유도 메시지 + 로그인 버튼 표시 (redirect하지 않고 페이지 내 안내)
  - 미들웨어에서 이미 redirect 처리되므로 클라이언트 단에서 추가 처리 최소화

## Acceptance Criteria

```bash
npm run build   # 컴파일 에러 없음
```

## 검증 절차

1. `src/app/board/submit/page.tsx` 존재 확인
2. 폼 필드 5개 (카테고리, 문제, 보기4개, 정답, 해설) 모두 구현 확인
3. `npm run build` 통과 확인
4. 결과에 따라 `phases/3-board/index.json`의 step 3 status 업데이트:
   - 성공 → `"status": "completed"`, `"summary": "게시판 문제 등록 폼 (/board/submit) 구현 완료. 카테고리·문제·보기·정답·해설 필드, 글자 수 카운터, 제출 → /board 이동."`
   - 실패 → `"status": "error"`, `"error_message": "구체적 에러 내용"`

## 금지사항

- 제출 폼에서 `answer` 필드를 보기 텍스트와 함께 화면에 표시하지 마라. 이유: 이 폼은 문제 작성 화면이므로 `answer`는 인덱스(0~3)로 저장. 사용자에게는 A/B/C/D 라디오로 표시하고 내부적으로 숫자 변환.
- UI_GUIDE.md 안티패턴 (blur, gradient-text, 보라색 등)을 사용하지 마라.
- 기존 테스트를 깨뜨리지 마라.
