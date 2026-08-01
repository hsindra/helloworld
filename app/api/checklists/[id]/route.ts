import { NextRequest, NextResponse } from 'next/server';
import {
  deleteChecklist,
  getChecklist,
  getSong,
  saveChecklist,
  type ChecklistItem,
} from '@/lib/store';
import type { ResolvedChecklist } from '@/lib/types';

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

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const checklist = await getChecklist(params.id);
    if (!checklist) {
      return NextResponse.json({ error: 'Checklist não encontrado.' }, { status: 404 });
    }
    const songs = await Promise.all(checklist.items.map((item) => getSong(item.songId)));
    const resolved: ResolvedChecklist = {
      id: checklist.id,
      name: checklist.name,
      createdAt: checklist.createdAt,
      items: checklist.items.map((item, i) => ({
        songId: item.songId,
        preferredKey: item.preferredKey,
        song: songs[i],
      })),
    };
    return NextResponse.json({ checklist: resolved });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro ao buscar o checklist.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json().catch(() => null);
  const name = typeof body?.name === 'string' ? body.name.trim() : '';

  if (!name) {
    return NextResponse.json({ error: 'Informe o nome do checklist.' }, { status: 400 });
  }

  try {
    const existing = await getChecklist(params.id);
    if (!existing) {
      return NextResponse.json({ error: 'Checklist não encontrado.' }, { status: 404 });
    }
    const checklist = await saveChecklist({ id: params.id, name, items: parseItems(body) });
    return NextResponse.json({ checklist });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro ao salvar o checklist.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await deleteChecklist(params.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro ao apagar o checklist.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
