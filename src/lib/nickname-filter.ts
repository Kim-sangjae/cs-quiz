import { check, foreign } from '@/lib/korcen-check';
import { prisma } from '@/lib/prisma';
import { PROFANITY_WORDS } from '@/lib/profanity-words';

export { PROFANITY_WORDS };

// 일반 유저만 차단 (사칭 방지 예약어) — 관리자는 허용
const RESERVED_WORDS = [
  'admin', 'administrator', 'root', 'system', 'mod', 'moderator',
  'csora', '운영자', '관리자', '개발자', '시스템', '공식',
  'staff', 'official', 'support', 'help',
];

export const BASE_BLOCKED_WORDS = [...RESERVED_WORDS, ...PROFANITY_WORDS];

function normalize(nickname: string): string {
  return nickname
    .toLowerCase()
    .replace(/[\s\.\-_,!@#$%^&*()+=\[\]{}<>?/\\|~`'"]/g, '');
}

export async function isNicknameAllowed(nickname: string, isAdmin = false): Promise<{ ok: boolean; reason?: string }> {
  const normalized = normalize(nickname);

  const dbWords = await prisma.blockedWord.findMany({ select: { word: true } });

  // 관리자는 예약어 제외, 욕설 + DB 금칙어만 체크
  const wordList = isAdmin
    ? [...PROFANITY_WORDS, ...dbWords.map((w) => w.word)]
    : [...BASE_BLOCKED_WORDS, ...dbWords.map((w) => w.word)];

  for (const word of wordList) {
    if (normalized.includes(word.toLowerCase())) {
      return { ok: false, reason: 'blocked' };
    }
  }

  if (check(normalized) || check(nickname) || foreign(nickname)) {
    return { ok: false, reason: 'profanity' };
  }

  return { ok: true };
}
