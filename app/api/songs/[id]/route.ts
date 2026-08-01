import { NextRequest, NextResponse } from 'next/server';
import { deleteSong, getSong, saveSong } from '@/lib/store';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const song = await getSong(params.id);
    if (!song) return NextResponse.json({ error: 'Música não encontrada.' }, { status: 404 });
    return NextResponse.json({ song });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro ao buscar a música salva.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json().catch(() => null);
  const title = typeof body?.title === 'string' ? body.title.trim() : '';
  const artist = typeof body?.artist === 'string' ? body.artist.trim() : '';
  const key = typeof body?.key === 'string' ? body.key.trim() : '';
  const chordpro = typeof body?.chordpro === 'string' ? body.chordpro : '';

  if (!title || !chordpro || !key) {
    return NextResponse.json(
      { error: 'Informe título, tom (necessário para a visualização em graus) e conteúdo ChordPro.' },
      { status: 400 }
    );
  }

  try {
    const existing = await getSong(params.id);
    if (!existing) return NextResponse.json({ error: 'Música não encontrada.' }, { status: 404 });

    const song = await saveSong({
      id: params.id,
      title,
      artist,
      key,
      capo: typeof body?.capo === 'string' ? body.capo : undefined,
      sourceUrl: typeof body?.sourceUrl === 'string' ? body.sourceUrl : existing.sourceUrl,
      chordpro,
    });
    return NextResponse.json({ song });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro ao salvar a música.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await deleteSong(params.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro ao apagar a música.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
