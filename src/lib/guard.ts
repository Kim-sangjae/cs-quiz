import type { QuizResult } from '@/types';

export function isQuizResult(data: unknown): data is QuizResult {
  if (typeof data !== 'object' || data === null) return false;
  if (!('questions' in data) || !Array.isArray((data as Record<string, unknown>).questions) || (data as Record<string, unknown[]>).questions.length === 0) return false;
  if (!('answers' in data) || !Array.isArray((data as Record<string, unknown>).answers)) return false;
  if (!('score' in data) || typeof (data as Record<string, unknown>).score !== 'number' || (data as Record<string, number>).score < 0) return false;
  if (!('submittedAt' in data) || typeof (data as Record<string, unknown>).submittedAt !== 'string' || (data as Record<string, string>).submittedAt.length === 0) return false;
  return true;
}
