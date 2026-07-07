import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '서비스 소개',
  description: 'CSORA 서비스 소개 — CS 퀴즈, 문제 등록, 친구 대결, 오답 복습까지.',
};

const FEATURES = [
  {
    icon: '🎯',
    title: '분야별 CS 퀴즈',
    desc: '자료구조부터 네트워크까지, CS 핵심 영역에서 매번 다른 20문제를 뽑아 출제합니다. 틀린 문제는 해설과 함께 바로 확인할 수 있습니다.',
  },
  {
    icon: '📝',
    title: '누구나 문제 등록',
    desc: '문제 본문만 입력하면 AI가 오답 보기와 해설을 자동 생성합니다. 승인 후 공식 문제로 등록되며 기여도 순위에 반영.',
  },
  {
    icon: '🔁',
    title: '자동 오답 복습 스케줄',
    desc: '틀린 문제는 1일→3일→7일→30일 간격으로 자동 복습 일정이 잡힙니다. 맞히면 다음 단계로 넘어가고, 또 틀리면 처음부터 다시 시작합니다.',
  },
  {
    icon: '⚔️',
    title: '친구 대결 (실시간)',
    desc: '친구를 추가하고 카테고리를 골라 실시간 1:1 대결. 문제당 20초 제한, 자동 진행 모드로 긴장감 있게 풀 수 있습니다.',
  },
  {
    icon: '🏆',
    title: '레벨 & 업적 시스템',
    desc: '카테고리별 누적 풀이 횟수에 따라 입문 → 학습 → 숙련 → 마스터 레벨로 성장합니다. 퀴즈·대결·기여 등 다양한 활동으로 배지를 수집하세요.',
  },
  {
    icon: '📊',
    title: '마이페이지 분석',
    desc: '카테고리별 정답률·레벨·약점 카테고리 진단, 점수 추이 그래프, 출석 달력, 이번 주 통계 요약 제공.',
  },
];

const HOW_TO_SUBMIT = [
  { step: '①', text: '게시판 → 문제 등록 클릭' },
  { step: '②', text: '카테고리 선택 후 문제 본문 입력' },
  { step: '③', text: '정답 보기 하나를 입력하고 "오답 생성" 클릭 → AI가 나머지 3개 오답 자동 완성' },
  { step: '④', text: '해설이 비어 있으면 "해설 생성" 클릭 → AI가 자동 작성' },
  { step: '⑤', text: '검토 후 제출 → 관리자 승인 시 공식 문제로 등재' },
];

const CATEGORIES = [
  { key: 'ds', label: '자료구조', desc: '스택, 큐, 트리, 그래프, 해시맵 등' },
  { key: 'algo', label: '알고리즘', desc: '정렬, 탐색, DP, 그리디, 시간복잡도 등' },
  { key: 'os', label: '운영체제', desc: '프로세스, 스레드, 메모리, 스케줄링 등' },
  { key: 'network', label: '네트워크', desc: 'TCP/IP, HTTP, DNS, 보안 프로토콜 등' },
  { key: 'db', label: '데이터베이스', desc: 'SQL, 인덱스, 트랜잭션, 정규화 등' },
  { key: 'arch', label: '컴퓨터 구조', desc: 'CPU, 캐시, 명령어, 파이프라인 등' },
  { key: 'se', label: '소프트웨어공학', desc: '디자인패턴, SOLID, 애자일, TDD 등' },
];

export default function AboutPage() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      {/* 헤더 */}
      <div className="mb-10">
        <Link href="/" className="text-sm text-neutral-500 hover:text-white transition-colors">← 홈</Link>
        <h1 className="text-3xl font-bold text-white mt-4 mb-3">CSORA</h1>
        <p className="text-neutral-400 leading-relaxed">
          CS 기초 지식을 <span className="text-white font-medium">분야별 20문제</span>로 빠르게 점검하고,
          오답을 자동으로 복습하며, 친구와 실시간 대결할 수 있는 학습 플랫폼입니다.
        </p>
        <div className="flex gap-3 mt-5 flex-wrap">
          <Link href="/quiz" className="rounded-lg bg-white text-black text-sm font-semibold px-5 py-2.5 hover:bg-neutral-200 transition-colors">
            퀴즈 시작
          </Link>
          <Link href="/board/submit" className="rounded-lg border border-neutral-700 text-neutral-300 text-sm font-medium px-5 py-2.5 hover:border-neutral-500 hover:text-white transition-colors">
            문제 등록하기
          </Link>
        </div>
      </div>

      {/* 주요 기능 */}
      <section className="mb-10">
        <h2 className="text-lg font-semibold text-white mb-4">주요 기능</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {FEATURES.map((f) => (
            <div key={f.title} className="bg-[#111111] border border-neutral-800 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xl">{f.icon}</span>
                <span className="text-sm font-semibold text-white">{f.title}</span>
              </div>
              <p className="text-xs text-neutral-400 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 문제 등록 가이드 */}
      <section className="mb-10">
        <h2 className="text-lg font-semibold text-white mb-2">문제 등록 방법</h2>
        <p className="text-sm text-neutral-500 mb-4">
          AI가 오답 보기·해설을 자동으로 생성해 드립니다. 문제 본문과 정답 하나만 있으면 됩니다.
        </p>
        <div className="bg-[#111111] border border-neutral-800 rounded-xl divide-y divide-neutral-800">
          {HOW_TO_SUBMIT.map(({ step, text }) => (
            <div key={step} className="flex items-start gap-3 px-4 py-3">
              <span className="text-xs font-bold text-neutral-500 flex-shrink-0 mt-0.5">{step}</span>
              <p className="text-sm text-neutral-300">{text}</p>
            </div>
          ))}
        </div>
        <div className="mt-3 flex items-center gap-2 px-1">
          <span className="text-[11px] text-neutral-600">채택된 문제는 기여도 순위에 반영됩니다.</span>
          <Link href="/leaderboard" className="text-[11px] text-neutral-400 hover:text-white underline underline-offset-2 transition-colors">기여도 순위 보기</Link>
        </div>
      </section>

      {/* 출제 영역 */}
      <section className="mb-10">
        <h2 className="text-lg font-semibold text-white mb-4">출제 영역</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {CATEGORIES.map((c) => (
            <Link
              key={c.key}
              href={`/quiz/play?category=${c.key}`}
              className="bg-[#111111] border border-neutral-800 rounded-xl px-4 py-3 hover:bg-[#161616] transition-colors"
            >
              <p className="text-sm font-medium text-white mb-0.5">{c.label}</p>
              <p className="text-xs text-neutral-500">{c.desc}</p>
            </Link>
          ))}
        </div>
      </section>

      {/* 기여 안내 */}
      <section className="bg-[#0f0f0f] border border-neutral-800 rounded-xl px-5 py-5">
        <h2 className="text-base font-semibold text-white mb-2">같이 만들어 가는 문제 은행</h2>
        <p className="text-sm text-neutral-400 leading-relaxed mb-4">
          처음에는 100여 개 문제로 시작했지만, 사용자들의 제출로 계속 늘어나고 있습니다.
          제출한 문제가 승인되면 기여도 순위에 이름이 올라가고 업적 배지를 획득합니다.
          AI 자동 생성 덕분에 부담 없이 문제를 출제할 수 있습니다.
        </p>
        <Link
          href="/board/submit"
          className="inline-block rounded-lg bg-white text-black text-sm font-semibold px-4 py-2 hover:bg-neutral-200 transition-colors"
        >
          지금 문제 등록하기
        </Link>
      </section>
    </div>
  );
}
