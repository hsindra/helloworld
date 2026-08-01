import { NextRequest, NextResponse } from 'next/server';
import {
  deleteSetlist,
  getSetlist,
  getSong,
  saveSetlist,
  type SetlistItem,
} from '@/lib/store';
import type { ResolvedSetlist } from '@/lib/types';

function parseItems(body: unknown): SetlistItem[] {
  const raw = (body as { items?: unknown[] })?.items;
  if (!Array.isArray(raw)) return [];
  const items: SetlistItem[] = [];
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
    const setlist = await getSetlist(params.id);
    if (!setlist) {
      return NextResponse.json({ error: 'Setlist não encontrado.' }, { status: 404 });
    }
    const songs = await Promise.all(setlist.items.map((item) => getSong(item.songId)));
    const resolved: ResolvedSetlist = {
      id: setlist.id,
      name: setlist.name,
      createdAt: setlist.createdAt,
      items: setlist.items.map((item, i) => ({
        songId: item.songId,
        preferredKey: item.preferredKey,
        song: songs[i],
      })),
    };
    return NextResponse.json({ setlist: resolved });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro ao buscar o setlist.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json().catch(() => null);
  const name = typeof body?.name === 'string' ? body.name.trim() : '';

  if (!name) {
    return NextResponse.json({ error: 'Informe o nome do setlist.' }, { status: 400 });
  }

  try {
    const existing = await getSetlist(params.id);
    if (!existing) {
      return NextResponse.json({ error: 'Setlist não encontrado.' }, { status: 404 });
    }
    const setlist = await saveSetlist({ id: params.id, name, items: parseItems(body) });
    return NextResponse.json({ setlist });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro ao salvar o setlist.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await deleteSetlist(params.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro ao apagar o setlist.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
