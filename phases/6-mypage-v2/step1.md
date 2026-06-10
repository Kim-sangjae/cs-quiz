# Step 1: settings

## 읽어야 할 파일

먼저 아래 파일들을 읽고 설정 명세를 파악하라:

- `CLAUDE.md`
- `docs/PRD.md` → *v2 기능 명세* → *11. 계정 설정* 섹션
- `docs/UI_GUIDE.md`
- `src/app/api/users/nickname/route.ts` (1-infra-2에서 생성)
- `src/lib/auth.ts`

## 작업

이 step은 계정 설정 페이지(닉네임 변경, 로그아웃)를 구현한다.

### 1. `src/app/api/users/nickname/route.ts` 업데이트

기존 POST(신규 설정)에 PATCH(변경) 핸들러 추가:

```ts
// PATCH: 닉네임 변경
// - 로그인 필수 (401)
// - 동일한 유효성 검사 (2~12자, 영문/숫자/한글)
// - 현재 닉네임과 동일한 값으로 변경 시도 시 400
// - 중복 시 409
// - DB 업데이트 후 세션 갱신 (NextAuth update() 호출)
// - 응답: { nickname: string }
```

### 2. `src/app/settings/page.tsx` 생성 (Client Component)

구성:
- **닉네임 변경 폼**:
  - 현재 닉네임 표시 (입력 기본값)
  - 변경 입력 + 유효성 안내
  - 저장 버튼 (변경 없으면 비활성화)
  - PATCH `/api/users/nickname` 호출
  - 성공 → "닉네임이 변경되었습니다" 인라인 메시지
  - 409 → "이미 사용 중인 닉네임입니다" 에러 메시지
- **로그아웃** 섹션:
  - 로그아웃 버튼 → `signOut({ callbackUrl: '/' })`
  - 경고 문구: "로그아웃하면 현재 기기에서 로그인 상태가 해제됩니다"
- 페이지 상단: ← 마이페이지 링크

## Acceptance Criteria

```bash
npm run build   # 컴파일 에러 없음
```

## 검증 절차

1. `src/app/settings/page.tsx` 존재 확인
2. `src/app/api/users/nickname/route.ts`에 PATCH 핸들러 추가 확인
3. `npm run build` 통과 확인
4. 결과에 따라 `phases/6-mypage-v2/index.json`의 step 1 status 업데이트:
   - 성공 → `"status": "completed"`, `"summary": "계정 설정 페이지(/settings) 구현 완료. 닉네임 변경 PATCH API 추가. 로그아웃 기능 포함."`
   - 실패 → `"status": "error"`, `"error_message": "구체적 에러 내용"`

## 금지사항

- `signOut()` 호출 시 `callbackUrl`을 생략하지 마라. 이유: 생략하면 현재 URL(로그인 필요 페이지)로 리다이렉트되어 즉시 로그인 화면으로 튕긴다.
- 닉네임 변경 후 세션 갱신 없이 UI에 이전 닉네임이 남아 있지 않도록 하라. 이유: NextAuth `update()` 또는 페이지 리로드로 세션을 최신화해야 Header의 닉네임이 즉시 반영된다.
- UI_GUIDE.md 안티패턴 (blur, gradient-text, 보라색 등)을 사용하지 마라.
- 기존 테스트를 깨뜨리지 마라.
