import { NextRequest, NextResponse } from 'next/server';
import { searchCifra, CifraAccessError } from '@/lib/cifraclub';
import { buildChordPro } from '@/lib/chordpro';
import type { SongSearchResponse } from '@/lib/types';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const song = typeof body?.song === 'string' ? body.song.trim() : '';
  const artist = typeof body?.artist === 'string' ? body.artist.trim() : '';

  if (!song) {
    return NextResponse.json({ error: 'Informe ao menos o nome da música.' }, { status: 400 });
  }

  try {
    const candidates = await searchCifra(artist, song);
    if (candidates.length === 0) {
      return NextResponse.json(
        { error: 'Não encontrei essa música no Cifra Club.' },
        { status: 404 }
      );
    }

    const response: SongSearchResponse = {
      results: candidates.map((c) => ({
        chordpro: buildChordPro(
          { title: c.title, artist: c.artist, key: c.key, capo: c.capo, sourceUrl: c.sourceUrl },
          c.rawText
        ),
        title: c.title,
        artist: c.artist,
        key: c.key,
        capo: c.capo,
        sourceUrl: c.sourceUrl,
      })),
    };
    return NextResponse.json(response);
  } catch (err) {
    if (err instanceof CifraAccessError) {
      return NextResponse.json({ error: err.message }, { status: 502 });
    }
    const message = err instanceof Error ? err.message : 'Erro inesperado ao buscar a cifra.';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
