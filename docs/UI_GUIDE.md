# UI 디자인 가이드

## 디자인 원칙
1. **도구처럼 보여야 한다** — 시험지 느낌. 마케팅 페이지가 아니라 매일 쓰는 학습 도구.
2. **집중을 방해하지 않는다** — 문제 텍스트와 보기가 시각 계층의 전부. 장식 요소 최소화.
3. **진행 상태를 항상 명확하게** — 현재 문제 번호, 선택 완료 여부, 미선택 문제 수를 언제나 알 수 있어야 한다.

## AI 슬롭 안티패턴 — 하지 마라
| 금지 사항 | 이유 |
|-----------|------|
| `backdrop-filter: blur()` | glass morphism은 AI 템플릿의 가장 흔한 징후 |
| gradient-text | AI SaaS 랜딩의 1번 특징 |
| box-shadow 글로우 애니메이션 | 네온 글로우 = AI 슬롭 |
| 보라/인디고 브랜드 색상 | "AI = 보라색" 클리셰 |
| 모든 카드에 동일한 `rounded-2xl` | 균일한 둥근 모서리는 템플릿 느낌 |
| 배경 gradient orb (`blur-3xl` 원형) | 모든 AI 랜딩 페이지에 있는 장식 |

---

## 색상

### 배경
| 용도 | 값 |
|------|------|
| 페이지 | `#0a0a0a` |
| 카드/패널 | `#111111` |
| 호버/활성 영역 | `#1a1a1a` |
| 테두리 | `#262626` (neutral-800) |

### 텍스트
| 용도 | 값 |
|------|------|
| 주 텍스트 (문제) | `text-white` |
| 보기 텍스트 | `text-neutral-200` |
| 보조 레이블 | `text-neutral-400` |
| 비활성 / 힌트 | `text-neutral-500` |

### 시맨틱 색상
| 용도 | 값 | Tailwind 클래스 |
|------|-----|----------------|
| 정답 | `#22c55e` | `text-green-500`, `border-green-500`, `bg-green-500/10` |
| 오답 | `#ef4444` | `text-red-500`, `border-red-500`, `bg-red-500/10` |
| 선택됨 (진행 중) | `#3b82f6` | `text-blue-400`, `border-blue-500`, `bg-blue-500/10` |
| 미선택 | `#262626` | `border-neutral-800`, `bg-[#1a1a1a]` |

---

## 컴포넌트 스타일

### 문제 카드 래퍼
```
bg-[#111111] border border-neutral-800 rounded-lg p-6
```

### 카테고리 배지
```
inline-block text-xs text-neutral-500 border border-neutral-800 rounded px-2 py-0.5 mb-4
```

### 보기 버튼 — 4가지 상태

**미선택 (기본)**
```
w-full text-left rounded-md border border-neutral-800 bg-[#1a1a1a]
px-4 py-3 text-sm text-neutral-200
hover:border-neutral-600 hover:bg-[#222222]
transition-colors cursor-pointer
```

**선택됨 (진행 중)**
```
border-blue-500 bg-blue-500/10 text-white
```

**정답 (결과 화면)**
```
border-green-500 bg-green-500/10 text-green-400 cursor-default
```

**내가 선택한 오답 (결과 화면)**
```
border-red-500 bg-red-500/10 text-red-400 cursor-default
```

**결과 화면의 미선택 오답 보기 (정답도 아니고 선택도 안 한 보기)**
```
border-neutral-800 bg-[#1a1a1a] text-neutral-600 cursor-default opacity-50
```

### Primary 버튼 (제출, 시작)
```
rounded-md bg-white text-black text-sm font-medium px-6 py-2.5
hover:bg-neutral-200
disabled:opacity-40 disabled:cursor-not-allowed
transition-colors
```

### Secondary 버튼 (다시 풀기, 홈으로)
```
rounded-md border border-neutral-700 text-sm text-neutral-300 px-5 py-2.5
hover:border-neutral-500 hover:text-white
transition-colors
```

### 이전/다음 네비게이션 버튼
```
rounded-md border border-neutral-800 text-sm text-neutral-400 px-4 py-2
hover:border-neutral-600 hover:text-white
disabled:opacity-30 disabled:cursor-not-allowed
transition-colors
```

### 문제 번호 네비게이터 버튼
```
w-8 h-8 rounded text-xs font-medium transition-colors

미선택:  bg-neutral-900 text-neutral-500 hover:bg-neutral-800
선택됨:  bg-neutral-700 text-white
현재:    bg-white text-black
```

### 진행률 바
```
배경: w-full bg-neutral-800 rounded-full h-1
채움: bg-white rounded-full h-1 transition-all duration-200
```

---

## 상태별 UI 정의

### 로딩 상태 (결과 페이지 마운트 전)
- sessionStorage 읽기는 동기이므로 로딩 스피너 불필요
- 단, `result` state가 null인 동안 빈 화면 깜빡임 방지를 위해 `null` 체크 후 `return null` 처리

