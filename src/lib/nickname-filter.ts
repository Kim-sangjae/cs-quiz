import { check } from 'korcen';

const BLOCKED_WORDS = [
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

export function isNicknameAllowed(nickname: string): { ok: boolean; reason?: string } {
  const normalized = normalize(nickname);

  for (const word of BLOCKED_WORDS) {
    if (normalized.includes(word.toLowerCase())) {
      return { ok: false, reason: 'blocked' };
    }
  }

  if (check(normalized) || check(nickname)) {
    return { ok: false, reason: 'profanity' };
  }

  return { ok: true };
}
