'use client';

import { useState } from 'react';
import QuestionCard from './QuestionCard';
import QuestionDrawer from '../QuestionDrawer';

interface BoardQuestion {
  id: string;
  category: string;
  question: string;
  status: string;
  attemptCount: number;
  correctCount: number;
  createdAt: Date | string;
  author: { nickname: string | null } | null;
  likeCount: number;
}

type MyAttempts = Record<string, { count: number; lastCorrect: boolean }>;

export default function BoardListClient({
  questions,
  myAttempts = {},
}: {
  questions: BoardQuestion[];
  myAttempts?: MyAttempts;
}) {
  const [drawerQuestionId, setDrawerQuestionId] = useState<string | null>(null);

  return (
    <>
      <div className="space-y-3 mb-8">
        {questions.map((q) => (
          <QuestionCard
            key={q.id}
            {...q}
            myAttempt={myAttempts[q.id] ?? null}
            onClick={() => setDrawerQuestionId(q.id)}
          />
        ))}
      </div>
      <QuestionDrawer
        open={drawerQuestionId !== null}
        questionId={drawerQuestionId}
        onClose={() => setDrawerQuestionId(null)}
      />
    </>
  );
}
