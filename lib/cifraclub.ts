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

async function guessDirectUrl(artist: string, song: string): Promise<string | null> {
  const url = `${BASE_URL}/${slugify(artist)}/${slugify(song)}/`;
  const res = await fetchHtml(url);
  if (res.status === 403) throw new CifraAccessError(403);
  if (res.html && looksLikeSongPage(res.html)) return url;
  return null;
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

async function searchUrl(artist: string, song: string): Promise<string | null> {
  const query = encodeURIComponent(`${artist} ${song}`);
  const res = await fetchHtml(`${BASE_URL}/busca/?q=${query}`);
  if (res.status === 403) throw new CifraAccessError(403);
  if (!res.html) return null;

  const $ = cheerio.load(res.html);
  const candidates = extractSongLinks($).slice(0, 8);

  for (const candidate of candidates) {
    const page = await fetchHtml(candidate);
    if (page.html && looksLikeSongPage(page.html)) return candidate;
  }
  return null;
}

export async function findSongUrl(artist: string, song: string): Promise<string | null> {
  const direct = await guessDirectUrl(artist, song);
  if (direct) return direct;
  return searchUrl(artist, song);
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
