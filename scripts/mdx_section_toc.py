"""MDX section ToC comments for range discourses (mirrors src/utils/mdxSectionToc.ts)."""

from __future__ import annotations

import re
from typing import Any

NUMERIC_HEADING_RE = re.compile(
    r"^(#{1,5})\s+(\d+\.\d+(?:\.\d+)*(?:[–-]\d+(?:\.\d+)*)?)\s*$",
)
INLINE_HEADING_TOC_RE = re.compile(
    r"^(#{1,5})\s+(\d+\.\d+(?:\.\d+)*(?:[–-]\d+(?:\.\d+)*)?)\s+"
    r"\{/\*\s*toc:\s*([\s\S]*?)\s*\*/\}\s*$",
)
TOC_ONLY_LINE_RE = re.compile(r"^\{/\*\s*toc:\s*([\s\S]*?)\s*\*/\}\s*$")
INLINE_HEADING_HTML_TOC_RE = re.compile(
    r"^(#{1,5})\s+(\d+\.\d+(?:\.\d+)*(?:[–-]\d+(?:\.\d+)*)?)\s+"
    r"<!--\s*toc(?:-title)?\s*:\s*([\s\S]*?)\s*-->\s*$",
    re.IGNORECASE,
)
TOC_ONLY_HTML_LINE_RE = re.compile(
    r"^<!--\s*toc(?:-title)?\s*:\s*([\s\S]*?)\s*-->\s*$",
    re.IGNORECASE,
)
HEADING_TEXT_HTML_TOC_SUFFIX_RE = re.compile(
    r"\s+<!--\s*toc(?:-title)?\s*:[\s\S]*?-->\s*$",
    re.IGNORECASE,
)
NUMERIC_SECTION_ID_RE = re.compile(
    r"^(\d+\.\d+(?:\.\d+)*(?:[–-]\d+(?:\.\d+)*)?)$",
)


def is_mdx_section_toc_line(line: str) -> bool:
    trimmed = line.strip()
    return bool(TOC_ONLY_LINE_RE.match(trimmed) or TOC_ONLY_HTML_LINE_RE.match(trimmed))


def heading_listen_label(section_id: str, section_toc: dict[str, str]) -> str:
    title = (section_toc.get(section_id) or "").strip()
    if title and title != section_id:
        return f"{section_id} — {title}"
    return section_id


def extract_mdx_section_toc(markdown: str) -> tuple[str, dict[str, str]]:
    section_toc: dict[str, str] = {}
    out: list[str] = []
    pending_section: str | None = None
    last_numeric_section: str | None = None

    for line in markdown.split("\n"):
        trimmed = line.strip()

        if trimmed == "":
            out.append(line)
            continue

        inline = INLINE_HEADING_TOC_RE.match(trimmed)
        if inline:
            section_id = inline.group(2)
            section_toc[section_id] = inline.group(3).strip()
            last_numeric_section = section_id
            out.append(f"{inline.group(1)} {section_id}")
            pending_section = None
            continue

        inline_html = INLINE_HEADING_HTML_TOC_RE.match(trimmed)
        if inline_html:
            section_id = inline_html.group(2)
            section_toc[section_id] = inline_html.group(3).strip()
            last_numeric_section = section_id
            out.append(f"{inline_html.group(1)} {section_id}")
            pending_section = None
            continue

        heading = NUMERIC_HEADING_RE.match(trimmed)
        if heading:
            pending_section = heading.group(2)
            last_numeric_section = heading.group(2)
            out.append(line)
            continue

        toc_only = TOC_ONLY_LINE_RE.match(trimmed)
        if toc_only:
            section_id = pending_section or last_numeric_section
            if section_id:
                section_toc[section_id] = toc_only.group(1).strip()
            pending_section = None
            continue

        toc_only_html = TOC_ONLY_HTML_LINE_RE.match(trimmed)
        if toc_only_html:
            section_id = pending_section or last_numeric_section
            if section_id:
                section_toc[section_id] = toc_only_html.group(1).strip()
            pending_section = None
            continue

        pending_section = None
        out.append(line)

    return "\n".join(out), section_toc


def clean_heading_text_for_listen(text: str, section_toc: dict[str, str]) -> str:
    text = HEADING_TEXT_HTML_TOC_SUFFIX_RE.sub("", text).strip()
    match = NUMERIC_SECTION_ID_RE.match(text)
    if match:
        return heading_listen_label(match.group(1), section_toc)
    return text
