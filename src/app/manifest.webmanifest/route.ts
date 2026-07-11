import { NextRequest, NextResponse } from 'next/server';

// UA 기반 manifest 아이콘 분기:
// - 모바일(Android): 흰 배경 maskable (런처가 원형/스쿼클로 마스킹)
// - PC: 투명 배경 로고만 제공 — 데스크탑 Chrome이 maskable(흰배경)을
//   설치 아이콘으로 우선 사용하는 문제를 원천 차단
export function GET(req: NextRequest) {
  const ua = req.headers.get('user-agent') ?? '';
  const isMobile = /Android|iPhone|iPad|Mobile/i.test(ua);

  const icons = isMobile
    ? [
        { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
        { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
        { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
        { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      ]
    : [
        { src: '/icon-clear-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      ];

  return NextResponse.json(
    {
      name: 'CSORA',
      short_name: 'CSORA',
      description: '6개 영역 CS 기초 지식을 20문제로 빠르게 점검하세요',
      start_url: '/',
      display: 'standalone',
      background_color: '#0a0a0a',
      theme_color: '#0a0a0a',
      icons,
    },
    { headers: { 'Content-Type': 'application/manifest+json' } }
  );
}
