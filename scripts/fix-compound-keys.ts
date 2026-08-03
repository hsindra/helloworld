/**
 * One-off fix: some Notion "Tom" properties had extra text after the key
 * itself (e.g. "G (Em)", "B (G#m)", "C um") — lib/transpose.ts's parseKey
 * only accepts a bare `[A-G](#|b)?m?`, so these fail to transpose. Keeps
 * just the leading valid key token, drops the rest, leaves everything else
 * on the song untouched.
 *
 * Usage: node --env-file=.env.local --experimental-strip-types scripts/fix-compound-keys.ts
 */
import { listSongs, saveSong } from '../lib/store.ts';

const VALID_KEY = /^[A-G](#|b)?m?$/;
const LEADING_KEY = /^([A-G](#|b)?m?)\b/;

async function main() {
  const songs = await listSongs();
  let fixed = 0;
  let unresolved = 0;

  for (const song of songs) {
    if (VALID_KEY.test(song.key)) continue;
    const m = song.key.match(LEADING_KEY);
    if (!m) {
      console.log(`SEM CORREÇÃO ${song.title} — tom "${song.key}" não começa com um tom válido.`);
      unresolved += 1;
      continue;
    }
    const newKey = m[1];
    await saveSong({ ...song, key: newKey });
    console.log(`OK ${song.title}: "${song.key}" -> "${newKey}"`);
    fixed += 1;
  }

  console.log(`\n--- Resumo --- Corrigidas: ${fixed}  Sem correção possível: ${unresolved}`);
}

main().catch((err) => {
  console.error('Falha:', err);
  process.exitCode = 1;
});
