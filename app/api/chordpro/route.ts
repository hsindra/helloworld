import { NextRequest, NextResponse } from 'next/server';
import { findSongUrl, fetchCifra } from '@/lib/cifraclub';
import { buildChordPro } from '@/lib/chordpro';
import type { SongLookupResponse } from '@/lib/types';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const artist = typeof body?.artist === 'string' ? body.artist.trim() : '';
  const song = typeof body?.song === 'string' ? body.song.trim() : '';

  if (!artist || !song) {
    return NextResponse.json({ error: 'Informe artista e música.' }, { status: 400 });
  }

  try {
    const url = await findSongUrl(artist, song);
    if (!url) {
      return NextResponse.json(
        { error: 'Não encontrei essa música no Cifra Club.' },
        { status: 404 }
      );
    }

    const cifra = await fetchCifra(url);
    const chordpro = buildChordPro(
      {
        title: cifra.title,
        artist: cifra.artist,
        key: cifra.key,
        capo: cifra.capo,
        sourceUrl: cifra.sourceUrl,
      },
      cifra.rawText
    );

    const response: SongLookupResponse = {
      chordpro,
      title: cifra.title,
      artist: cifra.artist,
      key: cifra.key,
      capo: cifra.capo,
      sourceUrl: cifra.sourceUrl,
    };
    return NextResponse.json(response);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro inesperado ao buscar a cifra.';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
