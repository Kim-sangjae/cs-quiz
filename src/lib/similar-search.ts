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
    if (count > 0 && lower.includes(t.toLowerCase())) {
      boost += 1 / Math.sqrt(count);
    }
  }
  return boost;
}
