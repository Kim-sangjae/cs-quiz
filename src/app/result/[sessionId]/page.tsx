import type { Metadata } from 'next';
import { prisma } from '@/lib/prisma';
import ResultClient from './ResultClient';

const CATEGORY_LABEL: Record<string, string> = {
  ds: '자료구조', algo: '알고리즘', os: '운영체제',
  network: '네트워크', db: '데이터베이스', arch: '컴퓨터 구조',
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}): Promise<Metadata> {
  const { sessionId } = await params;

  try {
    const session = await prisma.quizSession.findUnique({
      where: { id: sessionId },
      select: { score: true, category: true, questionIds: true },
    });

    if (!session) return { title: 'CS Quiz 결과' };

    const total = (session.questionIds as string[]).length;
    const pct = Math.round((session.score / total) * 100);
    const catLabel =
      session.category === 'all'
        ? '전체'
        : (CATEGORY_LABEL[session.category] ?? session.category);

    const title = `CS Quiz 결과 — ${session.score}/${total}점`;
    const description = `${catLabel} · 정답 ${session.score}개 · 오답 ${total - session.score}개 (${pct}%) | 나도 도전해보기`;

    return {
      title,
      description,
      openGraph: {
        title,
        description,
        type: 'website',
        images: [{ url: '/og-image-dark.png', width: 1200, height: 630, alt: 'CS Quiz' }],
      },
      twitter: {
        card: 'summary_large_image',
        title,
        description,
        images: ['/og-image-dark.png'],
      },
    };
  } catch {
    return { title: 'CS Quiz 결과' };
  }
}

export default async function ResultPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  return <ResultClient sessionId={sessionId} />;
}
