import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { getServerUser } from '@/lib/auth';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(req: NextRequest) {
  const user = await getServerUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json() as { question?: unknown; answer?: unknown };
  const { question, answer } = body;

  if (typeof question !== 'string' || question.trim().length === 0) {
    return NextResponse.json({ error: 'question 필드가 필요합니다.' }, { status: 400 });
  }
  if (typeof answer !== 'string' || answer.trim().length === 0) {
    return NextResponse.json({ error: 'answer 필드가 필요합니다.' }, { status: 400 });
  }

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content:
          'CS(컴퓨터과학) 퀴즈 문제의 오답 보기와 해설을 생성하는 전문가입니다. ' +
          '정답과 헷갈릴 만큼 그럴듯하지만 명백히 틀린 오답 3개를 만들고, ' +
          '왜 정답이 맞는지 핵심 개념을 1~2문장으로 설명하는 해설을 작성하세요. ' +
          '반드시 다음 형식의 JSON으로만 응답하세요: {"distractors": ["오답1", "오답2", "오답3"], "explanation": "해설 내용"}',
      },
      {
        role: 'user',
        content: `문제: ${question}\n정답: ${answer}`,
      },
    ],
    temperature: 0.7,
    max_tokens: 500,
    response_format: { type: 'json_object' },
  });

  const raw = completion.choices[0]?.message?.content ?? '{}';

  let distractors: string[] = [];
  let explanation = '';
  try {
    const parsed = JSON.parse(raw) as { distractors?: unknown; explanation?: unknown };
    if (Array.isArray(parsed.distractors)) {
      distractors = parsed.distractors.filter((v): v is string => typeof v === 'string').slice(0, 3);
    }
    if (typeof parsed.explanation === 'string') {
      explanation = parsed.explanation;
    }
  } catch {
    return NextResponse.json({ error: '생성 결과 파싱에 실패했습니다.' }, { status: 500 });
  }

  if (distractors.length < 3) {
    return NextResponse.json({ error: '오답 보기 생성에 실패했습니다.' }, { status: 500 });
  }

  return NextResponse.json({ distractors, explanation });
}
