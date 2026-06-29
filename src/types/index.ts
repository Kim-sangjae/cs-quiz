export type Category = 'ds' | 'algo' | 'os' | 'network' | 'db' | 'arch' | 'se';

export interface Question {
  id: string;
  category: Category;
  question: string;
  options: [string, string, string, string];
  answer: 0 | 1 | 2 | 3;
  explanation: string;
  authorNickname?: string | null;
}

export interface UserAnswer {
  questionId: string;
  selected: 0 | 1 | 2 | 3;
}

export interface QuizResult {
  questions: Question[];
  answers: UserAnswer[];
  score: number;
  submittedAt: string;
}
