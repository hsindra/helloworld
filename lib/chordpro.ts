import { chordToNashville, nashvilleToChord } from './transpose.ts';

const CHORD_TOKEN = new RegExp(
  '^[A-G](#|b)?(m|maj|min|dim|aug|sus2|sus4|sus|add\\d{1,2})?(\\d{1,2})?(\\([^)]*\\))?(/[A-G](#|b)?m?)?$'
);

const METADATA_LINE = /^\s*(Tom\s*:|Capotraste\b|Afina[cç][aã]o\s*:)/i;

/** A whole line wrapped in a single pair of brackets, e.g. "[Intro]" or
 * "[Primeira Parte]" — how Cifra Club marks section labels. Distinguished
 * from a real bracketed chord (which the caller checks separately) so
 * `[E]` on its own line isn't mistaken for a section marker. */
const SECTION_LABEL_LINE = /^\[([^\]]+)\]$/;

function isChordLine(line: string): boolean {
  const words = line.match(/\S+/g);
  if (!words || words.length === 0) return false;
  return words.every((w) => CHORD_TOKEN.test(w));
}

function chordLineToBracketed(line: string): string {
  const words = line.match(/\S+/g) || [];
  return words.map((w) => `[${w}]`).join(' ');
}

function mergeChordAndLyric(chordLine: string, lyricLine: string): string {
  const matches = [...chordLine.matchAll(/\S+/g)];
  let result = lyricLine;
  let offset = 0;
  for (const m of matches) {
    const chord = m[0];
    const col = (m.index ?? 0) + offset;
    if (col > result.length) {
      result += ' '.repeat(col - result.length);
    }
    const insertion = `[${chord}]`;
    result = result.slice(0, col) + insertion + result.slice(col);
    offset += insertion.length;
  }
  return result;
}

/**
 * Converts "chords-above-lyrics" plain text (the format Cifra Club renders
 * inside its <pre> block) into a ChordPro-annotated body.
 */
export function chordsOverLyricsToChordPro(rawText: string): string {
  const lines = rawText.replace(/\r\n/g, '\n').split('\n');
  const out: string[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (METADATA_LINE.test(line)) {
      i += 1;
      continue;
    }
    const sectionMatch = line.trim().match(SECTION_LABEL_LINE);
    if (sectionMatch && !CHORD_TOKEN.test(sectionMatch[1])) {
      out.push(`{${sectionMatch[1]}}`);
      i += 1;
      continue;
    }
    if (isChordLine(line)) {
      const next = lines[i + 1];
      if (next !== undefined && next.trim() !== '' && !isChordLine(next)) {
        out.push(mergeChordAndLyric(line, next));
        i += 2;
        continue;
      }
      out.push(chordLineToBracketed(line));
      i += 1;
      continue;
    }
    out.push(line);
    i += 1;
  }
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';
}

export interface SongMeta {
  title: string;
  artist: string;
  key?: string;
  capo?: string;
  sourceUrl?: string;
}

export function buildChordPro(meta: SongMeta, rawCifraText: string): string {
  const body = chordsOverLyricsToChordPro(rawCifraText);
  const header: string[] = [];
  header.push(`{title: ${meta.title}}`);
  header.push(`{artist: ${meta.artist}}`);
  if (meta.key) header.push(`{key: ${meta.key}}`);
  if (meta.capo) header.push(`{capo: ${meta.capo}}`);
  if (meta.sourceUrl) header.push(`{comment: Fonte - ${meta.sourceUrl}}`);
  return `${header.join('\n')}\n\n${body}`;
}

export interface ChordProHeader {
  title?: string;
  artist?: string;
  key?: string;
  capo?: string;
  comments: string[];
}

const DIRECTIVE_LINE = /^\s*\{(\w+):\s*(.*)\}\s*$/;

/** Reads the {title}/{artist}/{key}/{capo}/{comment} directives out of a
 * ChordPro document, wherever they are — useful so that editing the header
 * directly in the raw text stays the single source of truth. */
