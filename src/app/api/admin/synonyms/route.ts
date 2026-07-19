import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { normalizeKey } from '@/lib/similar-search';

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== 'ADMIN') return null;
  return session;
}

function parseTerms(raw: unknown): string[] {
  const list = Array.isArray(raw) ? raw : (typeof raw === 'string' ? [raw] : []);
  const normalized = list
    .map((w) => (typeof w === 'string' ? normalizeKey(w.trim()) : ''))
    .filter((w) => w.length > 0);
  return [...new Set(normalized)];
}

export async function GET() {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const groups = await prisma.synonymGroup.findMany({
    include: { terms: true },
    orderBy: { createdAt: 'desc' },
  });
  return NextResponse.json(groups);
}

// 새 동의어 그룹 생성(terms만 전달) 또는 기존 그룹에 용어 추가(groupId 전달)
export async function POST(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await req.json() as { groupId?: unknown; terms?: unknown };
  const terms = parseTerms(body.terms);
  if (terms.length === 0) {
    return NextResponse.json({ error: 'Invalid terms' }, { status: 400 });
  }

  if (typeof body.groupId === 'string') {
    const group = await prisma.synonymGroup.findUnique({ where: { id: body.groupId } });
    if (!group) return NextResponse.json({ error: 'Group not found' }, { status: 404 });

    const results = await Promise.allSettled(
      terms.map((term) => prisma.synonymTerm.create({ data: { groupId: group.id, term } }))
    );
    const added = results.filter((r) => r.status === 'fulfilled').length;
    const skipped = results.filter((r) => r.status === 'rejected').length;
    return NextResponse.json({ added, skipped });
  }

  if (terms.length < 2) {
    return NextResponse.json({ error: '새 그룹은 2개 이상의 동의어가 필요합니다.' }, { status: 400 });
  }

  try {
    const group = await prisma.synonymGroup.create({
      data: {
        createdBy: session.user.id,
        terms: { create: terms.map((term) => ({ term })) },
      },
    });
    return NextResponse.json({ added: terms.length, skipped: 0, groupId: group.id });
  } catch {
    return NextResponse.json({ error: '이미 등록된 용어가 포함되어 있습니다.' }, { status: 409 });
  }
}

// 용어 하나 삭제. 그룹에 남은 용어가 없으면 그룹도 함께 삭제
export async function DELETE(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await req.json() as { id: unknown };
  if (typeof id !== 'string') return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

  const term = await prisma.synonymTerm.findUnique({ where: { id } });
  if (!term) return NextResponse.json({ ok: true });

  await prisma.synonymTerm.delete({ where: { id } });

  const remaining = await prisma.synonymTerm.count({ where: { groupId: term.groupId } });
  if (remaining === 0) {
    await prisma.synonymGroup.delete({ where: { id: term.groupId } });
  }

  return NextResponse.json({ ok: true });
}
