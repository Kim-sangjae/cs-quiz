"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import ResultCard from "@/components/ResultCard";
import type { Category, Question } from "@/types";

const CATEGORY_LABELS: Record<Category, string> = {
  ds: "자료구조",
  algo: "알고리즘",
  os: "OS",
  network: "네트워크",
  db: "DB",
  arch: "컴퓨터구조",
};

const CATEGORY_ORDER: Category[] = ["ds", "algo", "os", "network", "db", "arch"];

type BadgeTier = "bronze" | "silver" | "gold";

type ApiQuestion = {
  id: string;
  category: string;
  question: string;
  options: unknown;
  answer: number;
  explanation: string;
};

type ApiSession = {
  id: string;
  category: string;
  score: number;
  submittedAt: string;
  answers: { questionId: string; selected: number }[];
  questions: ApiQuestion[];
};

type StatsData = {
  totalSessions: number;
  overallAccuracy: number;
  weakestCategory: string | null;
  streakCount: number;
};

type MyQuestion = {
  id: string;
  category: string;
  question: string;
  status: string;
  rejectionReason: string | null;
  createdAt: string;
  _count: { likes: number };
};

type LikedQuestion = {
  id: string;
  category: string;
  question: string;
  status: string;
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  return (
    d.toLocaleDateString("ko-KR", {
      year: "numeric",
      month: "long",
      day: "numeric",
    }) +
    " · " +
    d.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })
  );
}

function getLevel(total: number): number {
  if (total >= 300) return 4;
  if (total >= 150) return 3;
  if (total >= 50) return 2;
  return 1;
}

function getBadge(accuracy: number, total: number): BadgeTier | null {
  if (total === 0 || accuracy < 30) return null;
  if (accuracy >= 90) return "gold";
  if (accuracy >= 60) return "silver";
  return "bronze";
}

function BadgePill({ tier }: { tier: BadgeTier }) {
  const styles: Record<BadgeTier, string> = {
    bronze: "bg-amber-950/60 text-amber-600 border border-amber-800/60",
    silver: "bg-slate-800/60 text-slate-300 border border-slate-600/60",
    gold: "bg-yellow-950/60 text-yellow-400 border border-yellow-700/60",
  };
  const labels: Record<BadgeTier, string> = {
    bronze: "BRONZE",
    silver: "SILVER",
    gold: "GOLD",
  };
  return (
    <span className={`text-[9px] font-bold tracking-wide px-1.5 py-0.5 rounded ${styles[tier]}`}>
      {labels[tier]}
    </span>
  );
}

function computeProfileStats(sessions: ApiSession[]) {
  const map = new Map<Category, { total: number; correct: number }>();

  for (const session of sessions) {
    for (const q of session.questions) {
      const cat = q.category as Category;
      const entry = map.get(cat) ?? { total: 0, correct: 0 };
      entry.total++;
      const ans = session.answers.find((a) => a.questionId === q.id);
      if (ans?.selected === q.answer) entry.correct++;
      map.set(cat, entry);
    }
  }

  return CATEGORY_ORDER.map((cat) => {
    const { total, correct } = map.get(cat) ?? { total: 0, correct: 0 };
    const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0;
    return {
      cat,
      label: CATEGORY_LABELS[cat],
      total,
      correct,
      accuracy,
      level: getLevel(total),
      badge: getBadge(accuracy, total),
    };
  });
}

function getCategoryStats(
  session: ApiSession
): Array<{ cat: Category; label: string; correct: number; total: number }> {
  const map = new Map<Category, { correct: number; total: number }>();

  for (const q of session.questions) {
    const cat = q.category as Category;
    const entry = map.get(cat) ?? { correct: 0, total: 0 };
    entry.total++;
    const ans = session.answers.find((a) => a.questionId === q.id);
    if (ans?.selected === q.answer) entry.correct++;
    map.set(cat, entry);
  }

  return Array.from(map.entries()).map(([cat, stats]) => ({
    cat,
    label: CATEGORY_LABELS[cat],
    ...stats,
  }));
}

const STATUS_LABEL: Record<string, string> = {
  PENDING: "요청",
  APPROVED: "승인",
  REJECTED: "거절",
  BLINDED: "블라인드",
};

const STATUS_STYLE: Record<string, string> = {
  PENDING: "text-neutral-400 border-neutral-700",
  APPROVED: "text-green-500 border-green-800",
  REJECTED: "text-red-500 border-red-900",
  BLINDED: "text-neutral-600 border-neutral-800",
};

type ActiveTab = "history" | "my-questions" | "liked";
type MyQStatus = "all" | "pending" | "approved" | "rejected";

