import { NextRequest, NextResponse } from 'next/server';
import { listChecklists, saveChecklist, type ChecklistItem } from '@/lib/store';

function parseItems(body: unknown): ChecklistItem[] {
  const raw = (body as { items?: unknown[] })?.items;
  if (!Array.isArray(raw)) return [];
  const items: ChecklistItem[] = [];
  for (const entry of raw) {
    const i = entry as { songId?: unknown; preferredKey?: unknown };
    if (typeof i?.songId === 'string' && typeof i?.preferredKey === 'string') {
      items.push({ songId: i.songId, preferredKey: i.preferredKey });
    }
  }
  return items;
}

export async function GET() {
  try {
    const checklists = await listChecklists();
    return NextResponse.json({ checklists });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro ao listar checklists.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const name = typeof body?.name === 'string' ? body.name.trim() : '';

  if (!name) {
    return NextResponse.json({ error: 'Informe o nome do checklist.' }, { status: 400 });
  }

  try {
    const checklist = await saveChecklist({ name, items: parseItems(body) });
    return NextResponse.json({ checklist });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro ao salvar o checklist.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
