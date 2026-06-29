import { NextRequest, NextResponse } from 'next/server';
import { getServerUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { generateEmbedding, toVectorString } from '@/lib/embedding';
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const CATEGORY_PROMPTS: Record<string, string> = {
  ds: '자료구조 (배열, 스택, 큐, 연결 리스트, 트리, 그래프, 힙, 해시테이블)',
  algo: '알고리즘 (정렬, 이진탐색, DFS/BFS, 동적 프로그래밍, 그리디, 분할정복)',
  os: '운영체제 (프로세스, 스레드, 메모리 관리, 페이징, 스케줄링, 동기화, 교착상태)',
  network: '네트워크 (OSI 7계층, TCP/UDP, HTTP/HTTPS, DNS, 라우팅, 소켓)',
  db: '데이터베이스 (SQL, 인덱스, 트랜잭션, ACID, 정규화, NoSQL, 조인)',
  arch: '컴퓨터 구조 (CPU, 캐시, 파이프라인, 명령어 집합, 메모리 계층, 병렬처리)',
  se: '소프트웨어공학 (디자인패턴, SOLID, 애자일/스크럼, TDD, 리팩토링, CI/CD, 클린코드, UML, 소프트웨어 아키텍처)',
};

const SIMILARITY_THRESHOLD = 0.85;

const DIFFICULTY_PROMPTS: Record<string, string> = {
  easy: '기초 개념 확인 수준 (CS 입문자, 핵심 용어와 기본 원리 위주, 함정 없이 명확한 문제)',
  medium: '중급 수준 (학부 전공자, 개념 응용과 비교 분석, 실무 연관 문제)',
  hard: '고급 수준 (취업 면접·대학원 수준, 세부 동작 원리·엣지케이스·성능 트레이드오프 포함)',
};

interface GeneratedQuestion {
  question: string;
  options: [string, string, string, string];
  answer: 0 | 1 | 2 | 3;
  explanation: string;
}

export async function POST(req: NextRequest) {
  const user = await getServerUser();
  if (!user || user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json() as { category: string; count: number; difficulty?: string };
  const { category, count, difficulty = 'medium' } = body;

  if (!CATEGORY_PROMPTS[category]) {
    return NextResponse.json({ error: 'Invalid category' }, { status: 400 });
  }
  const safeCount = Math.min(50, Math.max(1, Math.floor(count)));
  const difficultyDesc = DIFFICULTY_PROMPTS[difficulty] ?? DIFFICULTY_PROMPTS.medium;

  // GPT-4o로 문제 생성
  const systemPrompt = `당신은 CS 전공 면접 문제 출제 전문가입니다.
주어진 주제에 대해 4지선다 객관식 문제를 JSON 형식으로 생성하세요.

규칙:
- 각 문제는 명확하고 모호하지 않아야 함
- 보기 4개는 서로 혼동될 만큼 그럴듯해야 함
- 설명은 왜 정답인지, 다른 보기가 왜 틀렸는지 간결하게 (100자 이내)
- 반드시 { "questions": [...] } 형태의 JSON 객체로만 출력`;

  const userPrompt = `${CATEGORY_PROMPTS[category]} 주제로 ${safeCount}개의 문제를 생성하세요.
난이도: ${difficultyDesc}

반환 형식:
{
  "questions": [
    {
      "question": "문제 내용",
      "options": ["보기1", "보기2", "보기3", "보기4"],
      "answer": 0,
      "explanation": "정답 설명"
    }
  ]
}`;

  let generated: GeneratedQuestion[];
  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.8,
    });

    const raw = completion.choices[0].message.content ?? '{"questions":[]}';
    const parsed = JSON.parse(raw) as { questions?: GeneratedQuestion[] } | GeneratedQuestion[];
    generated = Array.isArray(parsed) ? parsed : (parsed.questions ?? []);
  } catch (e) {
    console.error('[generate-questions] GPT error:', e);
    return NextResponse.json({ error: 'AI 생성 실패' }, { status: 500 });
  }

  // 중복 검사 + 저장
  let saved = 0;
  let skipped = 0;

  for (const q of generated) {
    if (
      typeof q.question !== 'string' ||
      !Array.isArray(q.options) || q.options.length !== 4 ||
      ![0, 1, 2, 3].includes(q.answer) ||
      typeof q.explanation !== 'string'
    ) continue;

    try {
      const embedding = await generateEmbedding(q.question);
      const vectorStr = toVectorString(embedding);

      // 유사도 0.85 이상 기존 문제 있으면 중복으로 판단
      const similar = await prisma.$queryRaw<{ id: string }[]>`
        SELECT id FROM "Question"
        WHERE embedding IS NOT NULL
          AND 1 - (embedding <=> ${vectorStr}::vector) > ${SIMILARITY_THRESHOLD}
        LIMIT 1
      `;

      if (similar.length > 0) {
        skipped++;
        continue;
      }

      // 저장 — embedding은 $executeRaw로 별도 업데이트
      const created = await prisma.question.create({
        data: {
          authorId: user.id,
          category,
          question: q.question,
          options: q.options,
          answer: q.answer,
          explanation: q.explanation,
          status: 'PENDING',
        },
      });

      await prisma.$executeRaw`
        UPDATE "Question" SET embedding = ${vectorStr}::vector WHERE id = ${created.id}
      `;

      saved++;
    } catch (e) {
      console.error('[generate-questions] save error:', e);
    }
  }

  return NextResponse.json({ generated: generated.length, saved, skipped });
}