export default function MyPage() {
  const router = useRouter();

  const [sessions, setSessions] = useState<ApiSession[]>([]);
  const [stats, setStats] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);

  const [activeTab, setActiveTab] = useState<ActiveTab>("history");

  const [myQuestions, setMyQuestions] = useState<MyQuestion[] | null>(null);
  const [myQStatus, setMyQStatus] = useState<MyQStatus>("all");
  const [myQLoading, setMyQLoading] = useState(false);

  const [likedQuestions, setLikedQuestions] = useState<LikedQuestion[] | null>(null);
  const [likedLoading, setLikedLoading] = useState(false);

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [expandedWrongId, setExpandedWrongId] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/mypage/stats").then((r) => r.json()),
      fetch("/api/mypage/sessions").then((r) => r.json()),
    ])
      .then(([statsData, sessionsData]) => {
        setStats(statsData as StatsData);
        setSessions((sessionsData as { sessions: ApiSession[] }).sessions ?? []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (activeTab !== "my-questions") return;
    setMyQLoading(true);
    fetch(`/api/mypage/my-questions?status=${myQStatus}`)
      .then((r) => r.json())
      .then((data) => setMyQuestions((data as { questions: MyQuestion[] }).questions ?? []))
      .catch(() => setMyQuestions([]))
      .finally(() => setMyQLoading(false));
  }, [activeTab, myQStatus]);

  useEffect(() => {
    if (activeTab !== "liked" || likedQuestions !== null) return;
    setLikedLoading(true);
    fetch("/api/mypage/liked-questions")
      .then((r) => r.json())
      .then((data) => setLikedQuestions((data as { questions: LikedQuestion[] }).questions ?? []))
      .catch(() => setLikedQuestions([]))
      .finally(() => setLikedLoading(false));
  }, [activeTab, likedQuestions]);

  const profileStats = computeProfileStats(sessions);

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="flex items-center gap-4 mb-8">
        <button
          onClick={() => router.push("/")}
          className="text-neutral-400 hover:text-white text-sm transition-colors"
        >
          ← 홈
        </button>
        <h1 className="text-xl font-semibold text-white">마이페이지</h1>
      </div>

      {/* 요약 카드 */}
      {stats && (
        <div className="bg-[#111111] border border-neutral-800 rounded-lg p-5 mb-4">
          <div className="flex items-center justify-between">
            <div className="text-center flex-1">
              <p className="text-xs text-neutral-500 mb-1">총 퀴즈 횟수</p>
              <p className="text-xl font-bold text-white">{stats.totalSessions}
                <span className="text-sm font-normal text-neutral-500">회</span>
              </p>
            </div>
            <div className="w-px h-10 bg-neutral-800" />
            <div className="text-center flex-1">
              <p className="text-xs text-neutral-500 mb-1">전체 정답률</p>
              <p className="text-xl font-bold text-white">{stats.overallAccuracy}
                <span className="text-sm font-normal text-neutral-500">%</span>
              </p>
            </div>
            <div className="w-px h-10 bg-neutral-800" />
            <div className="text-center flex-1">
              <p className="text-xs text-neutral-500 mb-1">연속 기록</p>
              <p className="text-xl font-bold text-white">{stats.streakCount}
                <span className="text-sm font-normal text-neutral-500">일</span>
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 카테고리별 프로필 */}
      <div className="bg-[#111111] border border-neutral-800 rounded-lg p-5 mb-6">
        <p className="text-xs text-neutral-500 mb-4">카테고리별 현황</p>
        <div className="space-y-1">
          {profileStats.map(({ cat, label, total, correct, accuracy, level, badge }) => (
            <button
              key={cat}
              onClick={() => router.push(`/mypage/${cat}`)}
              className="w-full flex items-center gap-3 px-2 py-2 rounded-md hover:bg-[#1a1a1a] transition-colors text-left"
            >
              <span className="text-sm text-neutral-300 w-16 flex-shrink-0">{label}</span>
              <span className="text-[10px] text-neutral-600 border border-neutral-800 rounded px-1.5 py-0.5 flex-shrink-0">
                Lv.{level}
              </span>
              <div className="w-[50px] flex-shrink-0">
                {badge && <BadgePill tier={badge} />}
              </div>
              <div className="flex items-center gap-2 ml-auto">
                <span className="text-xs text-neutral-600">
                  {total > 0 ? `${correct}/${total}` : "–"}
                </span>
                <span className="text-xs text-neutral-400 w-8 text-right">
                  {total > 0 ? `${accuracy}%` : ""}
                </span>
              </div>
              <svg
                width={12}
                height={12}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                className="text-neutral-700 flex-shrink-0"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          ))}
        </div>
      </div>

      {/* 탭 */}
      <div className="flex gap-1 mb-4 border-b border-neutral-800 pb-0">
        {(["history", "my-questions", "liked"] as ActiveTab[]).map((tab) => {
          const labels: Record<ActiveTab, string> = {
            history: "풀이 기록",
            "my-questions": "내가 등록한 문제",
            liked: "내가 좋아요한 문제",
          };
          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 text-sm transition-colors border-b-2 -mb-px ${
                activeTab === tab
                  ? "border-white text-white"
                  : "border-transparent text-neutral-500 hover:text-neutral-300"
              }`}
            >
              {labels[tab]}
            </button>
          );
        })}
      </div>

      {/* 탭 1: 풀이 기록 */}
      {activeTab === "history" && (
        <>
          {loading ? (
            <div className="py-12 text-center">
              <p className="text-neutral-500 text-sm">불러오는 중...</p>
            </div>
          ) : sessions.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-neutral-500 text-sm mb-4">
                아직 풀이 기록이 없습니다.
              </p>
              <button
                onClick={() => router.push("/quiz")}
                className="rounded-md bg-white text-black text-sm font-medium px-6 py-2.5 hover:bg-neutral-200 transition-colors"
              >
                첫 문제 풀기
              </button>
            </div>
          ) : (
            <>
              <p className="text-xs text-neutral-500 mb-3">풀이 기록</p>
              <div className="space-y-3">
                {sessions.map((session, idx) => {
                  const isExpanded = expandedId === session.submittedAt;
                  const scoreColor =
                    session.score >= 27
                      ? "text-green-400"
                      : session.score >= 21
                      ? "text-yellow-400"
                      : "text-red-400";
                  const catStats = getCategoryStats(session);
                  const wrongItems = session.questions
                    .map((q, i) => ({
                      question: q,
                      questionNumber: i + 1,
                      userAnswer: session.answers.find((a) => a.questionId === q.id),
                    }))
                    .filter(
                      ({ question, userAnswer }) =>
                        !!userAnswer && userAnswer.selected !== question.answer
                    );

                  return (
                    <div
                      key={session.submittedAt}
                      className="bg-[#111111] border border-neutral-800 rounded-lg overflow-hidden"
                    >
                      <button
                        className="w-full text-left px-5 py-4 hover:bg-[#161616] transition-colors"
                        onClick={() =>
                          setExpandedId(isExpanded ? null : session.submittedAt)
                        }
                      >
                        <div className="flex items-start justify-between">
                          <span className="text-xs text-neutral-500">
                            #{sessions.length - idx}회 · {formatDate(session.submittedAt)}
                          </span>
                          <div className="flex items-center gap-3 flex-shrink-0 ml-4">
                            <span className={`text-xl font-bold ${scoreColor}`}>
                              {session.score}
                              <span className="text-neutral-500 text-sm font-normal">
                                {" "}
                                / 30
                              </span>
                            </span>
                            <svg
                              width={14}
                              height={14}
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth={2}
                              className={`text-neutral-600 transition-transform ${
                                isExpanded ? "rotate-180" : ""
                              }`}
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M19 9l-7 7-7-7"
                              />
                            </svg>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2 mt-3">
                          {catStats.map(({ cat, label, correct, total }) => (
                            <span
                              key={cat}
                              className="text-xs text-neutral-500 border border-neutral-800 rounded px-2 py-0.5"
                            >
                              {label} {correct}/{total}
                            </span>
                          ))}
                        </div>
                      </button>

                      {isExpanded && (
                        <div className="border-t border-neutral-800 px-5 py-5">
                          {wrongItems.length === 0 ? (
                            <p className="text-green-400 text-sm text-center py-4">
                              모든 문제를 맞혔습니다!
                            </p>
                          ) : (
                            <>
                              <p className="text-xs text-neutral-500 mb-3">
                                오답 {wrongItems.length}문제
                              </p>
                              <div className="space-y-1">
                                {wrongItems.map((item) => {
                                  const wrongKey = `${session.submittedAt}-${item.question.id}`;
                                  const isWrongExpanded = expandedWrongId === wrongKey;
                                  return (
                                    <div key={item.question.id}>
                                      <button
                                        className="w-full text-left px-3 py-2.5 rounded-md hover:bg-[#1a1a1a] transition-colors flex items-center justify-between gap-3"
                                        onClick={() =>
                                          setExpandedWrongId(
                                            isWrongExpanded ? null : wrongKey
                                          )
                                        }
                                      >
                                        <div className="flex items-center gap-2 min-w-0">
                                          <span className="text-xs text-neutral-600 flex-shrink-0">
                                            {item.questionNumber}.
                                          </span>
                                          <span className="text-xs text-neutral-600 border border-neutral-800 rounded px-1.5 py-0.5 flex-shrink-0">
                                            {item.question.category}
                                          </span>
                                          <span className="text-sm text-neutral-400 truncate">
                                            {item.question.question}
                                          </span>
                                        </div>
                                        <svg
                                          width={12}
                                          height={12}
                                          viewBox="0 0 24 24"
                                          fill="none"
                                          stroke="currentColor"
                                          strokeWidth={2}
                                          className={`text-neutral-600 flex-shrink-0 transition-transform ${
                                            isWrongExpanded ? "rotate-180" : ""
                                          }`}
                                        >
                                          <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            d="M19 9l-7 7-7-7"
                                          />
                                        </svg>
                                      </button>
                                      {isWrongExpanded && (
                                        <div className="mt-2 mb-2">
                                          <ResultCard
                                            questionNumber={item.questionNumber}
                                            question={item.question as unknown as Question}
                                            userSelected={item.userAnswer!.selected as 0 | 1 | 2 | 3}
                                          />
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </>
      )}

      {/* 탭 2: 내가 등록한 문제 */}
      {activeTab === "my-questions" && (
        <>
          <div className="flex gap-2 mb-4">
            {(["all", "pending", "approved", "rejected"] as MyQStatus[]).map((s) => {
              const labels: Record<MyQStatus, string> = {
                all: "전체",
                pending: "요청",
                approved: "승인",
                rejected: "거절",
              };
              return (
                <button
                  key={s}
                  onClick={() => setMyQStatus(s)}
                  className={`px-3 py-1.5 rounded text-xs transition-colors ${
                    myQStatus === s
                      ? "bg-white text-black font-medium"
                      : "border border-neutral-800 text-neutral-400 hover:border-neutral-600 hover:text-white"
                  }`}
                >
                  {labels[s]}
                </button>
              );
            })}
          </div>

          {myQLoading ? (
            <div className="py-12 text-center">
              <p className="text-neutral-500 text-sm">불러오는 중...</p>
            </div>
          ) : !myQuestions || myQuestions.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-neutral-500 text-sm mb-4">
                {myQStatus === "all" ? "등록한 문제가 없습니다." : `${myQStatus === "pending" ? "요청 중인" : myQStatus === "approved" ? "승인된" : "거절된"} 문제가 없습니다.`}
              </p>
              <Link
                href="/board/submit"
                className="rounded-md bg-white text-black text-sm font-medium px-6 py-2.5 hover:bg-neutral-200 transition-colors"
              >
                문제 등록하기
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {myQuestions.map((q) => (
                <div
                  key={q.id}
                  className="bg-[#111111] border border-neutral-800 rounded-lg p-4"
                >
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-xs text-neutral-500 border border-neutral-800 rounded px-2 py-0.5">
                        {CATEGORY_LABELS[q.category as Category] ?? q.category}
                      </span>
                      <span
                        className={`text-xs border rounded px-2 py-0.5 ${STATUS_STYLE[q.status] ?? "text-neutral-500 border-neutral-800"}`}
                      >
                        {STATUS_LABEL[q.status] ?? q.status}
                      </span>
                    </div>
                    <span className="text-xs text-neutral-600 flex-shrink-0">
                      {new Date(q.createdAt).toLocaleDateString("ko-KR")}
                    </span>
                  </div>
                  <p className="text-sm text-neutral-300 leading-relaxed line-clamp-2">
                    {q.question}
                  </p>
                  {q.status === "REJECTED" && q.rejectionReason && (
                    <div className="mt-3 pt-3 border-t border-neutral-800">
                      <p className="text-xs text-neutral-500 mb-1">거절 사유</p>
                      <p className="text-xs text-red-400">{q.rejectionReason}</p>
                      <Link
                        href="/board/submit"
                        className="inline-block mt-2 text-xs text-neutral-400 border border-neutral-700 rounded px-3 py-1 hover:border-neutral-500 hover:text-white transition-colors"
                      >
                        수정 후 재요청
                      </Link>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* 탭 3: 내가 좋아요한 문제 */}
      {activeTab === "liked" && (
        <>
          {likedLoading ? (
            <div className="py-12 text-center">
              <p className="text-neutral-500 text-sm">불러오는 중...</p>
            </div>
          ) : !likedQuestions || likedQuestions.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-neutral-500 text-sm mb-4">
                좋아요한 문제가 없습니다.
              </p>
              <Link
                href="/board"
                className="rounded-md bg-white text-black text-sm font-medium px-6 py-2.5 hover:bg-neutral-200 transition-colors"
              >
                게시판 보기
              </Link>
            </div>
          ) : (
            <div className="space-y-2">
              {likedQuestions.map((q) => (
                <Link
                  key={q.id}
                  href={`/board/${q.id}`}
                  className="block bg-[#111111] border border-neutral-800 rounded-lg px-4 py-3 hover:bg-[#161616] transition-colors"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs text-neutral-500 border border-neutral-800 rounded px-2 py-0.5">
                      {CATEGORY_LABELS[q.category as Category] ?? q.category}
                    </span>
                  </div>
                  <p className="text-sm text-neutral-300 truncate">{q.question}</p>
                </Link>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
