import { PROFANITY_WORDS } from './nickname-filter';

export function maskProfanity(text: string, extraWords: string[] = []): string {
  let result = text;
  for (const word of [...PROFANITY_WORDS, ...extraWords]) {
    if (!word) continue;
    const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    result = result.replace(new RegExp(escaped, 'gi'), '*'.repeat(word.length));
  }
  return result;
}
