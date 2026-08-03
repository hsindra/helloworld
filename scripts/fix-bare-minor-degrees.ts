/**
 * One-off fix for songs imported from Notion (artist === "notion"): degrees
 * 2, 3 and 6 were written bare there (e.g. "[6]") even though they're the
 * naturally-minor ii/iii/vi chords — this app's Nashville grammar expects
 * that spelled out explicitly ("[6m]"), same convention as extensions
 * ("[6m7]", slash chords "[6m/1]"). Only touches a bracket when:
 *   - it opens directly on 2, 3 or 6 (not e.g. "[16]", digit isn't first),
 *   - that digit isn't already followed by "m" (already minor, untouched),
 *   - the bracket has no "|" inside (a chord-sequence tag, e.g.
 *     "[ 19 | % | 47M | % ]", not a single chord — left as-is).
 *
 * Usage: node --env-file=.env.local --experimental-strip-types scripts/fix-bare-minor-degrees.ts
 */
import { listSongs, saveSong } from '../lib/store.ts';

const BRACKET = /\[([^\]]*)\]/g;

function fixChordpro(chordpro: string): { text: string; changes: number } {
  let changes = 0;
  const text = chordpro.replace(BRACKET, (match, inner: string) => {
    if (inner.includes('|')) return match;
    const first = inner[0];
    if ((first === '6' || first === '2' || first === '3') && inner[1] !== 'm') {
      changes += 1;
      return `[${first}m${inner.slice(1)}]`;
    }
    return match;
  });
  return { text, changes };
}

async function main() {
  const songs = await listSongs();
  const targets = songs.filter((s) => s.artist === 'notion');
  console.log(`Músicas com artist="notion": ${targets.length}`);

  let updated = 0;
  for (const song of targets) {
    const { text, changes } = fixChordpro(song.chordpro);
    if (changes === 0) continue;
    await saveSong({ ...song, chordpro: text });
    console.log(`OK ${song.title}: ${changes} acorde(s) ajustado(s)`);
    updated += 1;
  }

  console.log(`\n--- Resumo --- ${updated} música(s) alteradas de ${targets.length}.`);
}

main().catch((err) => {
  console.error('Falha:', err);
  process.exitCode = 1;
});
