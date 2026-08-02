"""
Local MCP server for interactive access to the Worship songs Notion page.

Every tool here returns metadata only (title, page id, output path, counts,
warnings) — never the full lyric text. Songs are written straight to disk by
export_song/export_all; the model never has to hold or repeat the full lyric
text to do its job. This repo is public, so notion-import/ (the output dir)
is gitignored — never commit those files.

Registered in .mcp.json as "notion-worship". Requires NOTION_API_KEY in
.env.local (see scripts/notion_common.py docstring).
"""
from __future__ import annotations

from pathlib import Path

from mcp.server.fastmcp import FastMCP

from notion_common import REPO_ROOT, export_song, extract_page_id, list_child_pages, slugify

mcp = FastMCP("notion-worship")

DEFAULT_OUT_DIR = REPO_ROOT / "notion-import"


@mcp.tool()
def list_songs(parent_page_url_or_id: str) -> list[dict]:
    """Lists the song sub-pages under a Notion parent page. Returns only
    titles and page ids — no lyric content."""
    parent_id = extract_page_id(parent_page_url_or_id)
    return list_child_pages(parent_id)


@mcp.tool()
def export_one_song(page_url_or_id: str, out_dir: str = str(DEFAULT_OUT_DIR)) -> dict:
    """Exports a single song page to a .chordpro file on disk. Returns
    metadata only (title, path, chord count, warnings) — never the lyrics
    themselves, so review the file directly instead of asking for its
    contents here."""
    page_id = extract_page_id(page_url_or_id)
    result = export_song(page_id)
    out = Path(out_dir)
    out.mkdir(parents=True, exist_ok=True)
    path = out / f"{slugify(result.title)}.chordpro"
    path.write_text(result.chordpro, encoding="utf-8")
    return {
        "title": result.title,
        "path": str(path),
        "key_detected": result.key,
        "chord_count": result.chord_count,
        "warnings": result.warnings,
    }


@mcp.tool()
def export_all_songs(parent_page_url_or_id: str, out_dir: str = str(DEFAULT_OUT_DIR)) -> dict:
    """Exports every song sub-page under a Notion parent page to .chordpro
    files on disk. Returns a per-song summary (title, path, counts,
    warnings) only — never lyric content."""
    parent_id = extract_page_id(parent_page_url_or_id)
    songs = list_child_pages(parent_id)
    out = Path(out_dir)
    out.mkdir(parents=True, exist_ok=True)
    summary = []
    for s in songs:
        try:
            result = export_song(s["id"])
        except Exception as e:  # noqa: BLE001 - surface per-song failure, keep batch going
            summary.append({"title": s["title"], "error": str(e)})
            continue
        path = out / f"{slugify(result.title)}.chordpro"
        path.write_text(result.chordpro, encoding="utf-8")
        summary.append(
            {
                "title": result.title,
                "path": str(path),
                "key_detected": result.key,
                "chord_count": result.chord_count,
                "warnings": result.warnings,
            }
        )
    return {"count": len(summary), "songs": summary}


if __name__ == "__main__":
    mcp.run()
