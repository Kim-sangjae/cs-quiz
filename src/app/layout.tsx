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
  title: { default: 'CSORA', template: '%s | CSORA' },
  description: 'CS 기초 지식을 20문제로 점검하세요. 자료구조·알고리즘·OS·네트워크·DB·컴퓨터 구조·소프트웨어공학 7개 영역에서 랜덤 출제.',
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
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className="bg-[#0a0a0a] min-h-screen text-white antialiased">
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