### 오류/리다이렉트 상태
- sessionStorage 데이터 없음 → `router.replace('/')` — 에러 메시지 UI 없음, 홈으로 조용히 이동
- 이 상태에서 UI를 렌더링하지 않으므로 에러 페이지 디자인 불필요

### 미선택 문제 존재 시 제출 버튼 영역
```
[제출] 버튼 위에 작은 텍스트:
"N문제 미선택" — text-xs text-neutral-500
N === 0이 되면 텍스트 사라짐, 버튼 활성화
```

### 모두 맞혔을 때 결과 화면
```
오답 목록 대신:
"모든 문제를 맞혔습니다! 🎉"
text-green-400 text-center text-base font-medium py-8
```
(이 예외적 케이스에서만 이모지 허용)

### 점수에 따른 색상 및 평가 메시지

| 범위 | 점수 색상 | 메시지 | 메시지 색상 |
|------|----------|--------|------------|
| 27~30 (90%+) | `text-green-400` | "우수 — CS 기초가 탄탄합니다" | `text-green-400` |
| 21~26 (70%+) | `text-yellow-400` | "양호 — 취약 부분을 확인하세요" | `text-yellow-400` |
| 0~20 (70% 미만) | `text-red-400` | "분발 — 오답 해설을 꼼꼼히 읽어보세요" | `text-red-400` |

점수 숫자 표시: `{score} / 30` — 점수 숫자에만 위 색상 적용, "/ 30"은 `text-neutral-500`

### 오답 카드 내부 구조

```
┌─────────────────────────────────────┐
│ [카테고리 배지]  Q.12               │  ← 문제번호 text-neutral-500 text-sm
│                                     │
│ 질문 텍스트                         │  ← text-white font-medium
│                                     │
│ A  보기 텍스트 (미선택)             │  ← opacity-40
│ B  보기 텍스트 (내 오답) ✗          │  ← 빨간 테두리 + bg
│ C  보기 텍스트 (정답)    ✓          │  ← 초록 테두리 + bg
│ D  보기 텍스트 (미선택)             │  ← opacity-40
│                                     │
│ 해설: ——————————————                │  ← border-t border-neutral-800 mt-4 pt-4
│ 해설 텍스트                         │  ← text-sm text-neutral-300
└─────────────────────────────────────┘
```

정답 == 내 오답인 경우는 논리적으로 불가능하므로 별도 처리 불필요.

---

## 레이아웃

- 전체 너비: `max-w-2xl mx-auto` (문제 카드, 네비게이터 모두 동일)
- 패딩: `px-4 py-8` (모바일 기본), `sm:px-6`
- 카드 내부 간격: `space-y-3` (보기 버튼 간), `mb-6` (질문과 보기 사이)
- 페이지 하단 고정 영역: 이전/다음 버튼 + 제출 버튼 (`sticky bottom-0 bg-[#0a0a0a] border-t border-neutral-800 py-4`)

---

## 타이포그래피

| 용도 | 스타일 |
|------|--------|
| 페이지 타이틀 | `text-2xl font-semibold text-white` |
| 문제 텍스트 | `text-base font-medium text-white leading-relaxed` |
| 보기 텍스트 | `text-sm text-neutral-200` |
| 보기 레이블 (A/B/C/D) | `text-xs font-mono text-neutral-500 mr-3 flex-shrink-0` |
| 카테고리 배지 | `text-xs text-neutral-500` |
| 진행률 레이블 | `text-sm text-neutral-400` |
| 해설 텍스트 | `text-sm text-neutral-300 leading-relaxed` |
| 점수 표시 | `text-4xl font-bold text-white` |

---

## 반응형

### 네비게이터 (30개 번호 버튼)
- 모바일: `grid grid-cols-10 gap-1` → 3행 × 10열
- 태블릿+: `grid grid-cols-15 gap-1` → 2행 × 15열
- 각 버튼은 `w-8 h-8` 고정 — 줄 바꿈 허용

### 보기 버튼
- `w-full` 유지 — 모바일/데스크탑 동일

### 하단 컨트롤 영역 (이전/다음/제출)
- 화면 하단 sticky 고정
- 모바일: 이전 버튼 왼쪽, 다음/제출 버튼 오른쪽 (`flex justify-between`)
- 미선택 카운트 텍스트는 제출 버튼 바로 위 (`flex flex-col items-end gap-1`)

### 결과 화면 요약 영역
- 점수 + 정답/오답 수: 모바일에서 세로 stack (`flex flex-col items-center`)
- 오답 카드 목록: `space-y-4`, 카드는 `w-full`

---

## 애니메이션
- 문제 전환: `transition-opacity duration-150` (fade — Navigator 점프 포함)
- 보기 선택 색상 전환: `transition-colors duration-100`
- 진행률 바 채움: `transition-all duration-200`
- 그 외 모든 애니메이션 금지

---

## 아이콘
- SVG 인라인, `strokeWidth={1.5}`, `width={16} height={16}` 기본
- 아이콘 컨테이너(둥근 배경 박스)로 감싸지 않는다
- 사용 위치: 이전(←) / 다음(→) 버튼, 정답(✓) / 오답(✗) 마커
