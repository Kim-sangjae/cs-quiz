# Step 2: question-data

## 읽어야 할 파일

먼저 아래 파일들을 읽고 문제 형식과 품질 기준을 파악하라:

- `CLAUDE.md`
- `docs/PRD.md` (문제 데이터 범위 및 품질 기준 섹션)
- `docs/ARCHITECTURE.md` (핵심 타입, 모듈별 상세 명세 섹션)
- `src/types/index.ts` (Question 타입 확인)

## 작업

이 step은 CS 퀴즈 문제 120개를 작성하고 데이터 무결성 테스트를 구현한다.

### 1. `src/data/questions.ts` 생성

```ts
import type { Question } from '@/types';

export const questions: Question[] = [
  // 아래 규칙에 따라 120개 작성
];
```

**카테고리별 요구사항 — 각 20문제**:

| category | 주제 범위 |
|----------|-----------|
| `ds` | 배열, 연결리스트, 스택, 큐, 트리(이진트리/BST/힙), 그래프, 해시테이블 |
| `algo` | 버블/선택/삽입/퀵/병합 정렬, 이진탐색, 시간복잡도(Big-O), BFS/DFS |
| `os` | 프로세스/스레드 차이, 메모리 관리, 가상메모리/페이징, 뮤텍스/세마포어, CPU 스케줄링, 교착상태 |
| `network` | OSI 7계층, TCP/UDP 차이, TCP 3-way handshake, HTTP/HTTPS, DNS, ARP, 서브넷 마스크 |
| `db` | SQL 기본(SELECT/JOIN), 트랜잭션 ACID, 인덱스, 정규화(1NF~3NF), 뷰, 트리거 |
| `arch` | CPU 구성요소, 메모리 계층(레지스터/캐시/RAM), 캐시 교체 정책, 파이프라인, 인터럽트 |

**id 형식**: `"{category}-{세 자리 순번}"`
- 예: `"ds-001"`, `"ds-020"`, `"algo-001"`, `"arch-020"`
- 카테고리 내 순번은 `001`부터 시작
- 전체 120개 id 중복 없음

**문제 품질 기준**:
- 보기 4개 모두 그럴듯해야 한다. 명백히 틀린 보기(예: "위의 모두" 같은 패턴 또는 완전히 무관한 단어)는 금지
- `explanation`은 왜 해당 보기가 정답인지 핵심 개념을 1~3문장으로 설명한다
- 동일 개념을 묻는 거의 동일한 문제를 반복하지 않는다
- 문제 텍스트와 보기는 한국어로 작성한다

**예시 문제 형식**:

```ts
{
  id: 'ds-001',
  category: 'ds',
  question: '스택(Stack)의 특성으로 올바른 것은?',
  options: [
    'FIFO(First In, First Out) 방식으로 동작한다',
    'LIFO(Last In, First Out) 방식으로 동작한다',
    '임의 접근(Random Access)이 가능하다',
    '양쪽 끝에서 삽입과 삭제가 가능하다',
  ],
  answer: 1,
  explanation: '스택은 LIFO 방식으로, 가장 마지막에 삽입된 요소가 가장 먼저 제거된다. FIFO는 큐(Queue)의 특성이며, 양쪽 끝 삽입/삭제는 덱(Deque)의 특성이다.',
},
```

### 2. `src/data/questions.test.ts` 생성

아래 불변조건을 모두 테스트하라:

```ts
import { questions } from '@/data/questions';

// 검증 항목:
// 1. questions.length >= 120
// 2. 카테고리별 count >= 20 (ds, algo, os, network, db, arch 각각)
// 3. id 중복 없음 (Set 크기 == questions.length)
// 4. 모든 answer가 0, 1, 2, 3 중 하나
// 5. 모든 options 배열 길이 == 4
// 6. 모든 explanation이 빈 문자열이 아님 (length > 0)
// 7. 모든 question 텍스트가 빈 문자열이 아님 (length > 0)
// 8. id 형식이 /^(ds|algo|os|network|db|arch)-\d{3}$/ 패턴
```

## Acceptance Criteria

```bash
npm test -- src/data/questions.test.ts   # 무결성 테스트 전부 통과
npm run build                             # 타입 에러 없음
```

## 검증 절차

1. `npm test -- src/data/questions.test.ts` 실행 — 모든 케이스 통과 확인
2. `npm run build` 실행 — TypeScript 타입 에러 없음 확인
3. 결과에 따라 `phases/0-mvp/index.json`의 step 2 status 업데이트:
   - 성공 → `"status": "completed"`, `"summary": "questions.ts — 6개 카테고리 × 20문제 = 120개 작성. 무결성 테스트 8개 통과."`
   - 실패 → `"status": "error"`, `"error_message": "구체적 에러 (어느 카테고리가 부족한지, 어떤 테스트가 실패했는지 포함)"`

## 금지사항

- `default export`를 사용하지 마라. 이유: `docs/ARCHITECTURE.md`에서 named export만 사용하도록 명시했다.
- `answer` 필드에 0~3 범위 밖의 값을 사용하지 마라. 이유: `Question` 타입이 `0 | 1 | 2 | 3`으로 제한된다.
- `category` 필드에 `Category` 타입 외의 문자열을 사용하지 마라 (`'ds' | 'algo' | 'os' | 'network' | 'db' | 'arch'`).
- 보기가 4개 미만인 문제를 만들지 마라. 이유: `Question.options` 타입이 4-tuple이다.
- 기존 테스트를 깨뜨리지 마라.
