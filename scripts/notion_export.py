"""
Batch-exports worship songs from a Notion page (degree/"grau" notation) into
ChordPro files, ready for review before importing into the app's own DB.

Usage:
    python scripts/notion_export.py <notion-page-url-or-id> [--only "título"] [--out DIR] [--dry-run]

Requires NOTION_API_KEY in .env.local (see scripts/notion_common.py docstring
for how to create the Notion integration and share the page with it).

Output goes to notion-import/ by default, which is gitignored — this repo is
public, and these files contain full copyrighted lyrics. Never commit them.
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

from notion_common import (
    REPO_ROOT,
    NotionAuthError,
    export_song,
    extract_page_id,
    list_child_pages,
    slugify,
)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("page", help="URL ou id da página-pai do Notion (a que lista as músicas)")
    parser.add_argument("--only", help="Exporta só a música cujo título contém este texto")
    parser.add_argument("--out", default=str(REPO_ROOT / "notion-import"), help="Diretório de saída")
    parser.add_argument("--dry-run", action="store_true", help="Só lista as músicas encontradas, não exporta")
    parser.add_argument(
        "--from-existing",
        action="store_true",
        help="Re-exporta só as músicas que já têm um .chordpro no diretório de saída (por slug do título)",
    )
    args = parser.parse_args()

    try:
        parent_id = extract_page_id(args.page)
        songs = list_child_pages(parent_id)
    except NotionAuthError as e:
        print(f"Erro de acesso ao Notion: {e}", file=sys.stderr)
        return 1

    if not songs:
        print("Nenhuma sub-página encontrada. A página tem músicas como sub-páginas diretas?")
        return 1

    if args.only:
        needle = args.only.lower()
        songs = [s for s in songs if needle in s["title"].lower()]
        if not songs:
            print(f"Nenhuma música com título contendo {args.only!r}.")
            return 1

    if args.from_existing:
        existing_slugs = {p.stem for p in Path(args.out).glob("*.chordpro")}
        songs = [s for s in songs if slugify(s["title"]) in existing_slugs]
        if not songs:
            print(f"Nenhum .chordpro existente em {args.out} bate com um título encontrado.")
            return 1

    print(f"Encontradas {len(songs)} música(s):")
    for s in songs:
        print(f"  - {s['title']}")

    if args.dry_run:
        return 0

    out_dir = Path(args.out)
    out_dir.mkdir(parents=True, exist_ok=True)

    ok, failed = 0, []
    for s in songs:
        try:
            result = export_song(s["id"])
        except NotionAuthError as e:
            print(f"ERRO  {s['title']}: {e}")
            failed.append(s["title"])
            continue
        path = out_dir / f"{slugify(result.title)}.chordpro"
        path.write_text(result.chordpro, encoding="utf-8")
        ok += 1
        status = "OK" if not result.warnings else "AVISO"
        print(f"{status:6} {result.title} -> {path} ({result.chord_count} acordes)")
        for w in result.warnings:
            print(f"        ! {w}")

    print(f"\n--- Resumo --- {ok} exportada(s), {len(failed)} falharam.")
    for t in failed:
        print(f"  - {t}")
    return 0 if not failed else 1


if __name__ == "__main__":
    main()
