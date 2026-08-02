"""
Shared helpers for exporting worship songs from Notion (degree/"grau" notation)
into ChordPro, matching the storage grammar this app already uses (see
lib/transpose.ts and Discovery/cifras-em-graus.md): a chord token is
`(#|b)?[1-7]<suffix>?(/(#|b)?[1-7]m?)?`, or the literal repeat mark `%`.

Source format on the Notion page (per user spec):
- A "chord line" lists one token per measure, separated by `|`, e.g.
  `19 | % | 47M | %`.
- The following line is the lyric, with the exact insertion point of each
  chord marked either by a literal underscore character `_`, or by Notion
  "underline" rich-text formatting on the character where the chord lands.
  Whichever the line uses, the count of markers must equal the count of
  chord tokens on the line above.

This module never prints or returns full lyric text to a caller that isn't
going to write it straight to a file — callers (CLI / MCP tool) should only
surface metadata (title, path, counts, warnings).
"""
from __future__ import annotations

import os
import re
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Iterable

import requests
from dotenv import load_dotenv

REPO_ROOT = Path(__file__).resolve().parent.parent
load_dotenv(REPO_ROOT / ".env.local")

NOTION_API_KEY = os.environ.get("NOTION_API_KEY")
NOTION_VERSION = "2022-06-28"
API_BASE = "https://api.notion.com/v1"


class NotionAuthError(RuntimeError):
    pass


def _headers() -> dict:
    if not NOTION_API_KEY:
        raise NotionAuthError(
            "NOTION_API_KEY não encontrado em .env.local. Crie uma integração "
            "interna em https://www.notion.so/my-integrations, compartilhe a "
            "página com ela, e salve o secret em .env.local."
        )
    return {
        "Authorization": f"Bearer {NOTION_API_KEY}",
        "Notion-Version": NOTION_VERSION,
        "Content-Type": "application/json",
    }


def _request(method: str, path: str, **kwargs) -> dict:
    for attempt in range(5):
        resp = requests.request(method, f"{API_BASE}{path}", headers=_headers(), timeout=30, **kwargs)
        if resp.status_code == 429:
            time.sleep(float(resp.headers.get("Retry-After", "1")))
            continue
        if resp.status_code == 401:
            raise NotionAuthError("Notion recusou o token (401). Verifique NOTION_API_KEY em .env.local.")
        if resp.status_code == 404:
            raise NotionAuthError(
                "Notion retornou 404. A integração provavelmente não tem acesso a essa "
                "página — abra a página no Notion, menu \"...\" > \"Conexões\" e adicione a integração."
            )
        resp.raise_for_status()
        return resp.json()
    raise RuntimeError("Notion API: excesso de rate-limit retries.")


PAGE_ID_RE = re.compile(r"([0-9a-fA-F]{32})(?:[?#]|$)")


def extract_page_id(url_or_id: str) -> str:
    """Pulls a Notion page id out of a full URL or accepts a bare id."""
    raw = url_or_id.strip().replace("-", "")
    m = PAGE_ID_RE.search(raw)
    if not m:
        raise ValueError(f"Não consegui extrair um page id de: {url_or_id!r}")
    hexid = m.group(1)
    return f"{hexid[0:8]}-{hexid[8:12]}-{hexid[12:16]}-{hexid[16:20]}-{hexid[20:32]}"


def get_page(page_id: str) -> dict:
    return _request("GET", f"/pages/{page_id}")


def get_page_title(page: dict) -> str:
    props = page.get("properties", {})
    for prop in props.values():
        if prop.get("type") == "title":
            return "".join(t.get("plain_text", "") for t in prop.get("title", [])).strip()
    return "(sem título)"


def get_text_property(page: dict, name: str) -> str | None:
    """Reads a rich_text/select/title database property by name, e.g. the
    "Tom" column on the Worship database. Returns None if absent or empty."""
    prop = page.get("properties", {}).get(name)
    if not prop:
        return None
    ptype = prop.get("type")
    if ptype == "rich_text":
        text = "".join(t.get("plain_text", "") for t in prop.get("rich_text", [])).strip()
    elif ptype == "select":
        sel = prop.get("select")
        text = (sel or {}).get("name", "")
    elif ptype == "title":
        text = "".join(t.get("plain_text", "") for t in prop.get("title", [])).strip()
    else:
        text = ""
    return text or None


def get_block_children(block_id: str) -> list[dict]:
    results: list[dict] = []
    cursor = None
    while True:
        params = {"page_size": 100}
        if cursor:
            params["start_cursor"] = cursor
        data = _request("GET", f"/blocks/{block_id}/children", params=params)
        results.extend(data.get("results", []))
        if not data.get("has_more"):
            break
        cursor = data.get("next_cursor")
    return results


