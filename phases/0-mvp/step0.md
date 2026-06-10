# Step 0: project-setup

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 기술 스택과 설계 의도를 파악하라:

- `CLAUDE.md`
- `docs/ARCHITECTURE.md`
- `docs/ADR.md`

## 작업

이 step은 CS Quiz Next.js 프로젝트를 초기화하고 Vitest 테스트 환경을 설정한다.

### 1. Next.js 프로젝트 초기화

프로젝트 루트에서 아래 명령어를 실행하라:

```bash
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --no-git
```

- `--typescript`: TypeScript strict mode
- `--tailwind`: Tailwind CSS 포함
- `--eslint`: ESLint 포함
- `--app`: App Router 사용
- `--src-dir`: `src/` 하위 구조
- `--import-alias "@/*"`: `@/` alias 설정
- `--no-git`: 이미 git repo가 존재하므로 git 초기화 생략

create-next-app이 이미 존재하는 파일(CLAUDE.md, docs/, phases/, scripts/)을 덮어쓰겠냐고 묻는다면 **No**를 선택하라.

### 2. Vitest 설치

```bash
npm install -D vitest
```

### 3. `vitest.config.ts` 생성

프로젝트 루트에 생성하라:

```ts
import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
```

### 4. `package.json` 스크립트 수정

`scripts` 섹션의 `"test"` 항목을 아래로 교체하라 (기존 스크립트 유지):

```json
"test": "vitest run"
```

### 5. 디렉토리 구조 생성

아래 디렉토리가 없으면 각각 `.gitkeep` 파일을 추가해 생성하라:

```
src/components/
src/data/
src/lib/
src/types/
src/app/quiz/
src/app/result/
```

### 6. `tsconfig.json` 확인

`compilerOptions`에 `"strict": true`가 있는지 확인하라. 없으면 추가하라.

## Acceptance Criteria

```bash
npm run build   # 컴파일 에러 없음
npm test        # exit 0 (테스트 파일이 없어도 통과)
```

## 검증 절차

1. `npm run build` 실행 — 에러 없이 완료되는지 확인
2. `npm test` 실행 — exit 0 확인
3. `src/` 하위 6개 디렉토리가 모두 존재하는지 확인
4. `vitest.config.ts`가 루트에 있는지 확인
5. 결과에 따라 `phases/0-mvp/index.json`의 step 0 status 업데이트:
   - 성공 → `"status": "completed"`, `"summary": "Next.js 15 + Tailwind + Vitest 초기화 완료. src/ 디렉토리 구조 생성."`
   - 실패 → `"status": "error"`, `"error_message": "구체적 에러 내용"`

## 금지사항

- `pages/` 디렉토리를 만들지 마라. 이유: ADR-001에서 App Router를 선택했다. Pages Router와 혼용하면 충돌한다.
- `--no-git` 없이 create-next-app을 실행하지 마라. 이유: 이미 git repo가 존재하며 중첩 초기화는 충돌을 일으킨다.
- `CLAUDE.md`, `docs/`, `phases/`, `scripts/` 를 덮어쓰지 마라. 이유: 프로젝트 설계 문서와 harness 파일이 손실된다.
- `jest`를 설치하지 마라. 이유: ADR-005에서 Vitest를 선택했다.
- 기존 테스트를 깨뜨리지 마라.
