import Link from 'next/link';

export default function Footer() {
  return (
    <footer className="border-t border-neutral-800/60 mt-20">
      <div className="max-w-2xl mx-auto px-4 py-10">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-8">
          <div className="col-span-2 md:col-span-1">
            <p className="text-white font-bold text-base tracking-tight mb-1.5">CSORA</p>
            <p className="text-neutral-500 text-xs mb-1">CS + Aurora</p>
            <p className="text-neutral-600 text-xs leading-relaxed">
              누구나 CS를 배우며 자신만의<br />가능성을 빛낼 수 있는 공간
            </p>
          </div>

          <div>
            <p className="text-neutral-400 text-[11px] font-medium uppercase tracking-wider mb-3">서비스</p>
            <ul className="space-y-2">
              <li><Link href="/quiz" className="text-neutral-500 hover:text-white text-sm transition-colors">퀴즈 시작</Link></li>
              <li><Link href="/leaderboard" className="text-neutral-500 hover:text-white text-sm transition-colors">랭킹</Link></li>
              <li><Link href="/battle" className="text-neutral-500 hover:text-white text-sm transition-colors">1:1 대결</Link></li>
            </ul>
          </div>

          <div>
            <p className="text-neutral-400 text-[11px] font-medium uppercase tracking-wider mb-3">지원</p>
            <ul className="space-y-2">
              <li><Link href="/about" className="text-neutral-500 hover:text-white text-sm transition-colors">서비스 소개</Link></li>
              <li><Link href="/board/submit" className="text-neutral-500 hover:text-white text-sm transition-colors">문제 등록</Link></li>
              <li><Link href="/inquiry/new" className="text-neutral-500 hover:text-white text-sm transition-colors">문의하기</Link></li>
            </ul>
          </div>

          <div>
            <p className="text-neutral-400 text-[11px] font-medium uppercase tracking-wider mb-3">연락처</p>
            <a
              href="mailto:csoraquiz@gmail.com"
              className="text-neutral-500 hover:text-white text-sm transition-colors break-all"
            >
              csoraquiz@gmail.com
            </a>
          </div>
        </div>

        <div className="border-t border-neutral-800/60 pt-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-1.5">
          <p className="text-neutral-600 text-xs">© 2026 CSORA. All rights reserved.</p>
          <p className="text-neutral-700 text-xs">CS 학습자를 위해 만들었습니다</p>
        </div>
      </div>
    </footer>
  );
}
