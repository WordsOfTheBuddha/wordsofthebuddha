#!/usr/bin/env python3
"""Shared text normalization for voice/re-record tooling.

This module mirrors the normalization rules used by `scripts/generate_voice.py`
for gloss handling and paragraph extraction.
"""

from __future__ import annotations

import hashlib
import re
from dataclasses import dataclass


def strip_frontmatter(raw: str) -> str:
    if raw.startswith("---"):
        end = raw.find("\n---", 3)
        if end != -1:
            return raw[end + 4 :].lstrip("\n")
    return raw


def strip_glosses_display(text: str) -> str:
    """Extract display text (first segment)."""

    def _replace(m: re.Match[str]) -> str:
        inner = m.group(1)
        if "::" not in inner:
            return m.group(0)
        display, _rest = inner.split("::", 1)
        return display

    return re.sub(r"\|([^|]+)\|", _replace, text)


def strip_glosses_tts(text: str) -> str:
    """Extract TTS text, honoring explicit TTS overrides when present."""

    def _replace(m: re.Match[str]) -> str:
        inner = m.group(1)
        if "::" not in inner:
            return m.group(0)
        display, rest = inner.split("::", 1)
        if "::" in rest:
            _tooltip, tts_override = rest.split("::", 1)
            return tts_override.strip()
        return display

    return re.sub(r"\|([^|]+)\|", _replace, text)


def _contains_letter(text: str) -> bool:
    return any(ch.isalpha() for ch in text)


def strip_glosses_manifest(text: str) -> str:
    """Extract display text with punctuation-only/empty TTS override handling."""

    def _replace(m: re.Match[str]) -> str:
        inner = m.group(1)
        if "::" not in inner:
            return m.group(0)
        display, rest = inner.split("::", 1)
        if "::" not in rest:
            return display
        _tooltip, tts_override = rest.split("::", 1)
        tts_text = tts_override.strip()
        return display if _contains_letter(tts_text) else tts_text

    return re.sub(r"\|([^|]+)\|", _replace, text)


def normalize_inline_markdown(text: str) -> str:
    text = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", text)
    text = re.sub(r"\*\*([^*]+)\*\*", r"\1", text)
    text = re.sub(r"__([^_]+)__", r"\1", text)
    text = re.sub(r"(?<!\*)\*([^*]+)\*(?!\*)", r"\1", text)
    text = re.sub(r"(?<!_)_([^_]+)_(?!_)", r"\1", text)
    text = re.sub(r"\^\[\d+\]\^", "", text)
    text = re.sub(r"\^([^ ^]+)\^", r"\1", text)
    return text


def strip_heading_lines_for_tts(text: str) -> str:
    lines = text.split("\n")
    kept: list[str] = []
    for line in lines:
        if re.match(r"^#{1,6}\s+\S", line.strip()):
            continue
        kept.append(line)
    return "\n".join(kept)


def strip_collapse_blocks(text: str) -> str:
    return re.sub(
        r"<collapse\b[^>]*>.*?</collapse>",
        "",
        text,
        flags=re.DOTALL | re.IGNORECASE,
    )


def strip_html_jsx_tags(text: str, preserve_ssml: bool = False) -> str:
    if not preserve_ssml:
        return re.sub(r"</?[a-zA-Z][^>]*>", "", text)

    allowed = ("say-as", "sub", "phoneme", "break")
    placeholders: list[str] = []

    def _stash(m: re.Match[str]) -> str:
        placeholders.append(m.group(0))
        return f"__SSML_PLACEHOLDER_{len(placeholders)-1}__"

    protected = text
    for tag in allowed:
        protected = re.sub(rf"<{tag}\b[^>]*>", _stash, protected, flags=re.IGNORECASE)
        protected = re.sub(rf"</{tag}>", _stash, protected, flags=re.IGNORECASE)
        protected = re.sub(rf"<{tag}\b[^>]*/>", _stash, protected, flags=re.IGNORECASE)

    stripped = re.sub(r"</?[a-zA-Z][^>]*>", "", protected)
    for i, raw in enumerate(placeholders):
        stripped = stripped.replace(f"__SSML_PLACEHOLDER_{i}__", raw)
    return stripped


def normalize_paragraph_body(
    text: str,
    for_tts: bool = False,
    for_manifest: bool = False,
) -> str:
    if for_tts and for_manifest:
        raise ValueError("for_tts and for_manifest are mutually exclusive")

    text = text.strip()
    text = strip_heading_lines_for_tts(text)
    text = strip_collapse_blocks(text)
    text = strip_html_jsx_tags(text, preserve_ssml=for_tts)
    if for_tts:
        text = strip_glosses_tts(text)
    elif for_manifest:
        text = strip_glosses_manifest(text)
    else:
        text = strip_glosses_display(text)
    text = normalize_inline_markdown(text)
    if for_tts:
        text = text.replace("—", ";")
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def _is_verse(raw_text: str) -> bool:
    lines = [l.strip() for l in re.split(r"(?:\r\n|\n|\r|<br>)", raw_text) if l.strip()]
    if len(lines) < 2:
        return False
    last_ok = bool(re.search(r'[\]!.?"—\'\u2018\u2019;:\u201c\u201d^]$', lines[-1]))
    others_ok = all(re.search(r"[,;:.?!]?$", l) for l in lines[:-1])
    return last_ok and others_ok


def extract_paragraph_chunks_heading_style(body: str) -> list[tuple[int, str, bool]]:
    pattern = re.compile(r"^####\s+(\d+)\s*$", re.MULTILINE)
    matches = list(pattern.finditer(body))
    out: list[tuple[int, str, bool]] = []
    para_id = 1
    for i, m in enumerate(matches):
        start = m.end()
        end = matches[i + 1].start() if i + 1 < len(matches) else len(body)
        chunk = body[start:end]
        plain = normalize_paragraph_body(chunk)
        if plain:
            out.append((para_id, chunk, _is_verse(chunk)))
            para_id += 1
    return out


def extract_paragraph_chunks_prose(body: str) -> list[tuple[int, str, bool]]:
    chunks = re.split(r"\n\s*\n+", body.strip())
    out: list[tuple[int, str, bool]] = []
    n = 1
    for chunk in chunks:
        plain = normalize_paragraph_body(chunk)
        if plain:
            out.append((n, chunk, _is_verse(chunk)))
            n += 1
    return out


def extract_paragraph_chunks_auto(body: str) -> list[tuple[int, str, bool]]:
    heading_chunks = extract_paragraph_chunks_heading_style(body)
    if heading_chunks:
        return heading_chunks
    return extract_paragraph_chunks_prose(body)


def extract_paragraphs_auto(
    body: str,
    for_tts: bool = False,
    for_manifest: bool = False,
) -> list[tuple[int, str, bool]]:
    out: list[tuple[int, str, bool]] = []
    for num, chunk, is_break in extract_paragraph_chunks_auto(body):
        plain = normalize_paragraph_body(
            chunk,
            for_tts=for_tts,
            for_manifest=for_manifest,
        )
        if plain:
            out.append((num, plain, is_break))
    return out


def text_hash(full_text: str) -> str:
    return hashlib.sha256(full_text.encode("utf-8")).hexdigest()


@dataclass(frozen=True)
class ParagraphDiff:
    paragraph_id: int
    old_text: str
    new_text: str

