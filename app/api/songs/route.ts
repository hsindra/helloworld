import { NextRequest, NextResponse } from 'next/server';
import { listSongs, saveSong } from '@/lib/store';

export async function GET() {
  try {
    const songs = await listSongs();
    return NextResponse.json({ songs });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro ao listar músicas salvas.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
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
    const song = await saveSong({
      title,
      artist,
      key,
      capo: typeof body?.capo === 'string' ? body.capo : undefined,
      sourceUrl: typeof body?.sourceUrl === 'string' ? body.sourceUrl : undefined,
      chordpro,
    });
    return NextResponse.json({ song });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro ao salvar a música.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
