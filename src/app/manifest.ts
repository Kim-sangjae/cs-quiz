import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'CSORA',
    short_name: 'CSORA',
    description: '6개 영역 CS 기초 지식을 20문제로 빠르게 점검하세요',
    start_url: '/',
    display: 'standalone',
    background_color: '#0a0a0a',
    theme_color: '#0a0a0a',
    icons: [
      // any(PC 창·작업표시줄): 투명 배경 로고 / maskable(Android 런처): 흰 배경
      { src: '/icon-clear-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