def query_database(database_id: str) -> list[dict]:
    results: list[dict] = []
    cursor = None
    while True:
        body: dict = {"page_size": 100}
        if cursor:
            body["start_cursor"] = cursor
        data = _request("POST", f"/databases/{database_id}/query", json=body)
        results.extend(data.get("results", []))
        if not data.get("has_more"):
            break
        cursor = data.get("next_cursor")
    return results


def list_child_pages(parent_page_id: str) -> list[dict]:
    """One entry per song findable under a page: direct child_page blocks,
    plus every row of any child_database embedded in the page (Notion
    database rows aren't block children — they need a separate query)."""
    out = []
    for block in get_block_children(parent_page_id):
        btype = block.get("type")
        if btype == "child_page":
            out.append({"id": block["id"], "title": block["child_page"]["title"]})
        elif btype == "child_database":
            for row in query_database(block["id"]):
                out.append({"id": row["id"], "title": get_page_title(row)})
    return out


# --------------------------------------------------------------------------
# Rich text -> lines with underline-run offsets
# --------------------------------------------------------------------------


@dataclass
class Line:
    text: str
    underline_offsets: list[int] = field(default_factory=list)
    kind: str = "text"  # "text" | "heading"


def _rich_text_to_lines(rich_text: list[dict]) -> list[Line]:
    """Concatenates a block's rich_text runs, tracking underline-run start
    offsets, and splits on literal newlines (shift+enter inside one block)
    into separate Line objects."""
    full_text = ""
    underline_starts: list[int] = []
    prev_underline = False
    for run in rich_text:
        content = run.get("plain_text", "")
        underline = bool(run.get("annotations", {}).get("underline"))
        if underline and not prev_underline:
            underline_starts.append(len(full_text))
        elif underline and prev_underline:
            pass  # still inside the same run, not a new insertion point
        full_text += content
        prev_underline = underline if content else prev_underline

    lines: list[Line] = []
    line_start = 0
    for m in re.finditer(r"\n", full_text) or []:
        pass
    # Split on '\n' while keeping offsets relative to each line.
    parts = full_text.split("\n")
    offset = 0
    for part in parts:
        part_underlines = [o - offset for o in underline_starts if offset <= o < offset + len(part)]
        lines.append(Line(text=part, underline_offsets=part_underlines))
        offset += len(part) + 1
    return lines


def flatten_page_lines(page_id: str) -> list[Line]:
    """Walks a song page's blocks in order (recursing into containers like
    toggle/column/list-item) and produces a flat sequence of Line objects."""
    lines: list[Line] = []
    HEADING_TYPES = {"heading_1", "heading_2", "heading_3"}
    CONTAINER_TYPES = {"toggle", "column_list", "column", "bulleted_list_item", "numbered_list_item", "quote"}
    TEXT_TYPES = {"paragraph"} | HEADING_TYPES | CONTAINER_TYPES

    def walk(block_id: str):
        for block in get_block_children(block_id):
            btype = block.get("type")
            if btype == "child_page":
                continue  # a different song, not part of this one
            if btype == "divider":
                lines.append(Line(text=""))
                continue
            if btype in TEXT_TYPES:
                rich_text = block.get(btype, {}).get("rich_text", [])
                sub_lines = _rich_text_to_lines(rich_text)
                if btype in HEADING_TYPES:
                    for sl in sub_lines:
                        sl.kind = "heading"
                lines.extend(sub_lines)
                if btype in CONTAINER_TYPES and block.get("has_children"):
                    walk(block["id"])
                continue
            # Anything else (child_database, link_to_page, table, synced_block,
            # embed, image, ...) is intentionally NOT followed — this song's
            # own content only, never other pages reachable through a link.

    walk(page_id)
    return lines


# --------------------------------------------------------------------------
# Grau/degree notation -> ChordPro
# --------------------------------------------------------------------------

CHORD_TOKEN = re.compile(r"^%$|^(#|b)?[1-7][A-Za-z0-9#]*(/(#|b)?[1-7]m?)?$")
KEY_LINE = re.compile(r"^\s*Tom\s*:?\s*([A-G](#|b)?m?)\s*$", re.IGNORECASE)


def parse_chord_sequence(text: str) -> list[list[str]]:
    """A chord-sequence line lists one or more chords per measure (space-
    separated), measures separated by `|`, e.g. `47M 19/3 | 27 19/3` is two
    measures of two chords each."""
    measures = [m.strip() for m in text.split("|")]
    return [[tok for tok in re.split(r"\s+", measure) if tok] for measure in measures]


