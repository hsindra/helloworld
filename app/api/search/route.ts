import { NextRequest, NextResponse } from 'next/server';
import {
  searchCifra,
  fetchCifra,
  normalizeCifraUrl,
  CifraAccessError,
  CifraNotFoundError,
  SearchConfigError,
} from '@/lib/cifraclub';
import { buildChordPro, convertChordProToNashville } from '@/lib/chordpro';
import { isMinorKey, relativeMajorKey } from '@/lib/transpose';
import { listSongs, type SavedSong } from '@/lib/store';
import { songMatchScore, MATCH_THRESHOLD } from '@/lib/fuzzyMatch';
import type { CifraPage } from '@/lib/cifraclub';
import type { SongLookupResponse, SongSearchResponse } from '@/lib/types';

/** Thrown when a cifra page didn't expose a detectable "Tom:" — without a key
 * there's no safe way to convert its chords into graus, so it can't be
 * returned (see Discovery/cifras-em-graus.md). */
class MissingKeyError extends Error {
  constructor() {
    super('Não foi possível identificar o tom desta cifra, então não é possível salvá-la em graus.');
  }
}

function savedToResult(s: SavedSong): SongLookupResponse {
  return {
    id: s.id,
    chordpro: s.chordpro,
    title: s.title,
    artist: s.artist,
    key: s.key,
    preferredKey: s.preferredKey,
    capo: s.capo,
    sourceUrl: s.sourceUrl ?? '',
  };
}

function toSongResult(c: CifraPage): SongLookupResponse {
  if (!c.key) throw new MissingKeyError();
  // Músicas detectadas em tom menor são reapresentadas no relativo maior
  // (grau 1 = tônica do maior) — ver relativeMajorKey em lib/transpose.ts e
  // o disclaimer renderizado em ChordProView a partir de originalMinorKey.
  const originalMinorKey = isMinorKey(c.key) ? c.key : undefined;
  const effectiveKey = originalMinorKey ? relativeMajorKey(originalMinorKey) : c.key;
  const chordproConcrete = buildChordPro(
    {
      title: c.title,
      artist: c.artist,
      key: effectiveKey,
      originalMinorKey,
      capo: c.capo,
      sourceUrl: c.sourceUrl,
    },
    c.rawText
  );
  return {
    chordpro: convertChordProToNashville(chordproConcrete, effectiveKey),
    title: c.title,
    artist: c.artist,
    key: effectiveKey,
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

    const [saved, webSearch] = await Promise.all([
      listSongs().catch(() => [] as SavedSong[]), // busca não deve quebrar se o KV não estiver configurado
      searchCifra(artist, song).then(
        (candidates) => ({ ok: true as const, candidates }),
        (error) => ({ ok: false as const, error })
      ),
    ]);

    const query = [artist, song].filter(Boolean).join(' ');
    const savedMatches = saved
      .map((s) => ({ s, score: songMatchScore(query, s.title, s.artist) }))
      .filter((m) => m.score >= MATCH_THRESHOLD)
      .sort((a, b) => b.score - a.score)
      .map((m) => m.s);
    const savedUrls = new Set(savedMatches.map((s) => s.sourceUrl).filter(Boolean));

    const results: SongLookupResponse[] = savedMatches.map(savedToResult);

    if (!webSearch.ok) {
      // Sem músicas salvas pra mostrar, o erro da busca na internet é o único
      // resultado possível — propaga. Com salvas, elas bastam como resposta.
      if (results.length === 0) throw webSearch.error;
    } else {
      for (const c of webSearch.candidates) {
        if (c.sourceUrl && savedUrls.has(c.sourceUrl)) continue; // já apareceu como salva
        try {
          results.push(toSongResult(c));
        } catch (err) {
          if (err instanceof MissingKeyError) continue; // sem tom, não dá pra salvar em graus
          throw err;
        }
      }
    }

    const response: SongSearchResponse = { results };
    return NextResponse.json(response);
  } catch (err) {
    if (err instanceof MissingKeyError) {
      return NextResponse.json({ error: err.message }, { status: 422 });
    }
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
