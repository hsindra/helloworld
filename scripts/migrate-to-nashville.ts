/**
 * One-off migration: rewrites every SavedSong's `chordpro` from concrete
 * chords into Nashville Number tokens (see Discovery/cifras-em-graus.md).
 * Songs without a saved `key` are skipped and reported, since there's no
 * safe way to convert them.
 *
 * Usage: node --experimental-strip-types scripts/migrate-to-nashville.ts
 * Requires KV_REST_API_URL / KV_REST_API_TOKEN in the environment (same as
 * the app).
 */
import { listSongs, saveSong, type SavedSong } from '../lib/store.ts';
import { convertChordProToNashville } from '../lib/chordpro.ts';
import { InvalidKeyError } from '../lib/transpose.ts';

function looksAlreadyMigrated(song: SavedSong): boolean {
  // A bracketed token that starts with a digit 1-7 is a Nashville token; a
  // token starting with a note letter A-G is still a concrete chord.
  return !/\[[A-G]/.test(song.chordpro);
}

async function main() {
  const songs = await listSongs();
  console.log(`Encontradas ${songs.length} música(s).`);

  const skipped: string[] = [];
  let migrated = 0;
  let alreadyDone = 0;

  for (const song of songs) {
    if (!song.key) {
      skipped.push(`${song.id} — "${song.title}" (sem tom salvo)`);
      continue;
    }
    if (looksAlreadyMigrated(song)) {
      alreadyDone += 1;
      continue;
    }
    try {
      const chordpro = convertChordProToNashville(song.chordpro, song.key);
      await saveSong({
        id: song.id,
        title: song.title,
        artist: song.artist,
        key: song.key,
        capo: song.capo,
        sourceUrl: song.sourceUrl,
        chordpro,
      });
      migrated += 1;
      console.log(`OK  ${song.id} — "${song.title}" (tom: ${song.key})`);
    } catch (err) {
      const reason = err instanceof InvalidKeyError ? err.message : String(err);
      skipped.push(`${song.id} — "${song.title}" (${reason})`);
    }
  }

  console.log('\n--- Resumo ---');
  console.log(`Migradas: ${migrated}`);
  console.log(`Já estavam em graus: ${alreadyDone}`);
  console.log(`Ignoradas: ${skipped.length}`);
  for (const line of skipped) console.log(`  - ${line}`);
}

main().catch((err) => {
  console.error('Falha na migração:', err);
  process.exitCode = 1;
});
