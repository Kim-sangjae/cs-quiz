// 유사문제 검색용 순수 함수 (토큰 추출 + 희귀도 가중치 계산)

// 흔한 한국어 조사 제거 (긴 것부터 매칭 — 완벽한 형태소 분석은 아니지만,
// 남는 조각의 코퍼스 빈도가 자연히 낮은 가중치를 받으므로 실용적으로 충분함)
const PARTICLES = [
  '에서는', '으로는', '에게는', '이라는', '입니까', '에서', '에게', '으로', '이란', '란',
  '는가', '은가', '는', '은', '이', '가', '을', '를', '의', '와', '과', '도', '만', '로', '에',
];

function stripParticle(token: string): string {
  for (const p of PARTICLES) {
    if (token.length > p.length + 1 && token.endsWith(p)) {
      return token.slice(0, -p.length);
    }
  }
  return token;
}

export function extractSearchTokens(query: string): string[] {
  const tokens = query
    .replace(/[?!.,()'"]/g, ' ')
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2)
    .map(stripParticle)
    .filter((t) => t.length >= 2);
  return [...new Set(tokens)];
}

// CS 용어 한/영 동의어 사전 - 임베딩·트라이그램만으로는 "트리거"와 "trigger"처럼
// 문자 집합이 아예 다른 표기를 같은 개념으로 잡아내지 못해서 별도로 정규화한다
const SYNONYM_GROUPS: string[][] = [
  ['트리거', 'trigger'],
  ['트랜잭션', 'transaction'],
  ['인덱스', 'index'],
  ['정규화', 'normalization'],
  ['조인', 'join'],
  ['외래키', 'foreign key', 'fk'],
  ['기본키', 'primary key', 'pk'],
  ['스키마', 'schema'],
  ['서브쿼리', 'subquery'],
  ['프로시저', 'stored procedure'],
  ['잠금', 'lock'],
  ['데드락', '교착상태', 'deadlock'],
  ['캐시', 'cache'],
  ['버퍼', 'buffer'],
  ['프로세스', 'process'],
  ['스레드', '쓰레드', 'thread'],
  ['세마포어', 'semaphore'],
  ['뮤텍스', 'mutex'],
  ['스케줄링', 'scheduling'],
  ['페이징', 'paging'],
  ['세그멘테이션', '세그먼테이션', 'segmentation'],
  ['가상메모리', 'virtual memory'],
  ['인터럽트', 'interrupt'],
  ['컨텍스트스위칭', 'context switching'],
  ['커널', 'kernel'],
  ['라우팅', 'routing'],
  ['소켓', 'socket'],
  ['패킷', 'packet'],
  ['방화벽', 'firewall'],
  ['프로토콜', 'protocol'],
  ['서브넷', 'subnet'],
  ['로드밸런싱', 'load balancing'],
  ['해시', 'hash'],
  ['스택', 'stack'],
  ['큐', 'queue'],
  ['그래프', 'graph'],
  ['재귀', 'recursion'],
  ['동적계획법', 'dynamic programming'],
  ['그리디', '탐욕법', 'greedy'],
  ['백트래킹', 'backtracking'],
  ['이진탐색', 'binary search'],
  ['파이프라이닝', 'pipelining'],
  ['레지스터', 'register'],
  ['캡슐화', 'encapsulation'],
  ['상속', 'inheritance'],
  ['다형성', 'polymorphism'],
  ['추상화', 'abstraction'],
  ['디자인패턴', 'design pattern'],
  ['리팩토링', 'refactoring'],
  ['동시성', '병행성', 'concurrency'],
];

function normalizeKey(token: string): string {
  return /^[a-zA-Z0-9 ]+$/.test(token) ? token.toLowerCase() : token;
}

const SYNONYM_LOOKUP = new Map<string, string[]>();
for (const group of SYNONYM_GROUPS) {
  for (const term of group) {
    SYNONYM_LOOKUP.set(normalizeKey(term), group);
  }
}

// 토큰과 같은 개념으로 등록된 다른 표기(한글↔영어 등)를 함께 반환한다
export function getSynonyms(token: string): string[] {
  return SYNONYM_LOOKUP.get(normalizeKey(token)) ?? [token];
}

// 토큰이 코퍼스에서 드물수록(= 변별력이 높을수록) 큰 가중치를 부여
export function rareTokenBoost(
  candidateText: string,
  tokens: string[],
  corpusCounts: Record<string, number>
): number {
  let boost = 0;
  const lower = candidateText.toLowerCase();
  for (const t of tokens) {
    const count = corpusCounts[t] ?? 0;
    if (count === 0) continue;
    const matched = getSynonyms(t).some((s) => lower.includes(s.toLowerCase()));
    if (matched) {
      boost += 1 / Math.sqrt(count);
    }
  }
  return boost;
}
