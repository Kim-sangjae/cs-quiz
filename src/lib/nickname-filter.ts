import { check } from 'korcen';
import { prisma } from '@/lib/prisma';

// 코드에 고정된 기본 금칙어 (관리자 페이지에서 읽기 전용으로 표시됨)
export const BASE_BLOCKED_WORDS = [
  // 서비스 예약어
  'admin', 'administrator', 'root', 'system', 'mod', 'moderator',
  'csora', '운영자', '관리자', '개발자', '시스템', '공식',
  // 사칭 유도
  'staff', 'official', 'support', 'help',
  // korcen 미탐지 보충
  '씨발', '존나', '존내', 'ㅈㄴ', '미친',
];

function normalize(nickname: string): string {
  return nickname
    .toLowerCase()
    .replace(/[\s\.\-_,!@#$%^&*()+=\[\]{}<>?/\\|~`'"]/g, '');
}

export async function isNicknameAllowed(nickname: string): Promise<{ ok: boolean; reason?: string }> {
  const normalized = normalize(nickname);

  const dbWords = await prisma.blockedWord.findMany({ select: { word: true } });
  const allBlocked = [...BASE_BLOCKED_WORDS, ...dbWords.map((w) => w.word)];

  for (const word of allBlocked) {
    if (normalized.includes(word.toLowerCase())) {
      return { ok: false, reason: 'blocked' };
    }
  }

  if (check(normalized) || check(nickname)) {
    return { ok: false, reason: 'profanity' };
  }

  return { ok: true };
}
