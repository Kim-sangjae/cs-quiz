import type { MetadataRoute } from 'next';

const BASE_URL = process.env.NEXTAUTH_URL ?? 'https://csora.co.kr';

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    { url: BASE_URL, lastModified: now, changeFrequency: 'daily', priority: 1 },
    { url: `${BASE_URL}/about`, lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${BASE_URL}/board`, lastModified: now, changeFrequency: 'daily', priority: 0.7 },
    { url: `${BASE_URL}/leaderboard`, lastModified: now, changeFrequency: 'daily', priority: 0.5 },
  ];
}
