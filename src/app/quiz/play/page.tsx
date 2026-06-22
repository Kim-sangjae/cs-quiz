import { prisma } from "@/lib/prisma";
import { sample } from "@/lib/sample";
import type { Question, Category } from "@/types";
import QuizPlayClient from "./QuizPlayClient";

export default async function QuizPlayPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; reviewIds?: string }>;
}) {
  const { category, reviewIds } = await searchParams;

  let questions: Question[];

  if (reviewIds) {
    const ids = reviewIds.split(",").filter(Boolean).slice(0, 30);
    const dbQuestions = await prisma.question.findMany({
      where: { id: { in: ids } },
      include: { author: { select: { nickname: true } } },
    });
    const qMap = new Map(dbQuestions.map((q) => [q.id, q]));
    questions = ids
      .map((id) => qMap.get(id))
      .filter((q): q is NonNullable<typeof q> => !!q)
      .map((q) => ({
        id: q.id,
        category: q.category as Category,
        question: q.question,
        options: q.options as [string, string, string, string],
        answer: q.answer as 0 | 1 | 2 | 3,
        explanation: q.explanation,
        authorNickname: q.author?.nickname ?? null,
      }));
  } else {
    const dbQuestions = await prisma.question.findMany({
      where: {
        status: { in: ["OFFICIAL", "APPROVED"] },
        ...(category && category !== "all" ? { category } : {}),
      },
      include: { author: { select: { nickname: true } } },
    });
    questions = dbQuestions.map((q) => ({
      id: q.id,
      category: q.category as Category,
      question: q.question,
      options: q.options as [string, string, string, string],
      answer: q.answer as 0 | 1 | 2 | 3,
      explanation: q.explanation,
      authorNickname: q.author?.nickname ?? null,
    }));
    questions = sample(questions, 30);
  }

  return (
    <QuizPlayClient
      questions={questions}
      category={category ?? "all"}
      isReview={!!reviewIds}
    />
  );
}
