"""Section heading metadata helpers for voice manifests."""

from __future__ import annotations

import re
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
CONTENT_DIR = ROOT / "src" / "content" / "en"
HEADING_RE = re.compile(r"^\s*(#{2,6})\s+(.+?)\s*$", re.MULTILINE)


def strip_frontmatter(text: str) -> str:
    if not text.startswith("---"):
        return text
    match = re.match(r"^---\s*\n.*?\n---\s*\n", text, flags=re.DOTALL)
    return text[match.end():] if match else text


def mdx_path_for(slug: str) -> Path | None:
    matches = sorted(CONTENT_DIR.glob(f"**/{slug}.mdx"))
    return matches[0] if matches else None


def has_spoken_text(chunk: str) -> bool:
    text = HEADING_RE.sub(" ", chunk)
    text = re.sub(r"<collapse>.*?</collapse>", " ", text, flags=re.DOTALL)
    text = re.sub(r"<[^>]+>", " ", text)
    text = re.sub(r"\|([^|:]+)::[^|]*\|", r"\1", text)
    text = re.sub(r"[`*_~#>\[\](){}]", " ", text)
    return bool(re.search(r"[A-Za-z0-9]", text))


def extract_headings(raw_mdx: str) -> list[dict[str, Any]]:
    body = strip_frontmatter(raw_mdx)
    chunks = re.split(r"\n\s*\n+", body.strip())
    pending: list[tuple[int, str]] = []
    headings: list[dict[str, Any]] = []
    paragraph_id = 0

    for chunk in chunks:
        for match in HEADING_RE.finditer(chunk):
            level = len(match.group(1))
            text = match.group(2).strip()
            if text:
                pending.append((level, text))
        if has_spoken_text(chunk):
            paragraph_id += 1
            for level, text in pending:
                headings.append(
                    {
                        "id": f"h{len(headings) + 1}",
                        "level": level,
                        "text": text,
                        "paragraphId": paragraph_id,
                    }
                )
            pending.clear()

    return headings


def apply_heading_metadata(
    manifest: dict[str, Any],
    raw_mdx: str,
    *,
    schema_version: int = 3,
) -> int:
    headings = extract_headings(raw_mdx)
    paragraph_count = len(manifest.get("paragraphs") or [])
    headings = [h for h in headings if 1 <= h["paragraphId"] <= paragraph_count]

    if headings:
        manifest["headings"] = headings
        current_schema = int(manifest.get("metadataSchemaVersion") or 0)
        if current_schema < schema_version:
            manifest["metadataSchemaVersion"] = schema_version
    else:
        manifest.pop("headings", None)

    return len(headings)