export function parseChordProHeader(text: string): ChordProHeader {
  const header: ChordProHeader = { comments: [] };
  for (const line of text.split('\n')) {
    const m = line.match(DIRECTIVE_LINE);
    if (!m) continue;
    const [, directive, value] = m;
    const trimmed = value.trim();
    switch (directive.toLowerCase()) {
      case 'title':
        header.title = trimmed;
        break;
      case 'artist':
        header.artist = trimmed;
        break;
      case 'key':
        header.key = trimmed;
        break;
      case 'capo':
        header.capo = trimmed;
        break;
      case 'comment':
        header.comments.push(trimmed);
        break;
    }
  }
  return header;
}

/** A brace tag with no `directive:` prefix, e.g. "{Intro}" or "{Refrão}" —
 * a section label, as opposed to a `{key: ...}`-style header directive.
 * Captured with a global flag so it can split a line into tag/non-tag
 * pieces even when the tag shares a line with chords, e.g.
 * "{Intro} [1] [%] [4] [%]" or "[1] [%] {Verso 1}". */
const SECTION_TAG_TOKEN = /(\{[^:{}]+\})/g;

export type ChordProChunk = { chord: string | null; lyric: string };
export type ChordProBodyLine =
  | { type: 'chords'; chunks: ChordProChunk[] }
  | { type: 'text'; text: string }
  | { type: 'tag'; label: string }
  | { type: 'blank' };

/** Parses one non-tag piece of a line into a chords/text body line, or null
 * if the piece is empty/whitespace (e.g. the gap left after a tag is split
 * out of the middle of a line). */
function parseChordSegment(segment: string): ChordProBodyLine | null {
  if (segment.trim() === '') return null;
  if (!segment.includes('[')) {
    return { type: 'text', text: segment };
  }
  const chunks: ChordProChunk[] = [];
  let pendingChord: string | null = null;
  for (const part of segment.split(/(\[[^\]]+\])/g)) {
    if (part === '') continue;
    const chordMatch = part.match(/^\[([^\]]+)\]$/);
    if (chordMatch) {
      if (pendingChord !== null) chunks.push({ chord: pendingChord, lyric: '' });
      pendingChord = chordMatch[1];
    } else {
      chunks.push({ chord: pendingChord, lyric: part });
      pendingChord = null;
    }
  }
  if (pendingChord !== null) chunks.push({ chord: pendingChord, lyric: '' });
  return { type: 'chords', chunks };
}

/** Splits a ChordPro body into lines ready for a "chords above lyrics"
 * rendering: each chunk pairs a chord with the syllable/word it sits above.
 * A `{tag}` becomes its own rendered line even when it shares a source
 * line with chords. */
export function parseChordProBody(text: string): ChordProBodyLine[] {
  const result: ChordProBodyLine[] = [];
  for (const line of text.split('\n')) {
    if (DIRECTIVE_LINE.test(line)) continue;
    if (line.trim() === '') {
      result.push({ type: 'blank' });
      continue;
    }
    for (const piece of line.split(SECTION_TAG_TOKEN)) {
      const tagMatch = piece.match(/^\{([^:{}]+)\}$/);
      if (tagMatch) {
        result.push({ type: 'tag', label: tagMatch[1].trim() });
        continue;
      }
      const parsed = parseChordSegment(piece);
      if (parsed) result.push(parsed);
    }
  }
  return result;
}

const CHORD_BRACKET = /\[([^\]]+)\]/g;

/** Rewrites every `[Chord]` token in a ChordPro document into its Nashville
 * Number equivalent relative to `key`. Directives, lyrics and blank lines are
 * left untouched — only the bracketed chord tokens change. */
export function convertChordProToNashville(chordpro: string, key: string): string {
  return chordpro.replace(CHORD_BRACKET, (_, token) => `[${chordToNashville(token, key)}]`);
}

/** Inverse of convertChordProToNashville: rewrites every `[degree]` token
 * back into a concrete chord for `key`. */
export function convertChordProFromNashville(chordpro: string, key: string): string {
  return chordpro.replace(CHORD_BRACKET, (_, token) => `[${nashvilleToChord(token, key)}]`);
}
