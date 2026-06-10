import type { Question, UserAnswer, QuizResult } from '@/types';

export function grade(questions: Question[], answers: UserAnswer[]): QuizResult {
  let score = 0;

  for (const question of questions) {
    const userAnswer = answers.find(a => a.questionId === question.id);
    if (userAnswer && userAnswer.selected === question.answer) {
      score++;
    }
  }

  return {
    questions,
    answers,
    score,
    submittedAt: new Date().toISOString(),
  };
}
