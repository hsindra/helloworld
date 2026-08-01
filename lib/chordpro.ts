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

/** Matches either a `[Chord]` token or a brace tag with no `directive:`
 * prefix, e.g. "{Intro}" or "{Refrão}" (as opposed to a `{key: ...}`-style
 * header directive). Captured with a global flag so a line can be split
 * into chord/tag/lyric pieces in source order, e.g.
 * "{Intro} [1] [%] [4] [%]" or "[1] [%] {Verso 1}". */
const CHORD_OR_TAG_TOKEN = /(\[[^\]]+\]|\{[^:{}]+\})/g;

export type ChordProChunk =
  | { kind: 'chord'; chord: string | null; lyric: string }
  | { kind: 'tag'; label: string };
export type ChordProBodyLine =
  | { type: 'chords'; chunks: ChordProChunk[] }
  | { type: 'text'; text: string }
  | { type: 'blank' };

/** Splits a ChordPro body into lines ready for a "chords above lyrics"
 * rendering: each chunk pairs a chord with the syllable/word it sits above.
 * `{tag}` tokens become their own chunk (rendered plain, not as a chord)
 * without ever inserting a line break the source didn't already have —
 * line breaks are entirely up to how the ChordPro text is written. */
export function parseChordProBody(text: string): ChordProBodyLine[] {
  const result: ChordProBodyLine[] = [];
  for (const line of text.split('\n')) {
    if (DIRECTIVE_LINE.test(line)) continue;
    if (line.trim() === '') {
      result.push({ type: 'blank' });
      continue;
    }
    if (!line.includes('[') && !/\{[^:{}]+\}/.test(line)) {
      result.push({ type: 'text', text: line });
      continue;
    }
    const chunks: ChordProChunk[] = [];
    let pendingChord: string | null = null;
    const flushPendingChord = () => {
      if (pendingChord !== null) {
        chunks.push({ kind: 'chord', chord: pendingChord, lyric: '' });
        pendingChord = null;
      }
    };
    for (const part of line.split(CHORD_OR_TAG_TOKEN)) {
      if (part === '') continue;
      const chordMatch = part.match(/^\[([^\]]+)\]$/);
      if (chordMatch) {
        flushPendingChord();
        pendingChord = chordMatch[1];
        continue;
      }
      const tagMatch = part.match(/^\{([^:{}]+)\}$/);
      if (tagMatch) {
        flushPendingChord();
        chunks.push({ kind: 'tag', label: tagMatch[1].trim() });
        continue;
      }
      chunks.push({ kind: 'chord', chord: pendingChord, lyric: part });
      pendingChord = null;
    }
    flushPendingChord();
    result.push({ type: 'chords', chunks });
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
