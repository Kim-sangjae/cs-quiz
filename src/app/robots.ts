import type { MetadataRoute } from 'next';

const BASE_URL = process.env.NEXTAUTH_URL ?? 'https://csora.co.kr';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        '/api/',
        '/admin',
        '/mypage',
        '/settings',
        '/friends',
        '/inquiry',
        '/board/submit',
        '/auth/',
        '/quiz',
        '/battle',
        '/u/',
      ],
    },
    sitemap: `${BASE_URL}/sitemap.xml`,
  };
}
