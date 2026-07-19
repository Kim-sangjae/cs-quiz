import type { Metadata, Viewport } from "next";
import "./globals.css";

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};
import Providers from "./providers";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import ScrollButtons from "@/components/ScrollButtons";
import DragScroll from "@/components/DragScroll";
import SessionGuard from "@/components/SessionGuard";
import FriendPanel from "@/components/FriendPanel";
import BattleInviteAlert from "@/components/BattleInviteAlert";
import BattleRejectedAlert from "@/components/BattleRejectedAlert";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXTAUTH_URL ?? 'http://localhost:3000'),
  title: { default: 'CSORA - CS 퀴즈로 배우는 전공지식', template: '%s | CSORA' },
  description: 'CS(컴퓨터공학) 퀴즈로 자료구조·알고리즘·운영체제·네트워크·데이터베이스·컴퓨터구조·소프트웨어공학 7개 영역을 무료로 학습하세요. 20문제로 실력을 점검하고 친구와 1:1 대결도 할 수 있는 CS 전공 퀴즈 서비스, CSORA.',
  keywords: [
    'CS퀴즈', 'CS 퀴즈', '전공퀴즈', '컴퓨터공학 퀴즈', 'CS 전공지식',
    '자료구조', '알고리즘', '운영체제', '네트워크', '데이터베이스', '컴퓨터구조', '소프트웨어공학',
    '전산직 퀴즈', 'CS 스터디', '개발자 퀴즈',
  ],
  manifest: '/manifest.webmanifest',
  icons: {
    // PC 파비콘: 투명 배경 로고 / apple(iOS)만 흰 배경 유지
    icon: [{ url: '/icon-clear-512.png', type: 'image/png' }],
    apple: '/icon-512.png',
  },
  openGraph: {
    title: 'CSORA',
    description: 'CS 기초 지식을 20문제로 점검하세요',
    siteName: 'CSORA',
    locale: 'ko_KR',
    type: 'website',
    images: [{ url: '/og-image-dark.png', width: 1200, height: 630, alt: 'CSORA' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'CSORA',
    description: 'CS 기초 지식을 20문제로 점검하세요',
    images: ['/og-image-dark.png'],
  },
  appleWebApp: {
    capable: true,
    title: 'CSORA',
    statusBarStyle: 'black-translucent',
  },
  verification: {
    google: '6XWNQlKjpCXwXMjZBz1C8_u_ijaoTT_m7owcli9ascQ',
    other: {
      'naver-site-verification': '7d6282c5a65409c476b606c6b20c8bd473f21c1d',
    },
  },
};

const JSON_LD = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: 'CSORA',
  alternateName: 'CS + Aurora',
  url: process.env.NEXTAUTH_URL ?? 'https://csora.co.kr',
  description: 'CS(컴퓨터공학) 퀴즈로 자료구조·알고리즘·운영체제·네트워크·데이터베이스·컴퓨터구조·소프트웨어공학을 학습하는 서비스',
  inLanguage: 'ko-KR',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className="bg-[#0a0a0a] min-h-screen text-white antialiased">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }}
        />
        <Providers>
          <Header />
          {children}
          <Footer />
          <ScrollButtons />
          <DragScroll />
          <FriendPanel />
          <BattleInviteAlert />
          <BattleRejectedAlert />
          <SessionGuard />
        </Providers>
      </body>
    </html>
  );
}
