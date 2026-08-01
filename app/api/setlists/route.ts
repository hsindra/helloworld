import { NextRequest, NextResponse } from 'next/server';
import { listSetlists, saveSetlist, type SetlistItem } from '@/lib/store';

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

export async function GET() {
  try {
    const setlists = await listSetlists();
    return NextResponse.json({ setlists });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro ao listar setlists.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const name = typeof body?.name === 'string' ? body.name.trim() : '';

  if (!name) {
    return NextResponse.json({ error: 'Informe o nome do setlist.' }, { status: 400 });
  }

  try {
    const setlist = await saveSetlist({ name, items: parseItems(body) });
    return NextResponse.json({ setlist });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro ao salvar o setlist.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
