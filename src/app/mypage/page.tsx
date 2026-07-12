"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import QuestionDrawer from "@/components/QuestionDrawer";
import type { Category } from "@/types";
import { BADGE_META, ALL_BADGES } from "@/lib/badges";
import { getLevelInfo, MAX_LEVEL, XP_REWARDS } from "@/lib/user-level";

const CATEGORY_LABELS: Record<Category, string> = {
  ds: "자료구조",
  algo: "알고리즘",
  os: "운영체제",
  network: "네트워크",
  db: "데이터베이스",
  arch: "컴퓨터 구조",
  se: "소프트웨어공학",
};

const CATEGORY_ORDER: Category[] = ["ds", "algo", "os", "network", "db", "arch", "se"];

type BadgeTier = "bronze" | "silver" | "gold";

const LEVEL_INFO: Record<number, { name: string; text: string; bar: string }> = {
  1: { name: '입문', text: 'text-neutral-400', bar: 'bg-neutral-500' },
  2: { name: '학습', text: 'text-blue-400', bar: 'bg-blue-500' },
  3: { name: '숙련', text: 'text-emerald-400', bar: 'bg-emerald-500' },
  4: { name: '마스터', text: 'text-yellow-400', bar: 'bg-yellow-500' },
};

const LEVEL_MIN = [0, 0, 50, 150, 300] as const;
const LEVEL_MAX = [0, 50, 150, 300, 300] as const;

function getLevelProgress(total: number, level: number): number {
  if (level >= 4) return 100;
  return Math.min(100, Math.round(((total - LEVEL_MIN[level]) / (LEVEL_MAX[level] - LEVEL_MIN[level])) * 100));
}

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
  mode: string;
  submittedAt: string;
  answers: { questionId: string; selected: number }[];
  questions: ApiQuestion[];
};

type ChartSession = { id: string; score: number; category: string; submittedAt: string };

type DailyCompletion = { date: string; correct: boolean };

type CategoryProgress = { total: number; tried: number };

type StatsData = {
  totalSessions: number;
  overallAccuracy: number;
  weakestCategory: string | null;
  streakCount: number;
  xp: number;
  dailyCompletions: DailyCompletion[];
  categoryProgress: Record<string, CategoryProgress>;
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
  folderId: string | null;
};

type BookmarkFolder = {
  id: string;
  name: string;
  _count: { likes: number };
};

