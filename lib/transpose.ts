/**
 * Transposition engine between concrete chords (C, F#m7, G/B) and Nashville
 * Number System tokens (1, 4m7, 5/7) relative to a song's key.
 *
 * Degree numbers always use major-scale intervals from the tonic — this is
 * the standard Nashville Number System convention, and it's what makes the
 * familiar b3/b6/b7 borrowed-chord labels come out right even for songs in a
 * minor key (e.g. the C chord in the key of Am is "b3", not a natural-minor
 * "3"). Only the chord's root moves; its quality/extension suffix and any
 * slash-bass are preserved as-is (the bass root is converted the same way).
 */

export class InvalidKeyError extends Error {
  constructor(key: string) {
    super(`Tom inválido ou não reconhecido: "${key}".`);
  }
}

const NOTE_SEMITONES: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const SHARP_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const FLAT_NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
const MAJOR_SCALE = [0, 2, 4, 5, 7, 9, 11];

function noteToSemitone(letter: string, accidental?: string): number {
  let semitone = NOTE_SEMITONES[letter];
  if (accidental === '#') semitone += 1;
  if (accidental === 'b') semitone -= 1;
  return ((semitone % 12) + 12) % 12;
}

function semitoneToNote(semitone: number, preferFlats: boolean): string {
  const table = preferFlats ? FLAT_NAMES : SHARP_NAMES;
  return table[((semitone % 12) + 12) % 12];
}

const KEY_RE = /^([A-G])(#|b)?m?$/;

interface ParsedKey {
  tonic: number;
  preferFlats: boolean;
}

function parseKey(key: string): ParsedKey {
  const m = key.trim().match(KEY_RE);
  if (!m) throw new InvalidKeyError(key);
  const [, letter, accidental] = m;
  const preferFlats = accidental === 'b' || (!accidental && letter === 'F');
  return { tonic: noteToSemitone(letter, accidental), preferFlats };
}

/** Maps a semitone distance-from-tonic (0-11) to a Nashville degree label
 * (e.g. "4", "b7", "#1"). Diatonic (major-scale) pitches map exactly;
 * chromatic pitches always fall in a whole-tone gap between two scale
 * degrees and are spelled as the flat of the degree above — matching the
 * "b3"/"b6"/"b7" borrowed-chord convention used on gospel/worship charts. */
function distanceToDegree(distance: number): string {
  const exactIdx = MAJOR_SCALE.indexOf(distance);
  if (exactIdx !== -1) return String(exactIdx + 1);
  const flatIdx = MAJOR_SCALE.findIndex((offset) => offset === distance + 1);
  if (flatIdx !== -1) return `b${flatIdx + 1}`;
  const sharpIdx = MAJOR_SCALE.findIndex((offset) => offset === distance - 1);
  if (sharpIdx !== -1) return `#${sharpIdx + 1}`;
  return String(distance);
}

function degreeToDistance(accidental: string | undefined, degree: number): number {
  const base = MAJOR_SCALE[degree - 1];
  const offset = accidental === '#' ? 1 : accidental === 'b' ? -1 : 0;
  return (((base + offset) % 12) + 12) % 12;
}

/** Mirrors the chord grammar validated by CHORD_TOKEN in lib/chordpro.ts,
 * with named groups since the root/bass need to be pulled apart to do the
 * transposition math. */
const CHORD_PARSE_RE = /^([A-G])(#|b)?([^/]*)(?:\/([A-G])(#|b)?(m?))?$/;

function chordRootToDegree(letter: string, accidental: string | undefined, tonic: number): string {
  const distance = (noteToSemitone(letter, accidental) - tonic + 12) % 12;
  return distanceToDegree(distance);
}

/** Converts one chord token (e.g. "Am7", "G/B") into its Nashville Number
 * equivalent relative to `key` (e.g. "6m7", "5/7"). Tokens that don't start
 * with a valid chord root (e.g. "N.C.") are returned unchanged. */
export function chordToNashville(token: string, key: string): string {
  const parsedKey = parseKey(key);
  const m = token.match(CHORD_PARSE_RE);
  if (!m) return token;
  const [, letter, accidental, suffix, bassLetter, bassAccidental, bassMinor] = m;

  let result = chordRootToDegree(letter, accidental, parsedKey.tonic) + suffix;
  if (bassLetter) {
    result += `/${chordRootToDegree(bassLetter, bassAccidental, parsedKey.tonic)}${bassMinor || ''}`;
  }
  return result;
}

const NASHVILLE_PARSE_RE = /^(#|b)?([1-7])([^/]*)(?:\/(#|b)?([1-7])(m?))?$/;

function degreeToChordRoot(accidental: string | undefined, degree: number, parsedKey: ParsedKey): string {
  const distance = degreeToDistance(accidental, degree);
  return semitoneToNote(parsedKey.tonic + distance, parsedKey.preferFlats);
}

/** Inverse of chordToNashville: converts a Nashville Number token (e.g.
 * "6m7", "5/7") back into a concrete chord for `key` (e.g. "Am7", "G/B").
 * Tokens that don't start with a valid degree (1-7) are returned unchanged. */
export function nashvilleToChord(token: string, key: string): string {
  const parsedKey = parseKey(key);
  const m = token.match(NASHVILLE_PARSE_RE);
  if (!m) return token;
  const [, accidental, degree, suffix, bassAccidental, bassDegree, bassMinor] = m;

  let result = degreeToChordRoot(accidental, Number(degree), parsedKey) + suffix;
  if (bassDegree) {
    result += `/${degreeToChordRoot(bassAccidental, Number(bassDegree), parsedKey)}${bassMinor || ''}`;
  }
  return result;
}
