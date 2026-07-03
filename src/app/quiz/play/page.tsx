import { prisma } from "@/lib/prisma";
import { getServerUser } from "@/lib/auth";
import { sample } from "@/lib/sample";
import { QuestionStatus } from "@prisma/client";
import type { Question, Category } from "@/types";
import QuizPlayClient from "./QuizPlayClient";

export default async function QuizPlayPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; reviewIds?: string; timed?: string; sharedFrom?: string }>;
}) {
  const { category, reviewIds, timed, sharedFrom } = await searchParams;

  const user = await getServerUser();
  let questions: Question[];
  let sharedCategory: string | undefined;

  if (sharedFrom) {
    const sharedSession = await prisma.quizSession.findUnique({
      where: { id: sharedFrom },
      select: { questionIds: true, category: true },
    });
    if (!sharedSession) {
      questions = [];
    } else {
      sharedCategory = sharedSession.category;
      const ids = sharedSession.questionIds as string[];
      const dbQuestions = await prisma.question.findMany({
        where: { id: { in: ids }, status: { in: ['OFFICIAL', 'APPROVED'] } },
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
    }
  } else if (reviewIds) {
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

  // 북마크 초기 상태 + 포인트 로드 (로그인 시)
  const initialBookmarks: Record<string, boolean> = {};
  let initialPoints: number | null = null; // null = 비로그인
  if (user && questions.length > 0) {
    const [liked, userData] = await Promise.all([
      prisma.like.findMany({
        where: { userId: user.id, questionId: { in: questions.map((q) => q.id) } },
        select: { questionId: true },
      }),
      prisma.user.findUnique({ where: { id: user.id }, select: { points: true } }),
    ]);
    for (const { questionId } of liked) {
      initialBookmarks[questionId] = true;
    }
    initialPoints = userData?.points ?? 0;
  }

  const quizMode: 'normal' | 'review' | 'timed' = reviewIds
    ? 'review'
    : timed === 'true'
    ? 'timed'
    : 'normal';

  const effectiveCategory = sharedFrom ? (sharedCategory ?? category ?? 'all') : (category ?? 'all');

  return (
    <QuizPlayClient
      questions={questions}
      category={effectiveCategory}
      mode={quizMode}
      isReview={!!reviewIds}
      isTimed={timed === 'true'}
      initialBookmarks={initialBookmarks}
      initialPoints={initialPoints}
    />
  );
}