type WeeklyGoal = {
  key: string;
  label: string;
  description: string;
  target: number;
  points: number;
  progress: number;
  completed: boolean;
  claimed: boolean;
  categories?: string[];
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
  // 등급은 Lv.2(누적 50회)부터 측정
  if (total < 50 || accuracy < 30) return null;
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

function computeProfileStats(
  dbCounts: Record<string, number> = {},
  dbAccuracy: Record<string, number> = {}
) {
  return CATEGORY_ORDER.map((cat) => {
    const total = dbCounts[cat] ?? 0;
    const accuracy = dbAccuracy[cat] ?? 0;
    return {
      cat,
      label: CATEGORY_LABELS[cat],
      total,
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

type ActiveTab = "history" | "battle" | "my-questions" | "liked" | "badges" | "comments";
type MyQStatus = "all" | "pending" | "approved" | "rejected";
type HistorySort = "newest" | "oldest" | "wrong_desc" | "wrong_asc";

const HISTORY_PAGE_SIZE = 5;

const SORT_LABELS: Record<HistorySort, string> = {
  newest: "최신순",
  oldest: "오래된순",
  wrong_desc: "오답 많은순",
  wrong_asc: "오답 적은순",
};


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

function filterLiked(questions: LikedQuestion[], search: string, cat: string, folder: string | null | 'all'): LikedQuestion[] {
  let result = questions;
  if (cat !== "all") result = result.filter((q) => q.category === cat);
  if (folder !== 'all') result = result.filter((q) => q.folderId === folder);
  if (search.trim()) {
    const s = search.trim().toLowerCase();
    result = result.filter((q) => q.question.toLowerCase().includes(s));
  }
  return result;
}

function WeeklyReport({ sessions }: { sessions: ChartSession[] }) {
  const now = new Date();
  const startOfThisWeek = new Date(now);
  startOfThisWeek.setDate(now.getDate() - now.getDay());
  startOfThisWeek.setHours(0, 0, 0, 0);

  const startOfLastWeek = new Date(startOfThisWeek);
  startOfLastWeek.setDate(startOfLastWeek.getDate() - 7);

  const thisWeek = sessions.filter((s) => new Date(s.submittedAt) >= startOfThisWeek);
  const lastWeek = sessions.filter((s) => {
    const d = new Date(s.submittedAt);
    return d >= startOfLastWeek && d < startOfThisWeek;
  });

  if (thisWeek.length === 0 && lastWeek.length === 0) return null;

  const thisAvg = thisWeek.length > 0
    ? Math.round(thisWeek.reduce((s, r) => s + r.score, 0) / thisWeek.length)
    : null;
  const lastAvg = lastWeek.length > 0
    ? Math.round(lastWeek.reduce((s, r) => s + r.score, 0) / lastWeek.length)
    : null;
  const diff = thisAvg !== null && lastAvg !== null ? thisAvg - lastAvg : null;

  return (
    <div className="mt-4 pt-4 border-t border-neutral-800">
      <p className="text-xs text-neutral-500 mb-2">이번 주</p>
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-sm text-neutral-300">
          <span className="text-white font-semibold">{thisWeek.length}</span>
          <span className="text-neutral-500 ml-1">회</span>
        </span>
        {thisAvg !== null && (
          <span className="text-sm text-neutral-300">
            평균 <span className="text-white font-semibold">{thisAvg}</span>
            <span className="text-neutral-500">/20점</span>
          </span>
        )}
        {diff !== null && (
          <span className={`text-xs font-medium ${diff > 0 ? 'text-emerald-400' : diff < 0 ? 'text-red-400' : 'text-neutral-500'}`}>
            {diff > 0 ? `▲${diff}` : diff < 0 ? `▼${Math.abs(diff)}` : '±0'} 지난주 대비
          </span>
        )}
        {thisWeek.length === 0 && (
          <span className="text-xs text-neutral-600">아직 풀이 없음</span>
        )}
      </div>
    </div>
  );
}

function ScoreTrend({ sessions }: { sessions: ChartSession[] }) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const recent = [...sessions]
    .sort((a, b) => new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime())
    .slice(-10);

  if (recent.length < 2) return null;

  const W = 280, H = 60, PAD_X = 12, PAD_Y = 16;
  const max = 20, min = 0;
  const points = recent.map((s, i) => {
    const x = PAD_X + (i / (recent.length - 1)) * (W - PAD_X * 2);
    const y = PAD_Y + ((max - s.score) / (max - min)) * (H - PAD_Y * 2);
    return { x, y, score: s.score };
  });
  const d = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const last = points[points.length - 1];
  const hovered = hoveredIdx !== null ? points[hoveredIdx] : null;

  return (
    <div className="mt-4 pt-4 border-t border-neutral-800">
      <p className="text-xs text-neutral-500 mb-2">최근 {recent.length}회 점수 추이</p>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full overflow-visible" overflow="visible" style={{ height: 64 }}>
        <path d={d} fill="none" stroke="#404040" strokeWidth={1.5} />
        {points.map((p, i) => (
          <g key={i} onMouseEnter={() => setHoveredIdx(i)} onMouseLeave={() => setHoveredIdx(null)}>
            <circle cx={p.x} cy={p.y} r={12} fill="transparent" style={{ cursor: 'default' }} />
            <circle cx={p.x} cy={p.y} r={hoveredIdx === i ? 3.5 : 2.5}
              fill={i === points.length - 1 ? '#10b981' : hoveredIdx === i ? '#a3a3a3' : '#525252'} />
          </g>
        ))}
        {hovered ? (
          <text x={Math.max(PAD_X, Math.min(W - PAD_X, hovered.x))} y={Math.max(10, hovered.y - 8)} textAnchor="middle"
            fill={hoveredIdx === points.length - 1 ? '#10b981' : '#d4d4d4'} fontSize={10} fontWeight={600}>
            {hovered.score}
          </text>
        ) : (
          <text x={Math.max(PAD_X, Math.min(W - PAD_X, last.x))} y={Math.max(10, last.y - 8)} textAnchor="middle"
            fill="#10b981" fontSize={10} fontWeight={600}>{last.score}</text>
        )}
      </svg>
      <div className="flex justify-between">
        <span className="text-[10px] text-neutral-500">{recent.length}회 전</span>
        <span className="text-[10px] text-neutral-500">최근</span>
      </div>
    </div>
  );
}

function AttendanceCalendar({ completions }: { completions: DailyCompletion[] }) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const activeDays = new Set<string>(completions.map((c) => c.date));

  const year = today.getFullYear();
  const month = today.getMonth();
  const firstDay = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startOffset = firstDay.getDay(); // 0=일

  const activeCount = Array.from({ length: daysInMonth }, (_, i) => {
    const d = new Date(year, month, i + 1);
    return activeDays.has(d.toLocaleDateString("en-CA"));
  }).filter(Boolean).length;

  const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs text-neutral-500">{year}년 {month + 1}월 출석</p>
        <span className="text-xs font-medium text-emerald-400">{activeCount}일 출석</span>
      </div>
      <div className="grid grid-cols-7 gap-px">
        {WEEKDAYS.map((d) => (
          <div key={d} className="text-center text-[10px] text-neutral-600 py-1">{d}</div>
        ))}
        {Array.from({ length: startOffset }, (_, i) => (
          <div key={`empty-${i}`} />
        ))}
        {Array.from({ length: daysInMonth }, (_, i) => {
          const dayNum = i + 1;
          const d = new Date(year, month, dayNum);
          const key = d.toLocaleDateString("en-CA");
          const active = activeDays.has(key);
          const isToday = d.getTime() === today.getTime();
          return (
            <div key={key} className="flex items-center justify-center py-0.5">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-medium ${
                active && isToday
                  ? "bg-emerald-400 text-black shadow-[0_0_6px_rgba(52,211,153,0.4)]"
                  : active
                  ? "bg-emerald-500/20 border border-emerald-500/40 text-emerald-400"
                  : isToday
                  ? "ring-1 ring-amber-500/60 text-amber-400"
                  : "text-neutral-600"
              }`}>
                {dayNum}
              </div>
            </div>
          );
        })}
      </div>

      {/* 오늘 미완료 시 유도 */}
      {!activeDays.has(today.toLocaleDateString("en-CA")) && (
        <div className="mt-3 flex items-center justify-between bg-amber-950/20 border border-amber-800/30 rounded-lg px-3 py-2">
          <p className="text-xs text-amber-500/80">오늘의 문제를 풀면 출석이 기록됩니다</p>
          <Link href="/#daily-challenge" className="text-xs text-amber-400 hover:text-amber-200 font-medium transition-colors">
            풀기 →
          </Link>
        </div>
      )}
    </div>
  );
}

export default function MyPage() {
  const router = useRouter();
  const { data: session, update } = useSession();

  const [showNicknameForm, setShowNicknameForm] = useState(false);
  const [nicknameInput, setNicknameInput] = useState('');
  const [nicknameError, setNicknameError] = useState('');
  const [nicknameSubmitting, setNicknameSubmitting] = useState(false);

  const [bio, setBio] = useState('');
  const [bioInput, setBioInput] = useState('');
  const [showBioForm, setShowBioForm] = useState(false);
  const [bioSubmitting, setBioSubmitting] = useState(false);

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
        const data = await res.json().catch(() => ({}));
        if (data.error === 'Same nickname') setNicknameError('현재와 동일한 닉네임입니다.');
        else if (res.status === 409) setNicknameError('이미 사용 중인 닉네임입니다.');
        else if (data.error === 'Inappropriate nickname') setNicknameError('부적절한 닉네임입니다.');
        else setNicknameError('오류가 발생했습니다.');
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

  async function handleBioSave(e: React.FormEvent) {
    e.preventDefault();
    if (bioSubmitting) return;
    setBioSubmitting(true);
    try {
      const res = await fetch('/api/mypage/bio', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bio: bioInput }),
      });
      if (!res.ok) { toast.error('오류가 발생했습니다.'); return; }
      const data = await res.json() as { bio: string | null };
      setBio(data.bio ?? '');
      setShowBioForm(false);
      toast.success('소개글이 저장되었습니다.');
    } finally {
      setBioSubmitting(false);
    }
  }

  const [chartSessions, setChartSessions] = useState<ChartSession[]>([]);
  const [categoryAttemptCounts, setCategoryAttemptCounts] = useState<Record<string, number>>({});
  const [categoryAccuracy, setCategoryAccuracy] = useState<Record<string, number>>({});
  const [stats, setStats] = useState<StatsData | null>(null);
  const [dailyCompletions, setDailyCompletions] = useState<DailyCompletion[]>([]);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [currentPageSessions, setCurrentPageSessions] = useState<ApiSession[]>([]);
  const [loading, setLoading] = useState(true);

  const [activeTab, setActiveTab] = useState<ActiveTab>("history");

  const [myQuestions, setMyQuestions] = useState<MyQuestion[] | null>(null);
  const [myQStatus, setMyQStatus] = useState<MyQStatus>("all");
  const [myQLoading, setMyQLoading] = useState(false);

  const [likedQuestions, setLikedQuestions] = useState<LikedQuestion[] | null>(null);
  const [likedLoading, setLikedLoading] = useState(false);
  const [likedFolder, setLikedFolder] = useState<string | null | 'all'>('all');
  const [folders, setFolders] = useState<BookmarkFolder[] | null>(null);
  const [showFolderInput, setShowFolderInput] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [folderMovingId, setFolderMovingId] = useState<string | null>(null);

  const [userPoints, setUserPoints] = useState<number | null>(null);
  const [weeklyGoals, setWeeklyGoals] = useState<WeeklyGoal[] | null>(null);
  const [weeklyGoalsLoading, setWeeklyGoalsLoading] = useState(false);
  const [showWeeklyGoals, setShowWeeklyGoals] = useState(false);
  const [showPointsModal, setShowPointsModal] = useState(false);
  const [pointsTransactions, setPointsTransactions] = useState<{ id: string; delta: number; reason: string; createdAt: string }[] | null>(null);
  const [profileVisibility, setProfileVisibility] = useState<'PUBLIC' | 'FRIENDS_ONLY' | 'PRIVATE'>('PUBLIC');
  const [visibilityLoading, setVisibilityLoading] = useState(false);

  type DrawerState = {
    questionId: string;
    prefetched?: ApiQuestion;
    userSelected?: number;
    questionNumber?: number;
  } | null;
  const [drawerState, setDrawerState] = useState<DrawerState>(null);

  const [historySort, setHistorySort] = useState<HistorySort>("newest");
  const [historyPage, setHistoryPage] = useState(0);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [myQSearch, setMyQSearch] = useState("");
  const [myQSort, setMyQSort] = useState<MyQSort>("newest");
  const [myQPage, setMyQPage] = useState(0);

  const [likedSearch, setLikedSearch] = useState("");
  const [likedCat, setLikedCat] = useState("all");
  const [likedPage, setLikedPage] = useState(0);

  const [earnedBadges, setEarnedBadges] = useState<{ badge: string; earnedAt: string }[] | null>(null);
  const [reviewInfo, setReviewInfo] = useState<{ dueIds: string[]; total: number } | null>(null);

  type MyComment = {
    id: string;
    content: string;
    createdAt: string;
    question: { id: string; category: string; question: string; status: string };
  };
  const [myComments, setMyComments] = useState<MyComment[] | null>(null);
  const [commentTotal, setCommentTotal] = useState(0);
  const [commentPageCount, setCommentPageCount] = useState(0);
  const [commentPage, setCommentPage] = useState(0);
  const [commentCat, setCommentCat] = useState("all");
  const [commentLoading, setCommentLoading] = useState(false);

  type BattleRecord = {
    id: string;
    opponent: { id: string; nickname: string };
    category: string;
    myScore: number;
    oppScore: number;
    result: 'win' | 'loss' | 'draw';
    playedAt: string;
  };
  const [battleRecords, setBattleRecords] = useState<BattleRecord[] | null>(null);
  const [battleLoading, setBattleLoading] = useState(false);
  const [battleOpponentId, setBattleOpponentId] = useState<string>('all');
  type BattleResult = 'all' | 'win' | 'draw' | 'loss';
  type BattleSort = 'newest' | 'oldest';
  const [battleResult, setBattleResult] = useState<BattleResult>('all');
  const [battleSort, setBattleSort] = useState<BattleSort>('newest');
  const [battlePage, setBattlePage] = useState(0);
  const BATTLE_PAGE_SIZE = 10;
  const [battleStats, setBattleStats] = useState({ wins: 0, losses: 0, draws: 0 });

  useEffect(() => {
    Promise.all([
      fetch("/api/mypage/stats").then((r) => r.json()),
      fetch("/api/mypage/sessions/summary").then((r) => r.json()),
      fetch("/api/mypage/liked-questions").then((r) => r.json()),
      fetch("/api/mypage/reviews").then((r) => r.json()).catch(() => ({ due: [], total: 0 })),
    ])
      .then(([statsData, summaryData, likedData, reviewData]) => {
        const sd = statsData as StatsData & { categoryAttemptCounts?: Record<string, number>; categoryAccuracy?: Record<string, number> };
        setStats(sd);
        if (sd.categoryAttemptCounts) setCategoryAttemptCounts(sd.categoryAttemptCounts);
        if (sd.categoryAccuracy) setCategoryAccuracy(sd.categoryAccuracy);
        setDailyCompletions(sd.dailyCompletions ?? []);
        const summary = summaryData as { sessions: ChartSession[]; total: number };
        setChartSessions(summary.sessions ?? []);
        setHistoryTotal(summary.total ?? 0);
        setLikedQuestions((likedData as { questions: LikedQuestion[] }).questions ?? []);
        const rd = reviewData as { due: { questionId: string }[]; total: number };
        setReviewInfo({ dueIds: (rd.due ?? []).map((d) => d.questionId), total: rd.total ?? 0 });
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

  // 폴더는 별도 effect — likedQuestions 선로드 여부와 무관하게 로드
  useEffect(() => {
    if (activeTab !== "liked" || folders !== null) return;
    fetch("/api/mypage/bookmark-folders")
      .then((r) => r.json())
      .then((data) => setFolders((data as { folders: BookmarkFolder[] }).folders ?? []))
      .catch(() => setFolders([]));
  }, [activeTab, folders]);

  useEffect(() => {
    if (activeTab !== "badges" || earnedBadges !== null) return;
    fetch("/api/mypage/badges")
      .then((r) => r.json())
      .then((data) => setEarnedBadges((data as { badges: { badge: string; earnedAt: string }[] }).badges ?? []))
      .catch(() => setEarnedBadges([]));
  }, [activeTab, earnedBadges]);

  const [battleTotal, setBattleTotal] = useState(0);

  useEffect(() => {
    if (activeTab !== "battle") return;
    setBattleLoading(true);
    const params = new URLSearchParams({ page: String(battlePage), sort: battleSort, result: battleResult });
    if (battleOpponentId !== 'all') params.set('opponentId', battleOpponentId);
    fetch(`/api/mypage/battle-history?${params}`)
      .then((r) => r.json())
      .then((data) => {
        const d = data as { records: BattleRecord[]; total: number; pageCount: number; totalWins: number; totalLosses: number; totalDraws: number };
        setBattleRecords(d.records ?? []);
        setBattleTotal(d.total ?? 0);
        setBattleStats({ wins: d.totalWins ?? 0, losses: d.totalLosses ?? 0, draws: d.totalDraws ?? 0 });
      })
      .catch(() => { setBattleRecords([]); setBattleTotal(0); setBattleStats({ wins: 0, losses: 0, draws: 0 }); })
      .finally(() => setBattleLoading(false));
  }, [activeTab, battleOpponentId, battleResult, battleSort, battlePage]);

  // 대전 기록 필터/정렬 변경 시 페이지 리셋
  useEffect(() => { setBattlePage(0); }, [battleResult, battleSort, battleOpponentId]);

  // 풀이 기록 탭 — 서버 페이지네이션
  useEffect(() => {
    if (activeTab !== "history") return;
    setHistoryLoading(true);
    const params = new URLSearchParams({
      page: String(historyPage),
      pageSize: String(HISTORY_PAGE_SIZE),
      sort: historySort,
    });
    fetch(`/api/mypage/sessions?${params}`)
      .then((r) => r.json())
      .then((data: { sessions: ApiSession[]; total: number }) => {
        setCurrentPageSessions(data.sessions ?? []);
        setHistoryTotal(data.total ?? 0);
      })
      .catch(() => setCurrentPageSessions([]))
      .finally(() => setHistoryLoading(false));
  }, [activeTab, historyPage, historySort]);

  useEffect(() => {
    if (activeTab !== "comments") return;
    setCommentLoading(true);
    const params = new URLSearchParams({ page: String(commentPage), cat: commentCat });
    fetch(`/api/mypage/comments?${params}`)
      .then((r) => r.json())
      .then((data) => {
        const d = data as { comments: MyComment[]; total: number; pageCount: number };
        setMyComments(d.comments ?? []);
        setCommentTotal(d.total ?? 0);
        setCommentPageCount(d.pageCount ?? 0);
      })
      .catch(() => setMyComments([]))
      .finally(() => setCommentLoading(false));
  }, [activeTab, commentPage, commentCat]);

  useEffect(() => { setCommentPage(0); }, [commentCat]);

  // 포인트 잔액 + 내역 + visibility + bio
  useEffect(() => {
    Promise.all([
      fetch("/api/mypage/points").then((r) => r.ok ? r.json() : null),
      fetch("/api/mypage/profile-visibility").then((r) => r.ok ? r.json() : null),
    ]).then(([pointsData, visData]) => {
      const pd = pointsData as { points: number; transactions: { id: string; delta: number; reason: string; createdAt: string }[] } | null;
      if (pd) {
        setUserPoints(pd.points);
        setPointsTransactions(pd.transactions ?? []);
      }
      const vd = visData as { visibility: 'PUBLIC' | 'FRIENDS_ONLY' | 'PRIVATE'; bio: string | null } | null;
      if (vd) {
        setProfileVisibility(vd.visibility);
        setBio(vd.bio ?? '');
      }
    }).catch(() => {});
  }, []);

  // 주간 목표 — 마운트 시 자동 로드 (배지 표시용)
  useEffect(() => {
    if (weeklyGoals !== null) return;
    setWeeklyGoalsLoading(true);
    fetch("/api/mypage/weekly-goals")
      .then((r) => r.json())
      .then((d: { goals: WeeklyGoal[] }) => setWeeklyGoals(d.goals ?? []))
      .catch(() => setWeeklyGoals([]))
      .finally(() => setWeeklyGoalsLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const profileStats = computeProfileStats(categoryAttemptCounts, categoryAccuracy);

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-white mb-1">마이페이지</h1>
        <p className="text-sm text-neutral-500">내 학습 기록과 통계를 확인하세요</p>
      </div>

      {/* 닉네임 + 포인트 + 프로필 공개설정 */}
      <div className="bg-[#111111] border border-neutral-800 rounded-lg p-4 mb-4">
        <div className="flex items-center justify-between">
          <div className="flex-1 min-w-0">
            <p className="text-xs text-neutral-500 mb-0.5">닉네임</p>
            <p className="text-sm text-white font-medium">{session?.user?.nickname ?? '–'}</p>
            {stats && (
              <p className="text-xs text-neutral-600 mt-0.5">
                총 {stats.totalSessions}회 완료 · 정답률 {stats.overallAccuracy}%
              </p>
            )}
            {userPoints !== null && (
              <div className="flex items-center gap-1.5 mt-1">
                <button
                  onClick={() => setShowPointsModal(true)}
                  className="flex items-center gap-1.5 text-xs text-amber-400 hover:text-amber-300 transition-colors group"
                  title="포인트 획득/사용 방법 및 내역 보기"
                >
                  <span className="font-semibold">{userPoints}P</span>
                  <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}
                    className="text-amber-500/60 group-hover:text-amber-400 transition-colors">
                    <circle cx={12} cy={12} r={10}/><path strokeLinecap="round" d="M12 16v-4m0-4h.01"/>
                  </svg>
                </button>
              </div>
            )}
            {stats && (() => {
              const li = getLevelInfo(stats.xp);
              const pct = li.requiredXp > 0 ? Math.min(100, Math.round((li.currentXp / li.requiredXp) * 100)) : 100;
              return (
                <div className="mt-2.5">
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="text-xs font-bold text-blue-400">Lv.{li.level}</span>
                    <div className="relative group">
                      <button
                        type="button"
                        aria-label="레벨과 경험치 설명"
                        className="w-4 h-4 rounded-full border border-neutral-700 text-neutral-500 text-[10px] leading-none flex items-center justify-center cursor-help hover:text-neutral-300 hover:border-neutral-500 transition-colors"
                      >
                        ?
                      </button>
                      <div className="absolute left-0 top-5 z-20 hidden group-hover:block group-focus-within:block w-64 bg-[#1a1a1a] border border-neutral-700 rounded-lg p-3 shadow-xl">
                        <p className="text-[11px] font-semibold text-white mb-1.5">유저 레벨 (최대 Lv.{MAX_LEVEL})</p>
                        <p className="text-[11px] text-neutral-400 mb-2.5 leading-snug">
                          활동으로 경험치를 모아 레벨을 올려요. 레벨이 오를수록 필요 경험치가 조금씩 늘어납니다.
                        </p>
                        <p className="text-[11px] font-semibold text-white mb-1.5">경험치 획득 기준</p>
                        <ul className="text-[11px] text-neutral-400 space-y-0.5">
                          <li>퀴즈 완료(오답복습 포함) · +{XP_REWARDS.QUIZ_BASE} +정답당 {XP_REWARDS.QUIZ_PER_CORRECT}</li>
                          <li>오늘의 문제 풀이(출석) · +{XP_REWARDS.DAILY}</li>
                          <li>등록한 문제 승인 · +{XP_REWARDS.QUESTION_APPROVED}</li>
                          <li>대전 승리 +{XP_REWARDS.BATTLE_WIN} / 무승부 +{XP_REWARDS.BATTLE_TIE} / 패배 +{XP_REWARDS.BATTLE_LOSS}</li>
                        </ul>
                      </div>
                    </div>
                    <span className="ml-auto text-[10px] text-neutral-500">
                      {li.requiredXp > 0 ? `${li.currentXp}/${li.requiredXp}` : 'MAX'}
                    </span>
                  </div>
                  <div className="h-1.5 bg-neutral-800 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })()}
          </div>
          <button
            onClick={() => { setShowNicknameForm((v) => !v); setNicknameInput(''); setNicknameError(''); }}
            className="text-xs text-neutral-400 border border-neutral-700 rounded px-3 py-1.5 hover:border-neutral-500 hover:text-white transition-colors flex-shrink-0 ml-3"
          >
            {showNicknameForm ? '취소' : '닉네임 변경'}
          </button>
        </div>

        {/* 공개 프로필 설정 */}
        <div className="mt-3 pt-3 border-t border-neutral-800/60">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              {session?.user?.nickname && profileVisibility !== 'PRIVATE' && (
                <a
                  href={`/u/${encodeURIComponent(session.user.nickname)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs font-medium text-white/80 hover:text-white border border-neutral-700 hover:border-neutral-500 rounded px-2.5 py-1 transition-colors"
                >
                  공개 프로필 보기 →
                </a>
              )}
              <span className="text-xs text-neutral-600">공개 설정</span>
            </div>
            <div className="flex items-center gap-1">
              {(['PUBLIC', 'FRIENDS_ONLY', 'PRIVATE'] as const).map((v) => {
                const labels = { PUBLIC: '공개', FRIENDS_ONLY: '친구만', PRIVATE: '비공개' };
                return (
                  <button
                    key={v}
                    disabled={visibilityLoading}
                    onClick={async () => {
                      if (profileVisibility === v || visibilityLoading) return;
                      setVisibilityLoading(true);
                      try {
                        const res = await fetch('/api/mypage/profile-visibility', {
                          method: 'PATCH',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ visibility: v }),
                        });
                        if (res.ok) setProfileVisibility(v);
                      } finally {
                        setVisibilityLoading(false);
                      }
                    }}
                    className={`text-[11px] px-2.5 py-1 rounded border transition-colors ${
                      profileVisibility === v
                        ? 'border-white/30 bg-white/10 text-white font-medium'
                        : 'border-neutral-800 text-neutral-500 hover:border-neutral-600 hover:text-neutral-300'
                    }`}
                  >
                    {labels[v]}
                  </button>
                );
              })}
            </div>
          </div>
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

        {/* 소개글 */}
        <div className="mt-3 pt-3 border-t border-neutral-800/60">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-xs text-neutral-500 mb-0.5">소개글</p>
              {bio ? (
                <p className="text-sm text-neutral-300 truncate">{bio}</p>
              ) : (
                <p className="text-sm text-neutral-600 italic">소개글 없음</p>
              )}
            </div>
            <button
              onClick={() => { setShowBioForm((v) => !v); setBioInput(bio); }}
              className="text-xs text-neutral-400 border border-neutral-700 rounded px-3 py-1.5 hover:border-neutral-500 hover:text-white transition-colors flex-shrink-0"
            >
              {showBioForm ? '취소' : '편집'}
            </button>
          </div>
          {showBioForm && (
            <form onSubmit={(e) => void handleBioSave(e)} className="mt-2 flex items-center gap-2">
              <div className="flex-1 relative">
                <input
                  type="text"
                  value={bioInput}
                  onChange={(e) => setBioInput(e.target.value.slice(0, 20))}
                  maxLength={20}
                  placeholder="20자 이하 소개글"
                  className="w-full rounded-md border border-neutral-800 bg-[#1a1a1a] px-3 py-2 text-sm text-white placeholder-neutral-600 focus:border-neutral-600 focus:outline-none transition-colors pr-10"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-neutral-600 pointer-events-none">
                  {bioInput.length}/20
                </span>
              </div>
              <button
                type="submit"
                disabled={bioSubmitting}
                className="rounded-md bg-white text-black text-sm font-medium px-4 py-2 hover:bg-neutral-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex-shrink-0"
              >
                {bioSubmitting ? '저장 중...' : '저장'}
              </button>
            </form>
          )}
        </div>
      </div>

      {/* 포인트 정보/내역 모달 */}
      {showPointsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" onClick={() => setShowPointsModal(false)}>
          <div className="w-full max-w-sm bg-[#111111] border border-neutral-700 rounded-xl shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-800">
              <h3 className="text-sm font-semibold text-white">포인트 안내</h3>
              <button onClick={() => setShowPointsModal(false)} className="text-neutral-500 hover:text-white transition-colors p-1">
                <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
              </button>
            </div>
            <div className="px-5 py-4">
              <p className="text-xs text-neutral-500 mb-3">포인트 획득 방법</p>
              <div className="space-y-2 mb-4">
                {[
                  { label: '퀴즈 완료 (정답률 70% 이상)', val: '+5P' },
                  { label: '퀴즈 완료 (정답률 70% 미만)', val: '+2P' },
                  { label: '주간 목표 달성 수령', val: '+15~30P' },
                ].map(({ label, val }) => (
                  <div key={label} className="flex items-center justify-between text-xs">
                    <span className="text-neutral-400">{label}</span>
                    <span className="text-emerald-400 font-medium">{val}</span>
                  </div>
                ))}
              </div>
              <p className="text-xs text-neutral-500 mb-3">포인트 사용</p>
              <div className="space-y-2 mb-4">
                {[{ label: '힌트 사용 (오답 보기 1개 제거)', val: '-20P' }].map(({ label, val }) => (
                  <div key={label} className="flex items-center justify-between text-xs">
                    <span className="text-neutral-400">{label}</span>
                    <span className="text-red-400 font-medium">{val}</span>
                  </div>
                ))}
              </div>
              <div className="border-t border-neutral-800 pt-3">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs text-neutral-500">최근 내역</p>
                  <span className="text-sm font-bold text-amber-400">{userPoints ?? 0}P</span>
                </div>
                {!pointsTransactions || pointsTransactions.length === 0 ? (
                  <p className="text-xs text-neutral-600 text-center py-3">내역이 없습니다</p>
                ) : (
                  <div className="space-y-1.5 max-h-48 overflow-y-auto">
                    {pointsTransactions.map((t) => {
                      const reasonLabel: Record<string, string> = {
                        HINT: '힌트 사용',
                        QUIZ_COMPLETE_HIGH: '퀴즈 완료 (고득점)',
                        QUIZ_COMPLETE_LOW: '퀴즈 완료',
                        WEEKLY_GOAL: '주간 목표 달성',
                      };
                      return (
                        <div key={t.id} className="flex items-center justify-between text-xs">
                          <span className="text-neutral-500">{reasonLabel[t.reason] ?? t.reason}</span>
                          <span className={t.delta > 0 ? 'text-emerald-400' : 'text-red-400'}>
                            {t.delta > 0 ? '+' : ''}{t.delta}P
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 요약 카드 */}
      {stats && (
        <div className="bg-[#111111] border border-neutral-800 rounded-lg p-5 mb-4">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-y-4">
            <div className="text-center flex-1">
              <p className="text-xs text-neutral-500 mb-1">총 퀴즈 횟수</p>
              <p className="text-2xl font-bold text-white">{stats.totalSessions}
                <span className="text-sm font-normal text-neutral-500">회</span>
              </p>
            </div>
            <div className="w-px h-10 bg-neutral-800" />
            <div className="text-center flex-1">
              <p className="text-xs text-neutral-500 mb-1">전체 정답률</p>
              <p className={`text-2xl font-bold ${stats.overallAccuracy >= 80 ? 'text-emerald-400' : stats.overallAccuracy >= 60 ? 'text-yellow-400' : 'text-white'}`}>
                {stats.overallAccuracy}
                <span className="text-sm font-normal text-neutral-500">%</span>
              </p>
            </div>
            <div className="w-px h-10 bg-neutral-800" />
            <div className="text-center flex-1">
              <p className="text-xs text-neutral-500 mb-1">연속 기록</p>
              <p className={`text-2xl font-bold ${stats.streakCount >= 7 ? 'text-amber-400' : stats.streakCount >= 3 ? 'text-amber-500/70' : 'text-white'}`}>
                {stats.streakCount}
                <span className="text-sm font-normal text-neutral-500">일</span>
              </p>
            </div>
          </div>
          {stats.weakestCategory && (
            <div className="flex items-center gap-2 mb-4 px-3 py-2 bg-red-950/20 border border-red-900/30 rounded-lg">
              <span className="text-[10px] text-neutral-500">약점 카테고리</span>
              <span className="text-xs font-medium text-red-400">
                {CATEGORY_LABELS[stats.weakestCategory as Category] ?? stats.weakestCategory}
              </span>
              <span className="text-[10px] text-neutral-600 ml-auto">집중 학습이 필요합니다</span>
            </div>
          )}
          <AttendanceCalendar completions={dailyCompletions} />
          {chartSessions.length >= 2 && <ScoreTrend sessions={chartSessions} />}
          <WeeklyReport sessions={chartSessions} />
        </div>
      )}

      {/* 주간 목표 */}
      <div className="bg-[#111111] border border-neutral-800 rounded-lg mb-4 overflow-hidden">
        <button
          className="w-full flex items-center justify-between px-4 py-3 hover:bg-[#1a1a1a] transition-colors"
          onClick={() => setShowWeeklyGoals((v) => !v)}
        >
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-white">주간 목표</span>
            {weeklyGoals && weeklyGoals.filter((g) => g.completed && !g.claimed).length > 0 && (
              <span className="text-[10px] font-bold bg-red-500 text-white rounded-full px-1.5 py-0.5">
                {weeklyGoals.filter((g) => g.completed && !g.claimed).length}
              </span>
            )}
          </div>
          <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
            className={`text-neutral-500 transition-transform ${showWeeklyGoals ? 'rotate-180' : ''}`}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        {showWeeklyGoals && (
          <div className="border-t border-neutral-800 px-4 py-4">
            {weeklyGoalsLoading ? (
              <p className="text-sm text-neutral-500 text-center py-4">불러오는 중...</p>
            ) : !weeklyGoals || weeklyGoals.length === 0 ? (
              <p className="text-sm text-neutral-500 text-center py-4">데이터를 불러올 수 없습니다.</p>
            ) : (
              <div className="space-y-3">
                {weeklyGoals.map((g) => (
                  <div key={g.key} className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className={`text-xs font-medium ${g.completed ? 'text-white' : 'text-neutral-400'}`}>
                          {g.label}
                        </span>
                        <span className="text-[10px] text-amber-500">+{g.points}P</span>
                        {g.claimed && (
                          <span className="text-[10px] text-neutral-600 border border-neutral-800 rounded px-1 py-0.5">수령완료</span>
                        )}
                      </div>
                      <p className="text-[11px] text-neutral-600 mb-1.5">{g.description}</p>
                      {g.key === 'CATEGORY_3' && g.categories && g.categories.length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-1.5">
                          {g.categories.map((cat) => (
                            <span key={cat} className="text-[10px] border border-neutral-700 text-neutral-500 rounded px-1.5 py-0.5">
                              {({ ds: '자료구조', algo: '알고리즘', os: 'OS', network: '네트워크', db: 'DB', arch: '컴퓨터구조', se: '소프트웨어공학' } as Record<string, string>)[cat] ?? cat}
                            </span>
                          ))}
                        </div>
                      )}
                      <div className="h-1 bg-neutral-800 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${g.completed ? 'bg-emerald-500' : 'bg-neutral-600'}`}
                          style={{ width: `${Math.min(100, (g.progress / g.target) * 100)}%` }}
                        />
                      </div>
                      <p className="text-[10px] text-neutral-600 mt-0.5">{g.progress} / {g.target}</p>
                    </div>
                    {g.completed && !g.claimed && (
                      <button
                        onClick={async () => {
                          try {
                            const r = await fetch('/api/mypage/weekly-goals', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ goalKey: g.key }),
                            });
                            if (r.ok) {
                              const d = await r.json() as { points: number; earned: number };
                              setUserPoints(d.points);
                              setWeeklyGoals((prev) => prev?.map((goal) =>
                                goal.key === g.key ? { ...goal, claimed: true } : goal
                              ) ?? null);
                              toast.success(`${g.points}P 획득!`);
                            } else if (r.status === 409) {
                              setWeeklyGoals((prev) => prev?.map((goal) =>
                                goal.key === g.key ? { ...goal, claimed: true } : goal
                              ) ?? null);
                            } else {
                              toast.error('수령에 실패했습니다.');
                            }
                          } catch {
                            toast.error('네트워크 오류가 발생했습니다.');
                          }
                        }}
                        className="flex-shrink-0 rounded-md bg-amber-500 text-black text-xs font-bold px-3 py-1.5 hover:bg-amber-400 transition-colors"
                      >
                        수령
                      </button>
                    )}
                  </div>
                ))}
                {(() => {
                  const d = new Date();
                  d.setHours(0, 0, 0, 0);
                  d.setDate(d.getDate() - ((d.getDay() + 6) % 7) + 7);
                  return (
                    <p className="text-[10px] text-neutral-600 pt-1">
                      매주 월요일 00:00 초기화 · 다음 초기화: {d.getMonth() + 1}월 {d.getDate()}일
                    </p>
                  );
                })()}
                <p className="text-[10px] text-neutral-700 pt-0.5">포인트는 퀴즈 힌트 사용에 활용됩니다 (힌트 20P)</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 복습 스케줄 */}
      {reviewInfo && reviewInfo.total > 0 && (
        <div className="bg-[#111111] border border-neutral-800 rounded-lg px-4 py-3 mb-4 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-1 mb-0.5">
              <p className="text-xs text-neutral-500">복습 스케줄</p>
              <div className="relative group/tip">
                <span className="text-neutral-700 text-xs cursor-default">ⓘ</span>
                <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 hidden group-hover/tip:block z-50 w-52">
                  <div className="bg-[#0a0a0a] border border-neutral-700 rounded-lg px-3 py-2 text-left shadow-xl">
                    <p className="text-[11px] font-medium text-white mb-1">간격 반복 복습</p>
                    <p className="text-[10px] text-neutral-400 leading-relaxed">틀린 문제가 1일→3일→7일→30일 간격으로 자동 등록됩니다. 맞추면 다음 단계로, 또 틀리면 1일로 리셋. 30일 단계 통과 시 완전 마스터.</p>
                  </div>
                </div>
              </div>
            </div>
            <p className="text-sm text-white">
              오늘{' '}
              <span className="font-semibold text-amber-400">{reviewInfo.dueIds.length}개</span>
              <span className="text-neutral-500 ml-1.5">전체 {reviewInfo.total}개</span>
            </p>
          </div>
          {reviewInfo.dueIds.length > 0 && (
            <button
              onClick={() => router.push(`/quiz/play?reviewIds=${reviewInfo.dueIds.join(',')}`)}
              className="text-xs rounded-md bg-amber-500 text-black font-medium px-3 py-1.5 hover:bg-amber-400 transition-colors flex-shrink-0"
            >
              복습 시작
            </button>
          )}
        </div>
      )}

      {/* 학습 진도 */}
      {stats?.categoryProgress && (() => {
        const cp = stats.categoryProgress;
        const totalQ = CATEGORY_ORDER.reduce((s, c) => s + (cp[c]?.total ?? 0), 0);
        const triedQ = CATEGORY_ORDER.reduce((s, c) => s + (cp[c]?.tried ?? 0), 0);
        const pct = totalQ > 0 ? Math.round((triedQ / totalQ) * 100) : 0;
        return (
          <div className="bg-[#111111] border border-neutral-800 rounded-lg p-4 mb-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold text-white">학습 진도</p>
              <span className="text-xs text-neutral-400">
                <span className="text-white font-semibold">{triedQ}</span>
                <span className="text-neutral-600"> / {totalQ}문제 도전 </span>
                <span className="text-neutral-500">({pct}%)</span>
              </span>
            </div>
            <div className="h-1.5 bg-neutral-800 rounded-full overflow-hidden mb-4">
              <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
            </div>
            <div className="grid grid-cols-2 gap-x-6 gap-y-2.5">
              {CATEGORY_ORDER.map((cat) => {
                const { total, tried } = cp[cat] ?? { total: 0, tried: 0 };
                const p = total > 0 ? Math.round((tried / total) * 100) : 0;
                return (
                  <div key={cat}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-neutral-400">{CATEGORY_LABELS[cat]}</span>
                      <span className="text-[10px] text-neutral-500">{tried}/{total}</span>
                    </div>
                    <div className="h-1 bg-neutral-800 rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-500/60 rounded-full" style={{ width: `${p}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* 카테고리별 프로필 */}
      <div className="mb-6">
        <div className="flex items-center gap-1.5 mb-3">
          <p className="text-sm font-semibold text-white">카테고리별 현황</p>
          <div className="relative group">
            <button
              type="button"
              aria-label="등급과 레벨 설명"
              className="w-4 h-4 rounded-full border border-neutral-700 text-neutral-500 text-[10px] leading-none flex items-center justify-center cursor-help hover:text-neutral-300 hover:border-neutral-500 transition-colors"
            >
              ?
            </button>
            <div className="absolute left-0 top-5 z-20 hidden group-hover:block group-focus-within:block w-64 bg-[#1a1a1a] border border-neutral-700 rounded-lg p-3 shadow-xl">
              <p className="text-[11px] font-semibold text-white mb-1.5">단계 (누적 풀이 횟수)</p>
              <ul className="text-[11px] text-neutral-400 space-y-0.5 mb-2.5">
                <li><span className="text-neutral-400 font-medium">입문</span> · 0~49회</li>
                <li><span className="text-blue-400 font-medium">학습</span> · 50~149회</li>
                <li><span className="text-emerald-400 font-medium">숙련</span> · 150~299회</li>
                <li><span className="text-yellow-400 font-medium">마스터</span> · 300회 이상</li>
              </ul>
              <p className="text-[11px] font-semibold text-white mb-1.5">등급 (정답률 · 학습 단계부터 측정)</p>
              <ul className="text-[11px] text-neutral-400 space-y-0.5">
                <li><span className="text-yellow-400 font-medium">GOLD</span> · 90% 이상</li>
                <li><span className="text-slate-300 font-medium">SILVER</span> · 60% 이상</li>
                <li><span className="text-amber-600 font-medium">BRONZE</span> · 30% 이상</li>
              </ul>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {profileStats.map(({ cat, label, total, accuracy, level, badge }) => {
            const info = LEVEL_INFO[level];
            const progress = getLevelProgress(total, level);
            const accColor = total === 0 ? 'text-neutral-600' : accuracy >= 80 ? 'text-emerald-400' : accuracy >= 60 ? 'text-yellow-400' : 'text-red-400';
            return (
              <button
                key={cat}
                onClick={() => router.push(`/mypage/${cat}`)}
                className="bg-[#111111] border border-neutral-800 rounded-xl p-4 text-left hover:bg-[#161616] transition-colors"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-white">{label}</span>
                  <div className="flex items-center gap-2">
                    {total > 0 && (
                      <span className={`text-sm font-bold ${accColor}`}>{accuracy}%</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 mb-3">
                  <span className={`text-sm font-bold ${info.text}`}>{info.name}</span>
                  {badge && <BadgePill tier={badge} />}
                </div>
                {level < 4 ? (
                  <div>
                    <div className="h-1.5 bg-neutral-800 rounded-full overflow-hidden mb-1">
                      <div className={`h-full rounded-full transition-all ${info.bar}`} style={{ width: `${progress}%` }} />
                    </div>
                    <p className="text-[10px] text-neutral-500">
                      {total} / {LEVEL_MAX[level]}회 완료
                    </p>
                  </div>
                ) : (
                  <p className="text-[10px] text-yellow-500/70">마스터 달성!</p>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* 탭 */}
      <div className="flex gap-1 mb-4 border-b border-neutral-800 pb-0 overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
        {(["history", "battle", "my-questions", "liked", "badges", "comments"] as ActiveTab[]).map((tab) => {
          const labels: Record<ActiveTab, string> = {
            history: "풀이 기록",
            battle: "대전",
            "my-questions": "등록 문제",
            liked: "북마크",
            badges: "업적",
            comments: "내 댓글",
          };
          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-shrink-0 px-3 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
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
          {loading || historyLoading ? (
            <div className="py-12 text-center">
              <p className="text-neutral-500 text-sm">불러오는 중...</p>
            </div>
          ) : historyTotal === 0 ? (
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
              <div className="flex items-center mb-3 gap-2 flex-wrap">
                <div className="flex gap-1 flex-wrap">
                  {(Object.keys(SORT_LABELS) as HistorySort[]).map((s) => (
                    <button
                      key={s}
                      onClick={() => { setHistorySort(s); setHistoryPage(0); setExpandedId(null); setDrawerState(null); }}
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
                <span className="ml-auto text-xs text-neutral-500">총 {historyTotal}회</span>
              </div>
              <div className="space-y-3">
                {currentPageSessions.map((session, idx) => {
                  const sessionIdx = historyPage * HISTORY_PAGE_SIZE + idx;
                  const isExpanded = expandedId === session.submittedAt;
                  const scoreColor =
                    session.score >= 17
                      ? "text-green-400"
                      : session.score >= 12
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
                          <span className="text-xs text-neutral-500 flex items-center gap-1.5 flex-wrap">
                            #{historySort === 'oldest' ? sessionIdx + 1 : historyTotal - sessionIdx}회 · {formatDate(session.submittedAt)}
                            {session.mode === 'review' && (
                              <span className="text-[10px] bg-blue-950/50 text-blue-400 border border-blue-900/50 rounded px-1.5 py-0.5">오답복습</span>
                            )}
                            {session.mode === 'timed' && (
                              <span className="text-[10px] bg-amber-950/50 text-amber-400 border border-amber-900/50 rounded px-1.5 py-0.5">시간제한</span>
                            )}
                          </span>
                          <div className="flex items-center gap-3 flex-shrink-0 ml-4">
                            <span className={`text-xl font-bold ${scoreColor}`}>
                              {session.score}
                              <span className="text-neutral-500 text-sm font-normal">
                                {" "}
                                / 20
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
                              <p className="text-xs text-neutral-400 mb-3">
                                오답 {wrongItems.length}문제
                              </p>
                              <div className="space-y-1">
                                {wrongItems.map((item) => (
                                  <button
                                    key={item.question.id}
                                    className="w-full text-left px-3 py-2.5 rounded-md hover:bg-[#1a1a1a] transition-colors flex items-center justify-between gap-3"
                                    onClick={() => setDrawerState({
                                      questionId: item.question.id,
                                      prefetched: item.question,
                                      userSelected: item.userAnswer!.selected,
                                      questionNumber: item.questionNumber,
                                    })}
                                  >
                                    <div className="flex items-center gap-2 min-w-0">
                                      <span className="text-xs text-neutral-500 flex-shrink-0">
                                        {item.questionNumber}.
                                      </span>
                                      <span className="text-xs text-neutral-500 border border-neutral-800 rounded px-1.5 py-0.5 flex-shrink-0">
                                        {item.question.category}
                                      </span>
                                      <span className="text-sm text-neutral-400 truncate">
                                        {item.question.question}
                                      </span>
                                    </div>
                                    <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="text-neutral-600 flex-shrink-0 -rotate-90">
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                                    </svg>
                                  </button>
                                ))}
                              </div>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              {Math.ceil(historyTotal / HISTORY_PAGE_SIZE) > 1 && (
                <div className="flex items-center justify-center gap-3 mt-4">
                  <button
                    onClick={() => { setHistoryPage((p) => Math.max(0, p - 1)); setExpandedId(null); setDrawerState(null); }}
                    disabled={historyPage === 0}
                    className="text-xs text-neutral-400 border border-neutral-800 rounded px-2.5 py-1 hover:border-neutral-600 hover:text-white disabled:opacity-30 transition-colors"
                  >←</button>
                  <span className="text-xs text-neutral-500">{historyPage + 1} / {Math.ceil(historyTotal / HISTORY_PAGE_SIZE)}</span>
                  <button
                    onClick={() => { setHistoryPage((p) => Math.min(Math.ceil(historyTotal / HISTORY_PAGE_SIZE) - 1, p + 1)); setExpandedId(null); setDrawerState(null); }}
                    disabled={historyPage >= Math.ceil(historyTotal / HISTORY_PAGE_SIZE) - 1}
                    className="text-xs text-neutral-400 border border-neutral-800 rounded px-2.5 py-1 hover:border-neutral-600 hover:text-white disabled:opacity-30 transition-colors"
                  >→</button>
                </div>
              )}
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
                <p className="text-xs text-neutral-500 mb-3">총 {filtered.length}개</p>
                <div className="space-y-3">
                  {paged.map((q) => {
                    const isRejected = q.status === "REJECTED";
                    return (
                      <button
                        key={q.id}
                        onClick={() => setDrawerState({ questionId: q.id })}
                        className={`w-full text-left bg-[#111111] rounded-lg p-4 hover:bg-[#161616] transition-colors ${
                          isRejected ? "border border-red-900/30" : "border border-neutral-800"
                        }`}
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
                            <span className="text-xs text-neutral-500">
                              {new Date(q.createdAt).toLocaleDateString("ko-KR")}
                            </span>
                          </div>
                        </div>
                        <p className="text-sm text-neutral-300 leading-relaxed line-clamp-2">{q.question}</p>
                        {isRejected && q.rejectionReason && (
                          <p className="text-xs text-red-400/70 mt-2 truncate">사유: {q.rejectionReason}</p>
                        )}
                      </button>
                    );
                  })}
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

      <QuestionDrawer
        open={drawerState !== null}
        questionId={drawerState?.questionId ?? null}
        prefetched={drawerState?.prefetched}
        userSelected={drawerState?.userSelected}
        questionNumber={drawerState?.questionNumber}
        onClose={() => setDrawerState(null)}
      />

      {/* 탭 2: 대전 기록 */}
      {activeTab === "battle" && (() => {
        const BATTLE_CAT_LABELS: Record<string, string> = {
          all: '전체', ds: '자료구조', algo: '알고리즘', os: '운영체제',
          network: '네트워크', db: '데이터베이스', arch: '컴퓨터 구조', se: '소프트웨어공학',
        };
        const RESULT_LABELS: Record<string, { text: string; cls: string }> = {
          win:  { text: '승', cls: 'text-emerald-400 border-emerald-800/60' },
          loss: { text: '패', cls: 'text-red-400 border-red-800/60' },
          draw: { text: '무', cls: 'text-neutral-400 border-neutral-700' },
        };
        const RESULT_FILTER_LABELS: Record<BattleResult, string> = {
          all: '전체', win: '승', draw: '무', loss: '패',
        };

        const allRecords = battleRecords ?? [];
        const opponents = Array.from(
          new Map(allRecords.map((r) => [r.opponent.id, r.opponent.nickname])).entries()
        );

        const paged = allRecords;
        const pageCount = Math.ceil(battleTotal / BATTLE_PAGE_SIZE);
        const { wins, losses, draws } = battleStats;

        return (
          <>
            {/* 상대별 필터 */}
            {opponents.length > 0 && (
              <div className="flex gap-1 flex-wrap mb-3 overflow-x-auto">
                <button
                  onClick={() => setBattleOpponentId('all')}
                  className={`px-2.5 py-1 rounded text-xs transition-colors flex-shrink-0 ${
                    battleOpponentId === 'all'
                      ? 'bg-white text-black font-medium'
                      : 'border border-neutral-800 text-neutral-400 hover:border-neutral-600 hover:text-white'
                  }`}
                >
                  전체
                </button>
                {opponents.map(([id, nick]) => (
                  <button
                    key={id}
                    onClick={() => setBattleOpponentId(id)}
                    className={`px-2.5 py-1 rounded text-xs transition-colors flex-shrink-0 ${
                      battleOpponentId === id
                        ? 'bg-white text-black font-medium'
                        : 'border border-neutral-800 text-neutral-400 hover:border-neutral-600 hover:text-white'
                    }`}
                  >
                    {nick}
                  </button>
                ))}
              </div>
            )}

            {/* 결과 필터 + 정렬 */}
            <div className="flex flex-wrap items-center gap-2 mb-4">
              <div className="flex gap-1">
                {(Object.keys(RESULT_FILTER_LABELS) as BattleResult[]).map((r) => (
                  <button
                    key={r}
                    onClick={() => setBattleResult(r)}
                    className={`px-2.5 py-1 rounded text-xs transition-colors ${
                      battleResult === r
                        ? 'bg-neutral-700 text-white font-medium'
                        : 'border border-neutral-800 text-neutral-400 hover:border-neutral-600 hover:text-white'
                    }`}
                  >
                    {RESULT_FILTER_LABELS[r]}
                  </button>
                ))}
              </div>
              <div className="w-px h-4 bg-neutral-800 self-center" />
              <div className="flex gap-1">
                {(['newest', 'oldest'] as BattleSort[]).map((s) => (
                  <button
                    key={s}
                    onClick={() => setBattleSort(s)}
                    className={`px-2.5 py-1 rounded text-xs transition-colors ${
                      battleSort === s
                        ? 'bg-white text-black font-medium'
                        : 'border border-neutral-800 text-neutral-400 hover:border-neutral-600 hover:text-white'
                    }`}
                  >
                    {s === 'newest' ? '최신순' : '오래된순'}
                  </button>
                ))}
              </div>
            </div>

            {battleLoading ? (
              <div className="py-12 text-center">
                <p className="text-neutral-500 text-sm">불러오는 중...</p>
              </div>
            ) : allRecords.length === 0 ? (
              <div className="py-12 text-center">
                <p className="text-neutral-500 text-sm">대전 기록이 없습니다.</p>
              </div>
            ) : (
              <>
                {/* 요약 */}
                <div className="flex gap-4 mb-4 text-center">
                  <div className="flex-1 bg-[#111111] border border-neutral-800 rounded-lg py-3">
                    <p className="text-xs text-neutral-500 mb-1">승</p>
                    <p className="text-lg font-bold text-emerald-400">{wins}</p>
                  </div>
                  <div className="flex-1 bg-[#111111] border border-neutral-800 rounded-lg py-3">
                    <p className="text-xs text-neutral-500 mb-1">무</p>
                    <p className="text-lg font-bold text-neutral-400">{draws}</p>
                  </div>
                  <div className="flex-1 bg-[#111111] border border-neutral-800 rounded-lg py-3">
                    <p className="text-xs text-neutral-500 mb-1">패</p>
                    <p className="text-lg font-bold text-red-400">{losses}</p>
                  </div>
                </div>

                {paged.length === 0 ? (
                  <div className="py-8 text-center">
                    <p className="text-neutral-500 text-sm">해당 조건의 대전 기록이 없습니다.</p>
                  </div>
                ) : (
                  <>
                    <p className="text-xs text-neutral-500 mb-3">총 {battleTotal}경기</p>
                    <div className="space-y-2">
                      {paged.map((r) => {
                        const res = RESULT_LABELS[r.result];
                        return (
                          <div
                            key={r.id}
                            className="bg-[#111111] border border-neutral-800 rounded-lg px-4 py-3 flex items-center justify-between gap-3"
                          >
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 mb-1 flex-wrap">
                                <span className="text-xs text-neutral-500 border border-neutral-800 rounded px-1.5 py-0.5 flex-shrink-0">
                                  {BATTLE_CAT_LABELS[r.category] ?? r.category}
                                </span>
                                <span className="text-sm font-medium text-neutral-200 truncate">
                                  vs {r.opponent.nickname}
                                </span>
                              </div>
                              <p className="text-[11px] text-neutral-600">
                                {new Date(r.playedAt).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })}
                                &nbsp;·&nbsp;{r.myScore} : {r.oppScore}
                              </p>
                            </div>
                            <span className={`text-xs font-bold border rounded px-2 py-0.5 flex-shrink-0 ${res.cls}`}>
                              {res.text}
                            </span>
                          </div>
                        );
                      })}
                    </div>

                    {pageCount > 1 && (
                      <div className="flex items-center justify-center gap-3 mt-4">
                        <button
                          onClick={() => setBattlePage((p) => Math.max(0, p - 1))}
                          disabled={battlePage === 0}
                          className="text-xs text-neutral-400 border border-neutral-800 rounded px-2.5 py-1 hover:border-neutral-600 hover:text-white disabled:opacity-30 transition-colors"
                        >←</button>
                        <span className="text-xs text-neutral-500">{battlePage + 1} / {pageCount}</span>
                        <button
                          onClick={() => setBattlePage((p) => Math.min(pageCount - 1, p + 1))}
                          disabled={battlePage >= pageCount - 1}
                          className="text-xs text-neutral-400 border border-neutral-800 rounded px-2.5 py-1 hover:border-neutral-600 hover:text-white disabled:opacity-30 transition-colors"
                        >→</button>
                      </div>
                    )}
                  </>
                )}
              </>
            )}
          </>
        );
      })()}

      {/* 탭 3: 북마크한 문제 */}
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

          {/* 폴더 필터 */}
          {folders && folders.length > 0 && (
            <div className="mb-3">
              <div className="flex gap-1 flex-wrap items-center">
                <button
                  onClick={() => { setLikedFolder('all'); setLikedPage(0); }}
                  className={`px-2.5 py-1 rounded text-xs transition-colors ${likedFolder === 'all' ? 'bg-white text-black font-medium' : 'border border-neutral-800 text-neutral-400 hover:border-neutral-600 hover:text-white'}`}
                >
                  전체
                </button>
                <button
                  onClick={() => { setLikedFolder(null); setLikedPage(0); }}
                  className={`px-2.5 py-1 rounded text-xs transition-colors ${likedFolder === null ? 'bg-white text-black font-medium' : 'border border-neutral-800 text-neutral-400 hover:border-neutral-600 hover:text-white'}`}
                >
                  미분류
                </button>
                {folders.map((f) => (
                  <button
                    key={f.id}
                    onClick={() => { setLikedFolder(f.id); setLikedPage(0); }}
                    className={`px-2.5 py-1 rounded text-xs transition-colors ${likedFolder === f.id ? 'bg-white text-black font-medium' : 'border border-neutral-800 text-neutral-400 hover:border-neutral-600 hover:text-white'}`}
                  >
                    {f.name} <span className="opacity-60">({f._count.likes})</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 폴더 관리 */}
          <div className="flex items-center gap-2 mb-4">
            <button
              onClick={() => setShowFolderInput((v) => !v)}
              className="text-xs text-neutral-500 border border-neutral-800 rounded px-2.5 py-1 hover:border-neutral-600 hover:text-white transition-colors"
            >
              + 폴더 만들기
            </button>
            {folders && folders.length > 0 && (
              <button
                onClick={async () => {
                  const target = folders.find((f) => f.id === likedFolder);
                  if (!target) return;
                  if (!confirm(`"${target.name}" 폴더를 삭제할까요? 소속 북마크는 미분류로 이동됩니다.`)) return;
                  const r = await fetch(`/api/mypage/bookmark-folders/${target.id}`, { method: 'DELETE' });
                  if (r.ok) {
                    setFolders((prev) => prev?.filter((f) => f.id !== target.id) ?? []);
                    setLikedFolder('all');
                    setLikedQuestions(null);
                    toast.success('폴더가 삭제되었습니다.');
                  }
                }}
                className={`text-xs text-red-500/60 hover:text-red-400 transition-colors ${typeof likedFolder === 'string' && likedFolder !== 'all' ? '' : 'hidden'}`}
              >
                폴더 삭제
              </button>
            )}
          </div>
          {showFolderInput && (
            <form
              className="flex gap-2 mb-3"
              onSubmit={async (e) => {
                e.preventDefault();
                if (!newFolderName.trim()) return;
                const r = await fetch('/api/mypage/bookmark-folders', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ name: newFolderName }),
                });
                if (r.ok) {
                  const d = await r.json() as { folder: { id: string; name: string } };
                  setFolders((prev) => [...(prev ?? []), { ...d.folder, _count: { likes: 0 } }]);
                  setNewFolderName('');
                  setShowFolderInput(false);
                  toast.success('폴더가 만들어졌습니다.');
                } else {
                  const err = await r.json() as { error: string };
                  toast.error(err.error === 'Max 10 folders' ? '폴더는 최대 10개까지 만들 수 있습니다.' : '이미 같은 이름의 폴더가 있습니다.');
                }
              }}
            >
              <input
                type="text"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                placeholder="폴더 이름 (최대 30자)"
                maxLength={30}
                className="flex-1 rounded-md border border-neutral-800 bg-[#111] px-3 py-1.5 text-sm text-white placeholder-neutral-600 focus:border-neutral-600 focus:outline-none transition-colors"
              />
              <button type="submit" className="rounded-md bg-white text-black text-xs font-medium px-3 py-1.5 hover:bg-neutral-200 transition-colors">만들기</button>
              <button type="button" onClick={() => setShowFolderInput(false)} className="text-xs text-neutral-500 hover:text-white transition-colors">취소</button>
            </form>
          )}

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
            const filtered = filterLiked(likedQuestions ?? [], likedSearch, likedCat, likedFolder);
            const pageCount = Math.ceil(filtered.length / HISTORY_PAGE_SIZE);
            const paged = filtered.slice(likedPage * HISTORY_PAGE_SIZE, (likedPage + 1) * HISTORY_PAGE_SIZE);
            if (filtered.length === 0) {
              return (
                <div className="text-center py-12">
                  <p className="text-neutral-500 text-sm mb-4">
                    {likedSearch || likedCat !== "all" || likedFolder !== 'all' ? "검색 결과가 없습니다." : "북마크한 문제가 없습니다."}
                  </p>
                  {!likedSearch && likedCat === "all" && likedFolder === 'all' && (
                    <Link href="/board" className="rounded-md bg-white text-black text-sm font-medium px-6 py-2.5 hover:bg-neutral-200 transition-colors">
                      게시판 보기
                    </Link>
                  )}
                </div>
              );
            }
            return (
              <>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs text-neutral-500">총 {filtered.length}개</p>
                  <button
                    onClick={() => {
                      const ids = filtered.slice(0, 30).map((q) => q.id).join(',');
                      router.push(`/quiz/play?reviewIds=${ids}`);
                    }}
                    className="text-xs text-white border border-neutral-700 rounded px-3 py-1.5 hover:bg-neutral-800 transition-colors"
                  >
                    퀴즈 시작 ({Math.min(filtered.length, 30)}문제)
                  </button>
                </div>
                <div className="space-y-2">
                  {paged.map((q) => (
                    <div key={q.id} className="bg-[#111111] border border-neutral-800 rounded-lg px-4 py-3 hover:bg-[#161616] transition-colors">
                      <div className="flex items-center gap-2 mb-1">
                        <button className="flex-1 text-left" onClick={() => setDrawerState({ questionId: q.id })}>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs text-neutral-500 border border-neutral-800 rounded px-2 py-0.5">
                              {CATEGORY_LABELS[q.category as Category] ?? q.category}
                            </span>
                            {q.folderId && folders && (
                              <span className="text-[10px] text-neutral-600 border border-neutral-800 rounded px-1.5 py-0.5">
                                {folders.find((f) => f.id === q.folderId)?.name ?? ''}
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-neutral-300 truncate">{q.question}</p>
                        </button>
                        {/* 폴더 이동 */}
                        {folderMovingId === q.id ? (
                          <div className="flex gap-1 flex-wrap flex-shrink-0">
                            {[{ id: null, name: '미분류' }, ...(folders ?? [])].map((f) => (
                              <button
                                key={String(f.id)}
                                onClick={async () => {
                                  const r = await fetch(`/api/questions/${q.id}/like`, {
                                    method: 'PATCH',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ folderId: f.id }),
                                  });
                                  if (r.ok) {
                                    setLikedQuestions((prev) => prev?.map((lq) =>
                                      lq.id === q.id ? { ...lq, folderId: f.id } : lq
                                    ) ?? null);
                                    setFolderMovingId(null);
                                    toast.success('이동했습니다.');
                                  }
                                }}
                                className={`text-[10px] px-2 py-0.5 rounded border transition-colors ${
                                  q.folderId === f.id
                                    ? 'border-white text-white'
                                    : 'border-neutral-700 text-neutral-500 hover:border-neutral-500 hover:text-white'
                                }`}
                              >
                                {f.name}
                              </button>
                            ))}
                            <button onClick={() => setFolderMovingId(null)} className="text-[10px] text-neutral-600 hover:text-white">✕</button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setFolderMovingId(q.id)}
                            className="text-[10px] text-neutral-600 border border-neutral-800 rounded px-1.5 py-0.5 hover:border-neutral-600 hover:text-white transition-colors flex-shrink-0"
                          >
                            폴더
                          </button>
                        )}
                      </div>
                    </div>
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

      {/* 탭 6: 내 댓글 */}
      {activeTab === "comments" && (
        <div>
          {/* 카테고리 필터 */}
          <div className="flex gap-1 flex-wrap mb-4">
            {(["all", ...Object.keys(CATEGORY_LABELS)] as string[]).map((cat) => (
              <button
                key={cat}
                onClick={() => setCommentCat(cat)}
                className={`px-2.5 py-1 rounded text-xs transition-colors ${
                  commentCat === cat
                    ? "bg-white text-black font-medium"
                    : "border border-neutral-800 text-neutral-400 hover:border-neutral-600 hover:text-white"
                }`}
              >
                {cat === "all" ? "전체" : CATEGORY_LABELS[cat as Category]}
              </button>
            ))}
          </div>

          {commentLoading ? (
            <div className="py-12 text-center text-neutral-500 text-sm">불러오는 중...</div>
          ) : !myComments || myComments.length === 0 ? (
            <div className="py-12 text-center text-neutral-500 text-sm">
              {commentCat !== "all" ? "해당 카테고리에 남긴 댓글이 없습니다." : "아직 댓글을 남기지 않았습니다."}
            </div>
          ) : (
            <>
              <div className="space-y-3 mb-4">
                {myComments.map((c) => (
                  <a
                    key={c.id}
                    href={`/board/${c.question.id}`}
                    className="block bg-[#111111] border border-neutral-800 rounded-lg px-4 py-3 hover:border-neutral-600 transition-colors"
                  >
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-[11px] text-neutral-500 border border-neutral-800 rounded px-1.5 py-0.5">
                        {CATEGORY_LABELS[c.question.category as Category] ?? c.question.category}
                      </span>
                      <span className="text-[11px] text-neutral-600">
                        {new Date(c.createdAt).toLocaleDateString("ko-KR", { month: "long", day: "numeric" })}
                      </span>
                    </div>
                    <p className="text-xs text-neutral-500 mb-1.5 line-clamp-1">
                      Q. {c.question.question}
                    </p>
                    <p className="text-sm text-neutral-300 leading-relaxed line-clamp-2">
                      {c.content}
                    </p>
                  </a>
                ))}
              </div>

              {commentPageCount > 1 && (
                <div className="flex items-center justify-center gap-3">
                  <button
                    disabled={commentPage === 0}
                    onClick={() => setCommentPage((p) => p - 1)}
                    className="text-xs text-neutral-400 border border-neutral-800 rounded px-2.5 py-1 hover:border-neutral-600 hover:text-white disabled:opacity-30 transition-colors"
                  >←</button>
                  <span className="text-xs text-neutral-500">{commentPage + 1} / {commentPageCount}</span>
                  <button
                    disabled={commentPage >= commentPageCount - 1}
                    onClick={() => setCommentPage((p) => p + 1)}
                    className="text-xs text-neutral-400 border border-neutral-800 rounded px-2.5 py-1 hover:border-neutral-600 hover:text-white disabled:opacity-30 transition-colors"
                  >→</button>
                  <span className="text-xs text-neutral-600 ml-2">총 {commentTotal}개</span>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* 탭 5: 업적 */}
      {activeTab === "badges" && (
        <div>
          {earnedBadges === null ? (
            <div className="py-12 text-center text-neutral-500 text-sm">불러오는 중...</div>
          ) : (
            <>
              <p className="text-xs text-neutral-400 mb-4">
                {earnedBadges.length}개 달성 / {ALL_BADGES.length}개 전체
              </p>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                {ALL_BADGES.map((badgeKey) => {
                  const meta = BADGE_META[badgeKey];
                  const earned = earnedBadges.find((b) => b.badge === badgeKey);
                  return (
                    <div
                      key={badgeKey}
                      className={`relative group flex flex-col items-center text-center p-3 rounded-lg border transition-colors ${
                        earned
                          ? "bg-[#111111] border-neutral-700"
                          : "bg-[#1a1a1a] border-neutral-800 opacity-50 grayscale"
                      }`}
                    >
                      <span className="text-2xl mb-1.5">{meta.icon}</span>
                      <span className="text-xs font-medium text-white leading-tight mb-0.5">{meta.label}</span>
                      <span className="text-[10px] text-neutral-400 leading-tight">{meta.description}</span>
                      {earned && (
                        <span className="text-[10px] text-neutral-500 mt-1">
                          {new Date(earned.earnedAt).toLocaleDateString("ko-KR", { month: "short", day: "numeric" })}
                        </span>
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
}
