import { prisma } from "@/lib/prisma";
import { sample } from "@/lib/sample";
import type { Question, Category } from "@/types";
import QuizPlayClient from "./QuizPlayClient";

export default async function QuizPlayPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const { category } = await searchParams;

  const dbQuestions = await prisma.question.findMany({
    where: {
      status: { in: ["OFFICIAL", "APPROVED"] },
      ...(category && category !== "all" ? { category } : {}),
    },
  });

  const questions: Question[] = dbQuestions.map((q) => ({
    id: q.id,
    category: q.category as Category,
    question: q.question,
    options: q.options as [string, string, string, string],
    answer: q.answer as 0 | 1 | 2 | 3,
    explanation: q.explanation,
  }));

  const sampled = sample(questions, 30);

  return <QuizPlayClient questions={sampled} category={category ?? "all"} />;
}
