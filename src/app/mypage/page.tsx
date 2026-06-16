"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
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

const NICKNAME_REGEX = /^[a-zA-Z0-9가-힣]{2,12}$/;

type ActiveTab = "history" | "my-questions" | "liked";
type MyQStatus = "all" | "pending" | "approved" | "rejected";
type HistorySort = "newest" | "oldest" | "wrong_desc" | "wrong_asc";

const HISTORY_PAGE_SIZE = 5;

const SORT_LABELS: Record<HistorySort, string> = {
  newest: "최신순",
  oldest: "오래된순",
  wrong_desc: "오답 많은순",
  wrong_asc: "오답 적은순",
};

function sortSessions(sessions: ApiSession[], sort: HistorySort): ApiSession[] {
  const arr = [...sessions];
  if (sort === "oldest") {
    arr.sort((a, b) => new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime());
  } else if (sort === "wrong_desc") {
    arr.sort((a, b) => a.score - b.score);
  } else if (sort === "wrong_asc") {
    arr.sort((a, b) => b.score - a.score);
  }
  return arr;
}

type MyQSort = "newest" | "oldest" | "likes";
const MY_Q_SORT_LABELS: Record<MyQSort, string> = {
  newest: "최신순",
  oldest: "오래된순",
  likes: "좋아요순",
};

function filterAndSortMyQ(questions: MyQuestion[], search: string, sort: MyQSort): MyQuestion[] {
  let result = questions;
  if (search.trim()) {
    const s = search.trim().toLowerCase();
    result = result.filter((q) => q.question.toLowerCase().includes(s));
  }
  const arr = [...result];
  if (sort === "oldest") arr.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  else if (sort === "likes") arr.sort((a, b) => b._count.likes - a._count.likes);
  return arr;
}

function filterLiked(questions: LikedQuestion[], search: string, cat: string): LikedQuestion[] {
  let result = questions;
  if (cat !== "all") result = result.filter((q) => q.category === cat);
  if (search.trim()) {
    const s = search.trim().toLowerCase();
    result = result.filter((q) => q.question.toLowerCase().includes(s));
  }
  return result;
}

