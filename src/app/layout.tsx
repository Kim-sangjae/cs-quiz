import type { Metadata, Viewport } from "next";
import "./globals.css";

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};
import Providers from "./providers";
import Header from "@/components/Header";
import ScrollButtons from "@/components/ScrollButtons";
import SessionGuard from "@/components/SessionGuard";
import FriendPanel from "@/components/FriendPanel";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXTAUTH_URL ?? 'http://localhost:3000'),
  title: { default: 'CS Quiz', template: '%s | CS Quiz' },
  description: 'CS 기초 지식을 30문제로 점검하세요. 자료구조·알고리즘·OS·네트워크·DB·컴퓨터 구조 6개 영역에서 랜덤 출제.',
  openGraph: {
    title: 'CS Quiz',
    description: 'CS 기초 지식을 30문제로 점검하세요',
    siteName: 'CS Quiz',
    locale: 'ko_KR',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'CS Quiz',
    description: 'CS 기초 지식을 30문제로 점검하세요',
  },
  appleWebApp: {
    capable: true,
    title: 'CS Quiz',
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
          <ScrollButtons />
          <FriendPanel />
          <SessionGuard />
        </Providers>
      </body>
    </html>
  );
}
