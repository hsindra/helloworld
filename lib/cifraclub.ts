import * as cheerio from 'cheerio';
import { slugify } from './slugify';

type Node = {
  type: string;
  name?: string;
  data?: string;
  children?: Node[];
};

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

const BASE_URL = 'https://www.cifraclub.com.br';

interface FetchResult {
  ok: boolean;
  status: number;
  html: string | null;
}

async function fetchHtml(url: string): Promise<FetchResult> {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'text/html,application/xhtml+xml',
        'Accept-Language': 'pt-BR,pt;q=0.9',
      },
      redirect: 'follow',
    });
    if (!res.ok) return { ok: false, status: res.status, html: null };
    return { ok: true, status: res.status, html: await res.text() };
  } catch {
    return { ok: false, status: 0, html: null };
  }
}

/** Extracts text from a <pre> element, preserving line breaks and whitespace. */
function extractPreText(el: unknown): string {
  let out = '';
  const walk = (node: Node) => {
    if (node.type === 'text') {
      out += node.data ?? '';
    } else if (node.type === 'tag') {
      if (node.name === 'br') {
        out += '\n';
        return;
      }
      for (const child of node.children || []) walk(child);
    }
  };
  const root = el as Node;
  for (const child of root.children || []) walk(child);
  return out;
}

const CHORD_TOKEN = new RegExp(
  '^[A-G](#|b)?(m|maj|min|dim|aug|sus2|sus4|sus|add\\d{1,2})?(\\d{1,2})?(\\([^)]*\\))?(/[A-G](#|b)?m?)?$'
);

function scorePreAsCifra(text: string): number {
  const lines = text.split('\n').slice(0, 40);
  let score = 0;
  for (const line of lines) {
    const words = line.match(/\S+/g);
    if (!words || words.length === 0) continue;
    if (words.every((w) => CHORD_TOKEN.test(w))) score += words.length;
  }
  return score;
}

export interface CifraPage {
  title: string;
  artist: string;
  key?: string;
  capo?: string;
  rawText: string;
  sourceUrl: string;
}

function looksLikeSongPage(html: string): boolean {
  return /<pre/i.test(html) && /cifraclub/i.test(html);
}

/** Thrown when we can positively tell the request was blocked, so callers can
 * surface a clearer message than a plain "not found". */
export class CifraAccessError extends Error {
  status: number;
  constructor(status: number) {
    super(`Cifra Club recusou o acesso (HTTP ${status}).`);
    this.status = status;
  }
}

function extractSongLinks($: cheerio.CheerioAPI): string[] {
  const excluded =
    /^\/(busca|artistas|discografia|topGuitarra|video-aulas|mais-acessadas|colecoes|noticias)\b/i;
  const links: string[] = [];
  const seen = new Set<string>();
  $('a[href]').each((_, el) => {
    const href = $(el).attr('href') || '';
    let path: string;
    try {
      path = new URL(href, BASE_URL).pathname;
    } catch {
      return;
    }
    if (excluded.test(path)) return;
    const segments = path.split('/').filter(Boolean);
    if (segments.length !== 2) return;
    const normalized = `${BASE_URL}${path.endsWith('/') ? path : `${path}/`}`;
    if (seen.has(normalized)) return;
    seen.add(normalized);
    links.push(normalized);
  });
  return links;
}

/** Candidate song URLs from Cifra Club's own search page (unvalidated). */
async function searchCandidates(query: string): Promise<string[]> {
  const res = await fetchHtml(`${BASE_URL}/busca/?q=${encodeURIComponent(query)}`);
  if (res.status === 403) throw new CifraAccessError(403);
  if (!res.html) return [];
  const $ = cheerio.load(res.html);
  return extractSongLinks($);
}

/** Resolves a DuckDuckGo result-redirect href (or a direct href) to its real target URL. */
function resolveDdgTarget(href: string): string | null {
  try {
    const u = new URL(href.startsWith('//') ? `https:${href}` : href, 'https://duckduckgo.com');
    const uddg = u.searchParams.get('uddg');
    if (uddg) return decodeURIComponent(uddg);
    return href.startsWith('http') ? href : null;
  } catch {
    return null;
  }
}

/**
 * Candidate song URLs found via a site-restricted DuckDuckGo search (unvalidated).
 * Used as a fallback when Cifra Club's own internal search doesn't turn up a match
 * (e.g. because its results are rendered client-side, or the query doesn't match
 * well internally).
 */
async function duckDuckGoCandidates(query: string): Promise<string[]> {
  const q = encodeURIComponent(`site:cifraclub.com.br ${query}`);
  const res = await fetchHtml(`https://html.duckduckgo.com/html/?q=${q}`);
  if (!res.html) return [];
  const $ = cheerio.load(res.html);
  const links: string[] = [];
  const seen = new Set<string>();
  $('a[href]').each((_, el) => {
    const target = resolveDdgTarget($(el).attr('href') || '');
    if (!target) return;
    let url: URL;
    try {
      url = new URL(target);
    } catch {
      return;
    }
    if (!/(^|\.)cifraclub\.com\.br$/.test(url.hostname)) return;
    const segments = url.pathname.split('/').filter(Boolean);
    if (segments.length !== 2) return;
    const normalized = `${BASE_URL}/${segments.join('/')}/`;
    if (seen.has(normalized)) return;
    seen.add(normalized);
    links.push(normalized);
  });
  return links;
}