export default function MyPage() {
  const router = useRouter();
  const { data: session, update } = useSession();

  const [showNicknameForm, setShowNicknameForm] = useState(false);
  const [nicknameInput, setNicknameInput] = useState('');
  const [nicknameError, setNicknameError] = useState('');
  const [nicknameSubmitting, setNicknameSubmitting] = useState(false);

  async function handleNicknameChange(e: React.FormEvent) {
    e.preventDefault();
    if (!NICKNAME_REGEX.test(nicknameInput) || nicknameSubmitting) return;
    setNicknameSubmitting(true);
    setNicknameError('');
    try {
      const res = await fetch('/api/users/nickname', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nickname: nicknameInput }),
      });
      if (!res.ok) {
        setNicknameError((await res.json().catch(() => ({}))).error === 'Same nickname'
          ? '현재와 동일한 닉네임입니다.'
          : res.status === 409 ? '이미 사용 중인 닉네임입니다.' : '오류가 발생했습니다.');
        return;
      }
      await update({ nickname: nicknameInput });
      setShowNicknameForm(false);
      setNicknameInput('');
      toast.success('닉네임이 변경되었습니다.');
    } finally {
      setNicknameSubmitting(false);
    }
  }

  const [sessions, setSessions] = useState<ApiSession[]>([]);
  const [stats, setStats] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);

  const [activeTab, setActiveTab] = useState<ActiveTab>("history");

  const [myQuestions, setMyQuestions] = useState<MyQuestion[] | null>(null);
  const [myQStatus, setMyQStatus] = useState<MyQStatus>("all");
  const [myQLoading, setMyQLoading] = useState(false);

  const [likedQuestions, setLikedQuestions] = useState<LikedQuestion[] | null>(null);
  const [likedLoading, setLikedLoading] = useState(false);

  const [historySort, setHistorySort] = useState<HistorySort>("newest");
  const [historyPage, setHistoryPage] = useState(0);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [expandedWrongId, setExpandedWrongId] = useState<string | null>(null);

  const [myQSearch, setMyQSearch] = useState("");
  const [myQSort, setMyQSort] = useState<MyQSort>("newest");
  const [myQPage, setMyQPage] = useState(0);

  const [likedSearch, setLikedSearch] = useState("");
  const [likedCat, setLikedCat] = useState("all");
  const [likedPage, setLikedPage] = useState(0);

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
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={() => router.push("/")}
          className="text-neutral-400 hover:text-white text-sm transition-colors"
        >
          ← 홈
        </button>
        <h1 className="text-xl font-semibold text-white">마이페이지</h1>
      </div>

      {/* 닉네임 변경 */}
      <div className="bg-[#111111] border border-neutral-800 rounded-lg p-4 mb-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-neutral-500 mb-0.5">닉네임</p>
            <p className="text-sm text-white font-medium">{session?.user?.nickname ?? '–'}</p>
          </div>
          <button
            onClick={() => { setShowNicknameForm((v) => !v); setNicknameInput(''); setNicknameError(''); }}
            className="text-xs text-neutral-400 border border-neutral-700 rounded px-3 py-1.5 hover:border-neutral-500 hover:text-white transition-colors"
          >
            {showNicknameForm ? '취소' : '변경'}
          </button>
        </div>

        {showNicknameForm && (
          <form onSubmit={handleNicknameChange} className="mt-4 flex gap-2">
            <div className="flex-1">
              <input
                type="text"
                value={nicknameInput}
                onChange={(e) => { setNicknameInput(e.target.value); setNicknameError(''); }}
                placeholder="새 닉네임 (2~12자, 영문·숫자·한글)"
                maxLength={12}
                className="w-full rounded-md border border-neutral-800 bg-[#1a1a1a] px-3 py-2 text-sm text-white placeholder-neutral-600 focus:border-neutral-600 focus:outline-none transition-colors"
              />
              {nicknameError && (
                <p className="mt-1 text-xs text-red-400">{nicknameError}</p>
              )}
            </div>
            <button
              type="submit"
              disabled={!NICKNAME_REGEX.test(nicknameInput) || nicknameSubmitting}
              className="rounded-md bg-white text-black text-sm font-medium px-4 py-2 hover:bg-neutral-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex-shrink-0"
            >
              {nicknameSubmitting ? '저장 중...' : '저장'}
            </button>
          </form>
        )}
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
              <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
                <div className="flex gap-1 flex-wrap">
                  {(Object.keys(SORT_LABELS) as HistorySort[]).map((s) => (
                    <button
                      key={s}
                      onClick={() => { setHistorySort(s); setHistoryPage(0); setExpandedId(null); }}
                      className={`text-xs rounded px-2.5 py-1 border transition-colors ${
                        historySort === s
                          ? "bg-white text-black border-white font-medium"
                          : "border-neutral-800 text-neutral-400 hover:border-neutral-600 hover:text-white"
                      }`}
                    >
                      {SORT_LABELS[s]}
                    </button>
                  ))}
                </div>
                {sessions.length > HISTORY_PAGE_SIZE && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => { setHistoryPage((p) => Math.max(0, p - 1)); setExpandedId(null); }}
                      disabled={historyPage === 0}
                      className="text-xs text-neutral-400 border border-neutral-800 rounded px-2 py-1 hover:border-neutral-600 hover:text-white disabled:opacity-30 transition-colors"
                    >
                      ←
                    </button>
                    <span className="text-xs text-neutral-500">
                      {historyPage + 1} / {Math.ceil(sessions.length / HISTORY_PAGE_SIZE)}
                    </span>
                    <button
                      onClick={() => { setHistoryPage((p) => Math.min(Math.ceil(sessions.length / HISTORY_PAGE_SIZE) - 1, p + 1)); setExpandedId(null); }}
                      disabled={historyPage >= Math.ceil(sessions.length / HISTORY_PAGE_SIZE) - 1}
                      className="text-xs text-neutral-400 border border-neutral-800 rounded px-2 py-1 hover:border-neutral-600 hover:text-white disabled:opacity-30 transition-colors"
                    >
                      →
                    </button>
                  </div>
                )}
              </div>
              <div className="space-y-3">
                {sortSessions(sessions, historySort).slice(historyPage * HISTORY_PAGE_SIZE, (historyPage + 1) * HISTORY_PAGE_SIZE).map((session, idx) => {
                  const sessionIdx = historyPage * HISTORY_PAGE_SIZE + idx;
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
                            #{sessions.length - sessionIdx}회 · {formatDate(session.submittedAt)}
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
          {/* 검색 */}
          <input
            type="text"
            value={myQSearch}
            onChange={(e) => { setMyQSearch(e.target.value); setMyQPage(0); }}
            placeholder="문제 내용 검색..."
            className="w-full rounded-md border border-neutral-800 bg-[#111] px-3 py-2 text-sm text-white placeholder-neutral-600 focus:border-neutral-600 focus:outline-none transition-colors mb-3"
          />

          {/* 정렬 + 상태 필터 */}
          <div className="flex flex-wrap gap-2 mb-4">
            <div className="flex gap-1">
              {(Object.keys(MY_Q_SORT_LABELS) as MyQSort[]).map((s) => (
                <button
                  key={s}
                  onClick={() => { setMyQSort(s); setMyQPage(0); }}
                  className={`px-2.5 py-1 rounded text-xs transition-colors ${
                    myQSort === s
                      ? "bg-white text-black font-medium"
                      : "border border-neutral-800 text-neutral-400 hover:border-neutral-600 hover:text-white"
                  }`}
                >
                  {MY_Q_SORT_LABELS[s]}
                </button>
              ))}
            </div>
            <div className="w-px bg-neutral-800 self-stretch" />
            <div className="flex gap-1">
              {(["all", "pending", "approved", "rejected"] as MyQStatus[]).map((s) => {
                const labels: Record<MyQStatus, string> = { all: "전체", pending: "요청", approved: "승인", rejected: "거절" };
                return (
                  <button
                    key={s}
                    onClick={() => { setMyQStatus(s); setMyQPage(0); }}
                    className={`px-2.5 py-1 rounded text-xs transition-colors ${
                      myQStatus === s
                        ? "bg-neutral-700 text-white font-medium"
                        : "border border-neutral-800 text-neutral-400 hover:border-neutral-600 hover:text-white"
                    }`}
                  >
                    {labels[s]}
                  </button>
                );
              })}
            </div>
          </div>

          {myQLoading ? (
            <div className="py-12 text-center">
              <p className="text-neutral-500 text-sm">불러오는 중...</p>
            </div>
          ) : (() => {
            const filtered = filterAndSortMyQ(myQuestions ?? [], myQSearch, myQSort);
            const pageCount = Math.ceil(filtered.length / HISTORY_PAGE_SIZE);
            const paged = filtered.slice(myQPage * HISTORY_PAGE_SIZE, (myQPage + 1) * HISTORY_PAGE_SIZE);
            if (filtered.length === 0) {
              return (
                <div className="text-center py-12">
                  <p className="text-neutral-500 text-sm mb-4">
                    {myQSearch ? "검색 결과가 없습니다." : myQStatus === "all" ? "등록한 문제가 없습니다." : `${myQStatus === "pending" ? "요청 중인" : myQStatus === "approved" ? "승인된" : "거절된"} 문제가 없습니다.`}
                  </p>
                  {!myQSearch && (
                    <Link href="/board/submit" className="rounded-md bg-white text-black text-sm font-medium px-6 py-2.5 hover:bg-neutral-200 transition-colors">
                      문제 등록하기
                    </Link>
                  )}
                </div>
              );
            }
            return (
              <>
                <p className="text-xs text-neutral-600 mb-3">총 {filtered.length}개</p>
                <div className="space-y-3">
                  {paged.map((q) => (
                    <Link
                      key={q.id}
                      href={`/board/${q.id}`}
                      className="block bg-[#111111] border border-neutral-800 rounded-lg p-4 hover:bg-[#161616] transition-colors"
                    >
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className="text-xs text-neutral-500 border border-neutral-800 rounded px-2 py-0.5">
                            {CATEGORY_LABELS[q.category as Category] ?? q.category}
                          </span>
                          <span className={`text-xs border rounded px-2 py-0.5 ${STATUS_STYLE[q.status] ?? "text-neutral-500 border-neutral-800"}`}>
                            {STATUS_LABEL[q.status] ?? q.status}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {q._count.likes > 0 && (
                            <span className="text-xs text-neutral-500">♥ {q._count.likes}</span>
                          )}
                          <span className="text-xs text-neutral-600">
                            {new Date(q.createdAt).toLocaleDateString("ko-KR")}
                          </span>
                        </div>
                      </div>
                      <p className="text-sm text-neutral-300 leading-relaxed line-clamp-2">{q.question}</p>
                      {q.status === "REJECTED" && q.rejectionReason && (
                        <div className="mt-3 pt-3 border-t border-neutral-800">
                          <p className="text-xs text-neutral-500 mb-1">거절 사유</p>
                          <p className="text-xs text-red-400">{q.rejectionReason}</p>
                        </div>
                      )}
                    </Link>
                  ))}
                </div>
                {pageCount > 1 && (
                  <div className="flex items-center justify-center gap-3 mt-4">
                    <button
                      onClick={() => setMyQPage((p) => Math.max(0, p - 1))}
                      disabled={myQPage === 0}
                      className="text-xs text-neutral-400 border border-neutral-800 rounded px-2.5 py-1 hover:border-neutral-600 hover:text-white disabled:opacity-30 transition-colors"
                    >←</button>
                    <span className="text-xs text-neutral-500">{myQPage + 1} / {pageCount}</span>
                    <button
                      onClick={() => setMyQPage((p) => Math.min(pageCount - 1, p + 1))}
                      disabled={myQPage >= pageCount - 1}
                      className="text-xs text-neutral-400 border border-neutral-800 rounded px-2.5 py-1 hover:border-neutral-600 hover:text-white disabled:opacity-30 transition-colors"
                    >→</button>
                  </div>
                )}
              </>
            );
          })()}
        </>
      )}

      {/* 탭 3: 내가 좋아요한 문제 */}
      {activeTab === "liked" && (
        <>
          {/* 검색 */}
          <input
            type="text"
            value={likedSearch}
            onChange={(e) => { setLikedSearch(e.target.value); setLikedPage(0); }}
            placeholder="문제 내용 검색..."
            className="w-full rounded-md border border-neutral-800 bg-[#111] px-3 py-2 text-sm text-white placeholder-neutral-600 focus:border-neutral-600 focus:outline-none transition-colors mb-3"
          />

          {/* 카테고리 필터 */}
          <div className="flex gap-1 flex-wrap mb-4">
            {(["all", ...Object.keys(CATEGORY_LABELS)] as string[]).map((cat) => (
              <button
                key={cat}
                onClick={() => { setLikedCat(cat); setLikedPage(0); }}
                className={`px-2.5 py-1 rounded text-xs transition-colors ${
                  likedCat === cat
                    ? "bg-white text-black font-medium"
                    : "border border-neutral-800 text-neutral-400 hover:border-neutral-600 hover:text-white"
                }`}
              >
                {cat === "all" ? "전체" : CATEGORY_LABELS[cat as Category]}
              </button>
            ))}
          </div>

          {likedLoading ? (
            <div className="py-12 text-center">
              <p className="text-neutral-500 text-sm">불러오는 중...</p>
            </div>
          ) : (() => {
            const filtered = filterLiked(likedQuestions ?? [], likedSearch, likedCat);
            const pageCount = Math.ceil(filtered.length / HISTORY_PAGE_SIZE);
            const paged = filtered.slice(likedPage * HISTORY_PAGE_SIZE, (likedPage + 1) * HISTORY_PAGE_SIZE);
            if (filtered.length === 0) {
              return (
                <div className="text-center py-12">
                  <p className="text-neutral-500 text-sm mb-4">
                    {likedSearch || likedCat !== "all" ? "검색 결과가 없습니다." : "좋아요한 문제가 없습니다."}
                  </p>
                  {!likedSearch && likedCat === "all" && (
                    <Link href="/board" className="rounded-md bg-white text-black text-sm font-medium px-6 py-2.5 hover:bg-neutral-200 transition-colors">
                      게시판 보기
                    </Link>
                  )}
                </div>
              );
            }
            return (
              <>
                <p className="text-xs text-neutral-600 mb-3">총 {filtered.length}개</p>
                <div className="space-y-2">
                  {paged.map((q) => (
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
                {pageCount > 1 && (
                  <div className="flex items-center justify-center gap-3 mt-4">
                    <button
                      onClick={() => setLikedPage((p) => Math.max(0, p - 1))}
                      disabled={likedPage === 0}
                      className="text-xs text-neutral-400 border border-neutral-800 rounded px-2.5 py-1 hover:border-neutral-600 hover:text-white disabled:opacity-30 transition-colors"
                    >←</button>
                    <span className="text-xs text-neutral-500">{likedPage + 1} / {pageCount}</span>
                    <button
                      onClick={() => setLikedPage((p) => Math.min(pageCount - 1, p + 1))}
                      disabled={likedPage >= pageCount - 1}
                      className="text-xs text-neutral-400 border border-neutral-800 rounded px-2.5 py-1 hover:border-neutral-600 hover:text-white disabled:opacity-30 transition-colors"
                    >→</button>
                  </div>
                )}
              </>
            );
          })()}
        </>
      )}
    </div>
  );
}
