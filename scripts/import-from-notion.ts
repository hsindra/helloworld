/**
 * One-off import: reads reviewed .chordpro files (see scripts/notion_export.py
 * and notion-import/, gitignored) and saves each into SavedSong via
 * lib/store.ts — the same path the app itself uses, so the record shape is
 * guaranteed consistent with what app/api/songs expects.
 *
 * Usage:
 *   node --env-file=.env.local --experimental-strip-types scripts/import-from-notion.ts [--artist NAME] <file.chordpro> [...]
 *
 * Requires KV_REST_API_URL / KV_REST_API_TOKEN in .env.local (production
 * Upstash credentials, pulled from the Vercel project — see CLAUDE.md).
 */
import { readFileSync } from 'fs';
import { parseChordProHeader } from '../lib/chordpro.ts';
import { saveSong } from '../lib/store.ts';

async function main() {
  const args = process.argv.slice(2);
  let artist = '';
  let filesFrom: string | undefined;
  const files: string[] = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--artist') {
      artist = args[++i] ?? '';
    } else if (args[i] === '--files-from') {
      filesFrom = args[++i];
    } else {
      files.push(args[i]);
    }
  }
  if (filesFrom) {
    const listed = readFileSync(filesFrom, 'utf-8')
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
    files.push(...listed);
  }
  if (files.length === 0) {
    console.error(
      'Uso: node --env-file=.env.local --experimental-strip-types scripts/import-from-notion.ts [--artist NAME] <arquivo.chordpro> [...]'
    );
    process.exitCode = 1;
    return;
  }

  for (const file of files) {
    const chordpro = readFileSync(file, 'utf-8');
    const header = parseChordProHeader(chordpro);
    if (!header.title || !header.key) {
      console.log(`PULADO ${file} — falta title ou key no cabeçalho.`);
      continue;
    }
    const saved = await saveSong({
      title: header.title,
      artist,
      key: header.key,
      capo: header.capo,
      chordpro,
    });
    console.log(`OK ${saved.title} (tom: ${saved.key}) -> id ${saved.id}`);
  }
}

main().catch((err) => {
  console.error('Falha no import:', err);
  process.exitCode = 1;
});
