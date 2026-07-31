import { NextRequest, NextResponse } from 'next/server';
import {
  searchCifra,
  fetchCifra,
  normalizeCifraUrl,
  CifraAccessError,
  CifraNotFoundError,
  SearchConfigError,
} from '@/lib/cifraclub';
import { buildChordPro } from '@/lib/chordpro';
import type { CifraPage } from '@/lib/cifraclub';
import type { SongSearchResponse } from '@/lib/types';

function toSongResult(c: CifraPage) {
  return {
    chordpro: buildChordPro(
      { title: c.title, artist: c.artist, key: c.key, capo: c.capo, sourceUrl: c.sourceUrl },
      c.rawText
    ),
    title: c.title,
    artist: c.artist,
    key: c.key,
    capo: c.capo,
    sourceUrl: c.sourceUrl,
  };
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const rawUrl = typeof body?.url === 'string' ? body.url.trim() : '';

  try {
    if (rawUrl) {
      const url = normalizeCifraUrl(rawUrl);
      if (!url) {
        return NextResponse.json(
          { error: 'Essa URL não parece ser do Cifra Club (cifraclub.com.br).' },
          { status: 400 }
        );
      }
      const page = await fetchCifra(url);
      const response: SongSearchResponse = { results: [toSongResult(page)] };
      return NextResponse.json(response);
    }

    const song = typeof body?.song === 'string' ? body.song.trim() : '';
    const artist = typeof body?.artist === 'string' ? body.artist.trim() : '';
    if (!song) {
      return NextResponse.json({ error: 'Informe ao menos o nome da música.' }, { status: 400 });
    }

    const candidates = await searchCifra(artist, song);
    const response: SongSearchResponse = { results: candidates.map(toSongResult) };
    return NextResponse.json(response);
  } catch (err) {
    if (err instanceof CifraNotFoundError) {
      return NextResponse.json({ error: err.message }, { status: 404 });
    }
    if (err instanceof SearchConfigError) {
      return NextResponse.json({ error: err.message }, { status: 500 });
    }
    if (err instanceof CifraAccessError) {
      return NextResponse.json({ error: err.message }, { status: 502 });
    }
    const message = err instanceof Error ? err.message : 'Erro inesperado ao buscar a cifra.';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
