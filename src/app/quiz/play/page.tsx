import { prisma } from "@/lib/prisma";
import { getServerUser } from "@/lib/auth";
import { sample } from "@/lib/sample";
import { QuestionStatus } from "@prisma/client";
import type { Question, Category } from "@/types";
import QuizPlayClient from "./QuizPlayClient";

export default async function QuizPlayPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; reviewIds?: string; timed?: string }>;
}) {
  const { category, reviewIds, timed } = await searchParams;

  const user = await getServerUser();
  let questions: Question[];

  if (reviewIds) {
    const ids = reviewIds.split(",").filter(Boolean).slice(0, 20);
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
    const where = {
      status: { in: [QuestionStatus.OFFICIAL, QuestionStatus.APPROVED] },
      ...(category && category !== "all" ? { category } : {}),
    };

    const dbQuestions = await prisma.question.findMany({
      where,
      include: { author: { select: { nickname: true } } },
    });

    const allQuestions: Question[] = dbQuestions.map((q) => ({
      id: q.id,
      category: q.category as Category,
      question: q.question,
      options: q.options as [string, string, string, string],
      answer: q.answer as 0 | 1 | 2 | 3,
      explanation: q.explanation,
      authorNickname: q.author?.nickname ?? null,
    }));

    // 최근 3세션 문제 제외 (로그인 시)
    if (user) {
      const recentSessions = await prisma.quizSession.findMany({
        where: { userId: user.id, ...(category && category !== "all" ? { category } : {}) },
        orderBy: { submittedAt: "desc" },
        take: 3,
        select: { questionIds: true },
      });
      const recentIds = new Set(
        recentSessions.flatMap((s) => s.questionIds as string[])
      );
      const freshPool = allQuestions.filter((q) => !recentIds.has(q.id));
      questions = sample(freshPool.length >= 20 ? freshPool : allQuestions, 20);
    } else {
      questions = sample(allQuestions, 20);
    }
  }

  // 북마크 초기 상태 로드 (로그인 시)
  const initialBookmarks: Record<string, boolean> = {};
  if (user && questions.length > 0) {
    const liked = await prisma.like.findMany({
      where: { userId: user.id, questionId: { in: questions.map((q) => q.id) } },
      select: { questionId: true },
    });
    for (const { questionId } of liked) {
      initialBookmarks[questionId] = true;
    }
  }

  return (
    <QuizPlayClient
      questions={questions}
      category={category ?? "all"}
      isReview={!!reviewIds}
      isTimed={timed === 'true'}
      initialBookmarks={initialBookmarks}
    />
  );
}