def is_chord_line(text: str) -> bool:
    if "|" not in text:
        return False
    seq = parse_chord_sequence(text)
    if not seq or any(len(measure) == 0 for measure in seq):
        return False
    return all(CHORD_TOKEN.match(tok) for measure in seq for tok in measure)


def format_chord_sequence(seq: list[list[str]]) -> str:
    """Renders the section's chord sequence as a single bracketed tag, kept
    verbatim in the output as a reference for the section (verse/chorus/...)
    — separate from the same chords interleaved into the lyric below."""
    return "[ " + " | ".join(" ".join(measure) for measure in seq) + " ]"


def flatten_sequence(seq: list[list[str]]) -> list[str]:
    return [tok for measure in seq for tok in measure]


@dataclass
class ExportResult:
    title: str
    chordpro: str
    warnings: list[str]
    chord_count: int
    key: str | None


def _line_markers(line: Line) -> list[tuple[int, str]]:
    # A lyric line can mark chord positions two ways at once: a literal "_"
    # character (consumed — it's a placeholder, not real lyric text) or
    # Notion "underline" formatting on a real character (kept — the chord
    # lands right before it). Merge both marker kinds in position order.
    markers: list[tuple[int, str]] = [(i, "underscore") for i, ch in enumerate(line.text) if ch == "_"]
    markers += [(o, "underline") for o in set(line.underline_offsets)]
    markers.sort(key=lambda m: m[0])
    return markers


def merge_chords_into_lyric(cycle: list[str], start_pos: int, line: Line) -> tuple[str, int]:
    """Inserts `[chord]` at every marker in `line`, pulling chords from
    `cycle` starting at `start_pos` and wrapping back to the start of the
    cycle as needed — the section's chord sequence keeps repeating across
    lines until a new sequence line resets it. Returns the merged text and
    the cycle position to resume from on the next line."""
    markers = _line_markers(line)
    segments: list[str] = []
    prev = 0
    for pos, kind in markers:
        segments.append(line.text[prev:pos])
        prev = pos + 1 if kind == "underscore" else pos
    segments.append(line.text[prev:])

    out = segments[0]
    pos = start_pos
    for seg in segments[1:]:
        out += f"[{cycle[pos % len(cycle)]}]{seg}"
        pos += 1
    return out, pos


def build_song_lines(flat_lines: list[Line], warnings: list[str]) -> tuple[list[str], str | None]:
    out: list[str] = []
    detected_key: str | None = None
    cycle: list[str] | None = None
    cycle_pos = 0
    for i, line in enumerate(flat_lines):
        key_match = KEY_LINE.match(line.text)
        if key_match:
            detected_key = key_match.group(1)
            continue
        if line.kind == "heading":
            if line.text.strip():
                out.append(f"{{{line.text.strip()}}}")
            continue
        if is_chord_line(line.text):
            seq = parse_chord_sequence(line.text)
            out.append(format_chord_sequence(seq))
            cycle = flatten_sequence(seq)
            cycle_pos = 0
            continue
        if line.text.strip() == "":
            out.append("")
            continue
        if _line_markers(line):
            if cycle is None:
                warnings.append(f"Linha {i}: acorde marcado antes de qualquer sequência de acordes — ignorado.")
                out.append(line.text)
                continue
            merged, cycle_pos = merge_chords_into_lyric(cycle, cycle_pos, line)
            out.append(merged)
            continue
        out.append(line.text)
    return out, detected_key


def export_song(page_id: str, source_url: str | None = None) -> ExportResult:
    page = get_page(page_id)
    title = get_page_title(page)
    flat_lines = flatten_page_lines(page_id)
    warnings: list[str] = []
    body_lines, body_key = build_song_lines(flat_lines, warnings)

    key = get_text_property(page, "Tom") or body_key
    header = [f"{{title: {title}}}"]
    if key:
        header.append(f"{{key: {key}}}")
    else:
        warnings.append("Tom não encontrado (nem na propriedade \"Tom\" nem no corpo da página) — preencher manualmente antes de salvar.")
    if source_url:
        header.append(f"{{comment: Fonte - {source_url}}}")

    body = "\n".join(body_lines).strip("\n") + "\n"
    chordpro = "\n".join(header) + "\n\n" + body
    chord_count = sum(len(re.findall(r"\[[^\]]+\]", l)) for l in body_lines)

    return ExportResult(title=title, chordpro=chordpro, warnings=warnings, chord_count=chord_count, key=key)


def slugify(text: str) -> str:
    text = re.sub(r"[^\w\s-]", "", text, flags=re.UNICODE).strip().lower()
    return re.sub(r"[-\s]+", "-", text) or "sem-titulo"