function pathSegments(url: string): [string, string] {
  try {
    const [a, b] = new URL(url).pathname.split('/').filter(Boolean);
    return [a || '', b || ''];
  } catch {
    return ['', ''];
  }
}

/** Rough 0-1 similarity between two slugs, used to rank candidates by how close
 * their artist matches the one the user typed (helps pick the right cover among
 * several artists who recorded the same song). */
function slugSimilarity(a: string, b: string): number {
  if (!a || !b) return 0;
  if (a === b) return 1;
  if (a.includes(b) || b.includes(a)) return 0.8;
  const ta = new Set(a.split('-'));
  const tb = new Set(b.split('-'));
  const intersection = [...ta].filter((t) => tb.has(t)).length;
  const union = new Set([...ta, ...tb]).size;
  return union ? intersection / union : 0;
}

const MAX_CANDIDATES_TO_CHECK = 8;
const MAX_RESULTS = 6;

/**
 * Searches Cifra Club for a song and returns every match we could confirm as a
 * real cifra page, ranked by how well it matches what was typed. The artist is
 * optional and the match doesn't need to be exact — callers are expected to
 * show the list and let the user pick the right one (useful when several
 * artists recorded the same song).
 */
export async function searchCifra(artist: string, song: string): Promise<CifraPage[]> {
  const trimmedArtist = artist.trim();
  const trimmedSong = song.trim();
  if (!trimmedSong) return [];

  const rawCandidates = new Set<string>();
  if (trimmedArtist) {
    rawCandidates.add(`${BASE_URL}/${slugify(trimmedArtist)}/${slugify(trimmedSong)}/`);
  }

  const query = [trimmedArtist, trimmedSong].filter(Boolean).join(' ');
  let blocked = false;
  const [internal, ddg] = await Promise.all([
    searchCandidates(query).catch((err) => {
      if (err instanceof CifraAccessError) blocked = true;
      return [] as string[];
    }),
    duckDuckGoCandidates(query),
  ]);
  for (const url of [...internal, ...ddg]) rawCandidates.add(url);

  if (rawCandidates.size === 0) {
    if (blocked) throw new CifraAccessError(403);
    return [];
  }

  const artistSlug = slugify(trimmedArtist);
  const songSlug = slugify(trimmedSong);
  const ranked = [...rawCandidates]
    .map((url) => {
      const [seg1, seg2] = pathSegments(url);
      const songScore = slugSimilarity(songSlug, seg2 || seg1);
      const score = artistSlug ? slugSimilarity(artistSlug, seg1) * 0.7 + songScore * 0.3 : songScore;
      return { url, score };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_CANDIDATES_TO_CHECK);

  const settled = await Promise.all(
    ranked.map(async ({ url }) => {
      try {
        return await fetchCifra(url);
      } catch (err) {
        if (err instanceof CifraAccessError) blocked = true;
        return null;
      }
    })
  );

  const results = settled.filter((r): r is CifraPage => r !== null);
  if (results.length === 0 && blocked) {
    throw new CifraAccessError(403);
  }

  // Dedupe in case the same song was found under equivalent paths.
  const dedup = new Map<string, CifraPage>();
  for (const r of results) {
    const key = `${slugify(r.artist)}|${slugify(r.title)}`;
    if (!dedup.has(key)) dedup.set(key, r);
  }
  return [...dedup.values()].slice(0, MAX_RESULTS);
}

export async function fetchCifra(url: string): Promise<CifraPage> {
  const res = await fetchHtml(url);
  if (res.status === 403) throw new CifraAccessError(403);
  if (!res.html) {
    throw new Error(`Não foi possível acessar ${url} (HTTP ${res.status || 'erro de rede'}).`);
  }
  const $ = cheerio.load(res.html);

  const candidates = $('pre')
    .toArray()
    .map((el) => {
      const text = extractPreText(el);
      return { text, score: scorePreAsCifra(text) };
    });
  const best = candidates.reduce<{ text: string; score: number } | null>(
    (acc, cur) => (!acc || cur.score > acc.score ? cur : acc),
    null
  );
  if (!best || best.score === 0) {
    throw new Error('Não encontrei a cifra (bloco de acordes) nessa página.');
  }

  const pageText = $('body').text();
  const keyMatch = pageText.match(/Tom\s*:?\s*([A-G](?:#|b)?m?)/);
  const capoMatch = pageText.match(/Capotraste\s*(?:na)?\s*(\d+)[ªº]?\s*casa/i);

  const title =
    $('h1.t1').first().text().trim() ||
    $('meta[property="og:title"]').attr('content')?.split(' - ')[0]?.trim() ||
    $('title').text().split(' - ')[0]?.trim() ||
    'Título desconhecido';

  const artist =
    $('h2.t3 a').first().text().trim() ||
    $('.cifra-header a[href^="/"]').first().text().trim() ||
    $('meta[property="og:title"]').attr('content')?.split(' - ')[1]?.trim() ||
    'Artista desconhecido';

  return {
    title,
    artist,
    key: keyMatch?.[1],
    capo: capoMatch?.[1],
    rawText: best.text,
    sourceUrl: url,
  };
}
