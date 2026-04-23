#!/usr/bin/env python3
"""
Generate Opus audio + word-level manifest for English sutta MDX.

Usage:
  export GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json
  python scripts/generate_voice.py dhp1-20
  python scripts/generate_voice.py dhp
  python scripts/generate_voice.py dhp1-20 dhp21-32
  python scripts/generate_voice.py sn36
  python scripts/generate_voice.py mn1-50
  python scripts/generate_voice.py sn36 mn1

Targets:
  - Exact slug (must exist in src/utils/routes.ts), e.g. dhp1-20
  - Multiple slugs / collections in one run (space-separated)
  - Collection prefix: dhp → all discourses whose slug starts with "dhp"
  - Saṁyutta chapter: sn36 → all slugs matching ^sn36\\.
  - Numeric range (mn, an, kp, iti): mn1-50 → mn1 … mn50 that exist in routes
  - Mixed: sn36 mn1 → union of sn36.* and mn1

Outputs:
  public/audio/<slug>.webm
  public/audio/<slug>.manifest.json

Environment variables:
  TTS_VOICE                         Voice name (default: en-US-Studio-M)
  TTS_SPEAKING_RATE                 Speech rate 0.25–4.0 (default: 0.9)
  TTS_PARAGRAPH_BREAK_MS            Verse/section break in ms (default: 1200)
  TTS_CONSECUTIVE_PARAGRAPH_BREAK_MS  Prose break in ms (default: 800)
  GOOGLE_APPLICATION_CREDENTIALS   Path to GCP service account JSON

Optional SSML <prosody> (voice:gen): --prosody-pitch / --prosody-rate / --prosody-volume
(see Google Cloud TTS SSML). Combining SSML rate with TTS_SPEAKING_RATE may compound speed.

See scripts/README-voice.md
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import shutil
import sys
from dataclasses import dataclass
from pathlib import Path
from xml.sax.saxutils import escape

# Repo root = parent of scripts/
REPO_ROOT = Path(__file__).resolve().parent.parent

# Whisper model cache inside repo (avoids needing home directory writes in CI/sandbox)
_cache = REPO_ROOT / ".cache"
if "XDG_CACHE_HOME" not in os.environ:
    os.environ["XDG_CACHE_HOME"] = str(_cache)


def load_dotenv() -> None:
    try:
        from dotenv import load_dotenv as _load

        _load(REPO_ROOT / ".env")
    except ImportError:
        pass


def load_routes() -> list[str]:
    """Parse slug list from src/utils/routes.ts."""
    path = REPO_ROOT / "src" / "utils" / "routes.ts"
    text = path.read_text(encoding="utf-8")
    m = re.search(r"export const routes = \[(.*?)\];", text, re.DOTALL)
    if not m:
        raise RuntimeError(f"Could not parse routes array from {path}")
    return re.findall(r'"([^"]+)"', m.group(1))


def natural_sort_key(slug: str):
    """Sort dhp1-20, dhp21-32, mn2, mn10 in a sensible order."""
    parts = re.split(r"(\d+)", slug)
    out: list = []
    for p in parts:
        if p.isdigit():
            out.append(int(p))
        else:
            out.append(p)
    return out


def expand_target_token(token: str, routes: list[str]) -> list[str]:
    """
    Resolve one user token to a list of discourse slugs (may be empty).
    """
    token = token.strip()
    if not token:
        return []

    rset = set(routes)

    # 1) Exact slug
    if token in rset:
        return [token]

    # 2) Numeric range: mn1-50, an1-10, kp1-3, iti1-20 (each output slug is prefix + integer, no extra hyphen)
    m = re.match(r"^(mn|an|kp|iti)(\d+)-(\d+)$", token, re.I)
    if m:
        prefix = m.group(1).lower()
        lo, hi = int(m.group(2)), int(m.group(3))
        if lo > hi:
            lo, hi = hi, lo
        out = [f"{prefix}{i}" for i in range(lo, hi + 1) if f"{prefix}{i}" in rset]
        if out:
            return sorted(out, key=natural_sort_key)

    # 3) Collection codes (folder / family)
    if token == "dhp":
        return sorted([r for r in routes if r.startswith("dhp")], key=natural_sort_key)

    if token == "iti":
        return sorted([r for r in routes if re.match(r"^iti\d+$", r)], key=natural_sort_key)

    if token == "snp":
        return sorted([r for r in routes if r.startswith("snp")], key=natural_sort_key)

    # sn36 → sn36.1, sn36.2, …
    if re.match(r"^sn\d+$", token):
        prefix = token + "."
        return sorted([r for r in routes if r.startswith(prefix)], key=natural_sort_key)

    # mn → all Majjhima discourses
    if token == "mn":
        return sorted([r for r in routes if re.match(r"^mn\d+$", r)], key=natural_sort_key)

    # an / sn / ud / snp / etc.: optional single-code expansion
    for code, pattern in (
        ("an", r"^an\d"),
        ("ud", r"^ud\d"),
        ("snp", r"^snp"),
        ("kp", r"^kp\d"),
    ):
        if token == code:
            return sorted([r for r in routes if re.match(pattern, r)], key=natural_sort_key)

    return []


def expand_all_args(args: list[str], routes: list[str]) -> list[str]:
    """Expand CLI tokens, dedupe, preserve stable order."""
    seen: set[str] = set()
    out: list[str] = []
    for raw in args:
        for slug in expand_target_token(raw, routes):
            if slug not in seen:
                seen.add(slug)
                out.append(slug)
    return out


def strip_frontmatter(raw: str) -> str:
    if raw.startswith("---"):
        end = raw.find("\n---", 3)
        if end != -1:
            return raw[end + 4 :].lstrip("\n")
    return raw


def strip_glosses_display(text: str) -> str:
    """Extract display text (first segment) — used for word-level alignment and DOM highlighting.

    |visible::tooltip|         -> visible
    |visible::tooltip::tts|    -> visible  (TTS override is silently ignored)
    |visible::::tts|           -> visible
    """
    return re.sub(r"\|(.+?)::([^|]*)\|", lambda m: m.group(1), text)


def strip_glosses_tts(text: str) -> str:
    """Extract TTS text — use override (3rd segment) if present, else display text.

    |visible::tooltip|         -> visible  (standard two-part gloss)
    |visible::tooltip::tts|    -> tts      (three-part: use TTS override for synthesis)
    |visible::::tts|           -> tts      (empty tooltip, TTS override only)
    |visible::::|              -> ""       (explicit empty TTS replacement)
    """
    def _replace(m: re.Match) -> str:
        display = m.group(1)
        rest = m.group(2)  # "tooltip" or "tooltip::tts-override"
        if "::" in rest:
            _tooltip, tts_override = rest.split("::", 1)
            return tts_override.strip()
        return display
    return re.sub(r"\|(.+?)::([^|]*)\|", _replace, text)


# Backward-compat alias: outside the TTS pipeline, display text is always correct.
strip_glosses = strip_glosses_display


def normalize_inline_markdown(text: str) -> str:
    text = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", text)
    text = re.sub(r"\*\*([^*]+)\*\*", r"\1", text)
    text = re.sub(r"__([^_]+)__", r"\1", text)
    text = re.sub(r"(?<!\*)\*([^*]+)\*(?!\*)", r"\1", text)
    text = re.sub(r"(?<!_)_([^_]+)_(?!_)", r"\1", text)
    # Strip superscript footnote markers ^[N]^ before generic ^ handling
    text = re.sub(r"\^\[\d+\]\^", "", text)
    text = re.sub(r"\^([^ ^]+)\^", r"\1", text)
    return text


def strip_heading_lines_for_tts(text: str) -> str:
    """Remove markdown heading lines (### …) — titles are not always spoken as separate sentences."""
    lines = text.split("\n")
    kept: list[str] = []
    for line in lines:
        if re.match(r"^#{1,6}\s+\S", line.strip()):
            continue
        kept.append(line)
    return "\n".join(kept)


def strip_collapse_blocks(text: str) -> str:
    """Remove entire <collapse>...</collapse> regions (collapsed UI text is not spoken)."""
    return re.sub(
        r"<collapse\b[^>]*>.*?</collapse>",
        "",
        text,
        flags=re.DOTALL | re.IGNORECASE,
    )


def strip_html_jsx_tags(text: str) -> str:
    """Remove HTML/JSX component tags (e.g. <Image ... />), not full collapse blocks."""
    return re.sub(r"</?[a-zA-Z][^>]*>", "", text)


def _cap_like(replacement: str, original: str) -> str:
    """Match casing of `original` when substituting `replacement`."""
    if original.isupper():
        return replacement.upper()
    if (
        len(original) > 1
        and original[0].isupper()
        and original[1:].islower()
    ):
        return replacement[0].upper() + replacement[1:]
    if original[:1].isupper():
        return replacement[0].upper() + replacement[1:]
    return replacement


def apply_tts_phonetic_spellings(text: str) -> str:
    """Rewrite selected loanwords for English Chirp TTS (e.g. bhikkhu → bickkoo).

    The alignment transcript uses the same rewrites for these words so it matches what
    was spoken; `restore_manifest_display_words` maps manifest tokens back to MDX spellings.

    Long-vowel macron hints (ā → aa) are separate — see `apply_tts_long_a_macron_hint`
    (Google TTS input only; alignment keeps macrons as in the DOM).
    """

    # Longer token first (plurals / compounds before singular where relevant)
    text = re.sub(
        r"\barahants\b",
        lambda m: _cap_like("ara-hants", m.group(0)),
        text,
        flags=re.IGNORECASE,
    )
    text = re.sub(
        r"\barahant\b",
        lambda m: _cap_like("ara-hant", m.group(0)),
        text,
        flags=re.IGNORECASE,
    )
    text = re.sub(
        r"\bbhikkhus\b",
        lambda m: _cap_like("bickkoos", m.group(0)),
        text,
        flags=re.IGNORECASE,
    )
    text = re.sub(
        r"\bbhikkhu\b",
        lambda m: _cap_like("bickkoo", m.group(0)),
        text,
        flags=re.IGNORECASE,
    )
    return text


def apply_tts_long_a_macron_hint(text: str) -> str:
    """Synthesis-only: spell Latin long a (ā) as aa so English TTS lengthens the vowel.

    Example: Sāvatthi → Saavatthi. Canonical MDX and forced-alignment transcripts keep ā
    so manifest word tokens match the DOM; only the string sent to Google TTS is changed.
    """
    return text.replace("ā", "aa").replace("Ā", "Aa")


# Lowercase cores of phonetic tokens → canonical (for manifest restore fallback)
_PHONETIC_CORE_TO_CANONICAL = {
    "ara-hant": "arahant",
    "ara-hants": "arahants",
    # Legacy aliases from an older pronunciation variant.
    "aruhunt": "arahant",
    "aruhunts": "arahants",
    "bickkoo": "bhikkhu",
    "bickkoos": "bhikkhus",
}


def _phonetic_token_norm(tok: str) -> str:
    """Strip leading/trailing non-word chars for comparing TTS vs alignment tokens."""
    return re.sub(r"^[^\w]+|[^\w]+$", "", tok).lower()


def restore_manifest_display_words(
    paragraphs_out: list[dict],
    paragraph_specs_canonical: list[tuple[int, str, bool]],
) -> None:
    """After alignment on phonetic text, rewrite word `w` fields to canonical spellings.

    Forced alignment must use a transcript that matches what was spoken; phonetic
    rewrites therefore flow into Whisper. This step maps those tokens back to the
    real words from the MDX for the published manifest (and UI highlights).
    """

    for pdict, (_pid, can_text, _brk) in zip(paragraphs_out, paragraph_specs_canonical):
        ph_text = apply_tts_phonetic_spellings(can_text)
        can_words = can_text.split()
        ph_words = ph_text.split()
        words_out = pdict.get("words") or []

        if len(words_out) == len(can_words) == len(ph_words):
            for j, w in enumerate(words_out):
                if _phonetic_token_norm(w["w"]) == _phonetic_token_norm(ph_words[j]):
                    w["w"] = can_words[j]
            continue

        sys.stderr.write(
            "  Warning: word token count mismatch; restoring loanwords by lookup only.\n"
        )
        for w in words_out:
            core = _phonetic_token_norm(w["w"])
            if core in _PHONETIC_CORE_TO_CANONICAL:
                canon = _PHONETIC_CORE_TO_CANONICAL[core]
                w["w"] = _cap_like(canon, w["w"])


def normalize_paragraph_body(text: str, for_tts: bool = False) -> str:
    """Normalize raw MDX paragraph body for TTS synthesis or word-level alignment.

    for_tts=False (default): uses display text for alignment/manifest (matches DOM).
    for_tts=True:            uses TTS overrides for synthesis only.
    """
    text = text.strip()
    text = strip_heading_lines_for_tts(text)
    text = strip_collapse_blocks(text)
    text = strip_html_jsx_tags(text)
    text = strip_glosses_tts(text) if for_tts else strip_glosses_display(text)
    text = normalize_inline_markdown(text)
    # Em dash: same clause boundary as semicolon for TTS and alignment (must match spoken SSML).
    text = text.replace("—", ";")
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def _is_verse(raw_text: str) -> bool:
    """Port of contentParser.ts isVerse — check line structure for verse pattern."""
    lines = [l.strip() for l in re.split(r"(?:\r\n|\n|\r|<br>)", raw_text) if l.strip()]
    if len(lines) < 2:
        return False
    last_ok = bool(re.search(r'[\]!.?"—\'\u2018\u2019;:\u201c\u201d^]$', lines[-1]))
    others_ok = all(re.search(r'[,;:.?!]?$', l) for l in lines[:-1])
    return last_ok and others_ok


def extract_paragraph_chunks_heading_style(body: str) -> list[tuple[int, str, bool]]:
    """Split on bare #### N verse headings (Dhammapada-style), preserving raw chunks.

    Paragraph ids are 1..k in document order (same as the site's data-paragraph-number),
    not the verse numbers in the headings.
    """
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
            is_break = _is_verse(chunk)
            out.append((para_id, chunk, is_break))
            para_id += 1
    return out


def extract_paragraph_chunks_prose(body: str) -> list[tuple[int, str, bool]]:
    """Prose / MN-style: split on blank lines into raw paragraph chunks."""
    chunks = re.split(r"\n\s*\n+", body.strip())
    out: list[tuple[int, str, bool]] = []
    n = 1
    for chunk in chunks:
        plain = normalize_paragraph_body(chunk)
        if plain:
            is_break = _is_verse(chunk)
            out.append((n, chunk, is_break))
            n += 1
    return out


def extract_paragraph_chunks_auto(body: str) -> list[tuple[int, str, bool]]:
    heading_chunks = extract_paragraph_chunks_heading_style(body)
    if heading_chunks:
        return heading_chunks
    return extract_paragraph_chunks_prose(body)


def extract_paragraphs_heading_style(body: str, for_tts: bool = False) -> list[tuple[int, str, bool]]:
    """Split on bare #### N verse headings (Dhammapada-style).

    Returns (paragraph_id_1_based, normalized_text, is_verse_long_break)."""
    out: list[tuple[int, str, bool]] = []
    for num, chunk, is_break in extract_paragraph_chunks_heading_style(body):
        plain = normalize_paragraph_body(chunk, for_tts=for_tts)
        if plain:
            out.append((num, plain, is_break))
    return out


def extract_paragraphs_prose(body: str, for_tts: bool = False) -> list[tuple[int, str, bool]]:
    """Prose / MN-style: split on blank lines into blocks; paragraph numbers 1..n.
    Returns (paragraph_number, normalized_text, is_verse_long_break)."""
    out: list[tuple[int, str, bool]] = []
    for num, chunk, is_break in extract_paragraph_chunks_prose(body):
        plain = normalize_paragraph_body(chunk, for_tts=for_tts)
        if plain:
            out.append((num, plain, is_break))
    return out


def extract_paragraphs_auto(body: str, for_tts: bool = False) -> list[tuple[int, str, bool]]:
    h = extract_paragraphs_heading_style(body, for_tts=for_tts)
    if h:
        return h
    return extract_paragraphs_prose(body, for_tts=for_tts)


MAX_SENTENCE_CHARS = 350


def _split_sentences(text: str) -> list[str]:
    """Split text into SSML-safe sentences.
    Primary boundaries: . ! ? ;  (semicolons are natural clause breaks in Pali-style prose).
    Also splits after closing-quote following sentence-end punctuation (e.g. passion;')
    Fallback for still-long segments: commas."""
    segs = re.split(r"(?:(?<=[.!?;])|(?<=[.!?;]['\u2019\u201d]))\s+", text)
    out: list[str] = []
    for seg in segs:
        if not seg.strip():
            continue
        if len(seg) <= MAX_SENTENCE_CHARS:
            out.append(seg)
        else:
            for part in re.split(r"(?<=,)\s+", seg):
                if part.strip():
                    out.append(part)
    return out


def _sentence_tokens(text: str) -> list[str]:
    tokens: list[str] = []
    for raw in text.split():
        tok = re.sub(r"^[^\w]+|[^\w]+$", "", raw).lower()
        if tok:
            tokens.append(tok)
    return tokens


def _has_adjacent_sentence_overlap(text: str) -> bool:
    """Heuristic: detect repeated words/phrases across neighboring sentences.

    This targets the alignment failure mode where a phrase near the end of one
    sentence is acoustically similar to the start of the next sentence, causing
    the first occurrence to absorb timing from the second.
    """
    sentences = _split_sentences(text)
    if len(sentences) < 2:
        return False
    for left, right in zip(sentences, sentences[1:]):
        a = _sentence_tokens(left)
        b = _sentence_tokens(right)
        if len(a) < 2 or len(b) < 2:
            continue
        max_n = min(4, len(a), len(b))
        for n in range(max_n, 1, -1):
            a_ngrams = {tuple(a[i : i + n]) for i in range(len(a) - n + 1)}
            b_ngrams = {tuple(b[i : i + n]) for i in range(len(b) - n + 1)}
            if a_ngrams & b_ngrams:
                return True
    return False


def _quote_ssml_attr(value: str) -> str:
    """Quote a string for use in SSML/XML double-quoted attributes."""
    return '"' + escape(value, {'"': "&quot;", "'": "&apos;"}) + '"'


@dataclass(frozen=True, slots=True)
class SsmlProsodyOptions:
    """Optional SSML ``<prosody>`` wrapper for Google Cloud TTS (see Cloud SSML docs)."""

    pitch: str | None = None
    rate: str | None = None
    volume: str | None = None


def optional_ssml_prosody(
    pitch: str | None,
    rate: str | None,
    volume: str | None,
) -> SsmlProsodyOptions | None:
    """Build ``SsmlProsodyOptions`` from CLI strings, or None if all empty."""
    def _s(x: str | None) -> str | None:
        if x is None:
            return None
        t = x.strip()
        return t if t else None

    p, r, v = _s(pitch), _s(rate), _s(volume)
    if p or r or v:
        return SsmlProsodyOptions(pitch=p, rate=r, volume=v)
    return None


def build_ssml(
    paragraphs: list[str],
    break_ms: int | list[int],
    *,
    prosody: SsmlProsodyOptions | None = None,
) -> str:
    """Build SSML from paragraphs with per-paragraph break durations.
    break_ms can be a single int (uniform) or a list aligned with paragraphs
    where each value is the break *before* that paragraph (index 0 is unused).

    ``prosody`` wraps the body in ``<prosody>`` when any field is set. Rate/pitch
    strings follow Google's SSML docs (e.g. pitch ``medium``, rate ``90%`` or ``slow``).
    """
    pp = prosody.pitch if prosody else None
    pr = prosody.rate if prosody else None
    pv = prosody.volume if prosody else None

    breaks: list[int]
    if isinstance(break_ms, list):
        breaks = break_ms
    else:
        breaks = [break_ms] * len(paragraphs)

    parts: list[str] = []
    for i, p in enumerate(paragraphs):
        parts.append("<p>")
        sentences = _split_sentences(p)
        if len(sentences) > 1:
            for s in sentences:
                parts.append(f"<s>{escape(s)}</s>")
        else:
            parts.append(escape(p))
        parts.append("</p>")
        if i < len(paragraphs) - 1:
            ms = breaks[i + 1] if i + 1 < len(breaks) else breaks[-1] if breaks else 800
            parts.append(f'<break time="{ms}ms"/>')
    inner = "".join(parts)

    if pp is not None or pr is not None or pv is not None:
        attrs: list[str] = []
        if pp is not None:
            attrs.append(f"pitch={_quote_ssml_attr(pp)}")
        if pr is not None:
            attrs.append(f"rate={_quote_ssml_attr(pr)}")
        if pv is not None:
            attrs.append(f"volume={_quote_ssml_attr(pv)}")
        inner = f"<prosody {' '.join(attrs)}>{inner}</prosody>"

    return f"<speak>{inner}</speak>"


def text_hash(full_text: str) -> str:
    return hashlib.sha256(full_text.encode("utf-8")).hexdigest()


def file_hash(path: Path) -> str | None:
    try:
        h = hashlib.sha256()
        with open(path, "rb") as fh:
            for chunk in iter(lambda: fh.read(1 << 20), b""):
                h.update(chunk)
        return h.hexdigest()
    except Exception:
        return None


MAX_SSML_BYTES = 4800  # Google TTS limit is 5000; leave margin
SMALL_DOC_MAX_PARAGRAPHS = 7  # Smart mode: small docs first attempt one TTS group.
MIN_MERGE_CHARS = 120  # Short paragraphs absorbed into neighboring group (smart mode)
TARGET_GROUP_SIZE = 3  # Aim for this many paragraphs per TTS call (smart mode)

# Brief paragraph snippets during generation (voice:gen); MDX display text, not phonetic align text.
VOICE_PREVIEW_WORDS_GEN = 12


def format_paragraph_first_words(text: str, max_words: int) -> str:
    """First `max_words` whitespace-separated tokens; ellipsis if truncated."""
    words = text.split()
    if not words:
        return ""
    preview = " ".join(words[:max_words])
    if len(words) > max_words:
        preview += "…"
    return preview


def print_tts_group_paragraph_previews(
    indices: list[int],
    paragraph_specs_display: list[tuple[int, str, bool]],
    max_words: int = VOICE_PREVIEW_WORDS_GEN,
    indent: str = "      ",
) -> None:
    """Print one line per paragraph: ¶id + first words (same shape as voice:edit --preview)."""
    for pi in indices:
        pid, text, _ = paragraph_specs_display[pi]
        snippet = format_paragraph_first_words(text, max_words)
        if snippet:
            print(f"{indent}¶{pid}: {snippet}")


def _chunk_paragraphs(
    paragraphs: list[str],
    breaks: list[int],
    prosody: SsmlProsodyOptions | None = None,
) -> list[tuple[list[str], list[int]]]:
    """Split paragraph list into groups whose SSML fits within the byte limit.
    Returns list of (paragraph_texts, break_durations) tuples per chunk."""
    chunks: list[tuple[list[str], list[int]]] = []
    cur_texts: list[str] = []
    cur_breaks: list[int] = []
    for i, p in enumerate(paragraphs):
        trial_texts = cur_texts + [p]
        trial_breaks = cur_breaks + [breaks[i] if i < len(breaks) else 800]
        ssml = build_ssml(trial_texts, trial_breaks, prosody=prosody)
        if len(ssml.encode("utf-8")) > MAX_SSML_BYTES and cur_texts:
            chunks.append((cur_texts, cur_breaks))
            cur_texts = [p]
            cur_breaks = [breaks[i] if i < len(breaks) else 800]
        else:
            cur_texts = trial_texts
            cur_breaks = trial_breaks
    if cur_texts:
        chunks.append((cur_texts, cur_breaks))
    return chunks


def _grouped_chunk_indices(
    paragraphs: list[str],
    breaks: list[int],
    prosody: SsmlProsodyOptions | None = None,
) -> list[tuple[list[int], list[str], list[int]]]:
    """Return grouped-mode chunks with original paragraph indices attached."""
    chunks = _chunk_paragraphs(paragraphs, breaks, prosody=prosody)
    out: list[tuple[list[int], list[str], list[int]]] = []
    cursor = 0
    for chunk_texts, chunk_breaks in chunks:
        indices = list(range(cursor, cursor + len(chunk_texts)))
        out.append((indices, chunk_texts, chunk_breaks))
        cursor += len(chunk_texts)
    return out


def parse_grouping_preference(
    spec: str,
    paragraph_count: int,
) -> list[list[int]]:
    """Parse user grouping like "1-3,4-5,6" into zero-based paragraph groups.

    The spec must partition all paragraphs exactly once, in ascending order.
    """
    cleaned = (spec or "").strip()
    if not cleaned:
        raise ValueError("Grouping preference is empty.")

    groups: list[list[int]] = []
    used: set[int] = set()
    tokens = [tok.strip() for tok in cleaned.split(",") if tok.strip()]
    if not tokens:
        raise ValueError(
            "Invalid grouping preference format. Example: --grouping-preference 1-3,4-5,6"
        )

    for tok in tokens:
        if "-" in tok:
            m = re.fullmatch(r"(\d+)\s*-\s*(\d+)", tok)
            if not m:
                raise ValueError(
                    f"Invalid group token '{tok}'. Expected N or N-M (e.g. 1-3)."
                )
            lo = int(m.group(1))
            hi = int(m.group(2))
            if lo > hi:
                lo, hi = hi, lo
            nums = list(range(lo, hi + 1))
        else:
            if not re.fullmatch(r"\d+", tok):
                raise ValueError(
                    f"Invalid group token '{tok}'. Expected N or N-M (e.g. 6 or 4-7)."
                )
            nums = [int(tok)]

        for n in nums:
            if n < 1 or n > paragraph_count:
                raise ValueError(
                    f"Paragraph index {n} is out of range 1-{paragraph_count}."
                )
            if n in used:
                raise ValueError(
                    f"Paragraph index {n} appears more than once in grouping preference."
                )
            used.add(n)
        groups.append([n - 1 for n in nums])

    flattened = [idx for grp in groups for idx in grp]
    expected = list(range(paragraph_count))
    if flattened != expected:
        missing = [str(i + 1) for i in expected if i not in flattened]
        missing_hint = f" Missing: {', '.join(missing[:10])}" if missing else ""
        raise ValueError(
            "Grouping preference must cover every paragraph exactly once in ascending order."
            + missing_hint
        )

    return groups


def build_grouping_preference_groups(
    paragraphs: list[str],
    breaks: list[int],
    grouping_preference: str,
    prosody: SsmlProsodyOptions | None = None,
) -> list[tuple[list[int], list[str], list[int]]]:
    """Build user-requested groups and validate each group's SSML byte size."""
    index_groups = parse_grouping_preference(grouping_preference, len(paragraphs))
    groups: list[tuple[list[int], list[str], list[int]]] = []

    for indices in index_groups:
        texts = [paragraphs[i] for i in indices]
        brks = [breaks[i] for i in indices]
        ssml = build_ssml(texts, brks, prosody=prosody)
        ssml_bytes = len(ssml.encode("utf-8"))
        if ssml_bytes > MAX_SSML_BYTES:
            group_label = f"{indices[0] + 1}-{indices[-1] + 1}" if len(indices) > 1 else str(indices[0] + 1)
            raise ValueError(
                "Grouping preference exceeds TTS SSML limit. "
                f"Group {group_label} is {ssml_bytes} bytes (max {MAX_SSML_BYTES}). "
                "Hint: split that range into smaller groups (for example, break a large "
                "N-M range into two shorter ranges)."
            )
        groups.append((indices, texts, brks))

    return groups


def _merge_short_paragraphs(
    paragraphs: list[str],
    breaks: list[int],
    min_chars: int = MIN_MERGE_CHARS,
    target_size: int = TARGET_GROUP_SIZE,
    prosody: SsmlProsodyOptions | None = None,
) -> list[tuple[list[int], list[str], list[int]]]:
    """Group paragraphs for TTS context using a sliding-window strategy.

    Returns a list of merge-groups. Each group is:
      (original_indices, paragraph_texts, break_durations)

    Strategy:
    1. Start a group with up to `target_size` (default 3) consecutive paragraphs,
       so the TTS engine always has conversational context for prosody.
    2. After the base window, keep absorbing subsequent short paragraphs
       (< min_chars) into the same group.
    3. At every step, respect MAX_SSML_BYTES — if the next paragraph would
       push the group over the byte limit, stop (even if that means a group of 1).
    """
    n = len(paragraphs)
    groups: list[tuple[list[int], list[str], list[int]]] = []

    # Small-doc fast path: first try one group using pre-SSML text length.
    # This intentionally measures plain paragraph payload bytes (not SSML tags).
    if n <= SMALL_DOC_MAX_PARAGRAPHS:
        total_text_bytes = sum(len(p.encode("utf-8")) for p in paragraphs)
        if total_text_bytes <= MAX_SSML_BYTES:
            return [(list(range(n)), list(paragraphs), list(breaks))]

    i = 0
    while i < n:
        indices = [i]
        texts = [paragraphs[i]]
        brks = [breaks[i]]

        # Phase 1: fill up to target_size paragraphs
        while len(indices) < target_size and i + 1 < n:
            trial = build_ssml(
                texts + [paragraphs[i + 1]],
                brks + [breaks[i + 1]],
                prosody=prosody,
            )
            if len(trial.encode("utf-8")) > MAX_SSML_BYTES:
                break
            i += 1
            indices.append(i)
            texts.append(paragraphs[i])
            brks.append(breaks[i])

        # Phase 2: absorb trailing short paragraphs beyond the base window
        while i + 1 < n and len(paragraphs[i + 1]) < min_chars:
            trial = build_ssml(
                texts + [paragraphs[i + 1]],
                brks + [breaks[i + 1]],
                prosody=prosody,
            )
            if len(trial.encode("utf-8")) > MAX_SSML_BYTES:
                break
            i += 1
            indices.append(i)
            texts.append(paragraphs[i])
            brks.append(breaks[i])

        groups.append((indices, texts, brks))
        i += 1
    return groups


def _synthesize_wav_chunk(
    ssml: str,
    voice_name: str,
    language_code: str,
    client,
) -> bytes:
    from google.cloud import texttospeech

    synthesis_input = texttospeech.SynthesisInput(ssml=ssml)
    voice = texttospeech.VoiceSelectionParams(
        language_code=language_code, name=voice_name
    )
    audio_config = texttospeech.AudioConfig(
        audio_encoding=texttospeech.AudioEncoding.LINEAR16,
        sample_rate_hertz=44100,
        speaking_rate=float(os.environ.get("TTS_SPEAKING_RATE", "0.9")),
    )
    response = client.synthesize_speech(
        input=synthesis_input, voice=voice, audio_config=audio_config
    )
    return response.audio_content


def _synthesize_chunks_parallel(
    chunks: list[tuple[list[str], list[int]]],
    voice_name: str,
    language_code: str,
    client,
    prosody: SsmlProsodyOptions | None = None,
) -> list[bytes]:
    """Synthesize TTS chunks in parallel using a thread pool.
    Google TTS is IO-bound (network), so threads give near-linear speedup."""
    from concurrent.futures import ThreadPoolExecutor, as_completed

    ssmls: list[str] = []
    for i, (chunk_texts, chunk_breaks) in enumerate(chunks):
        ssml = build_ssml(chunk_texts, chunk_breaks, prosody=prosody)
        ssmls.append(ssml)
        print(f"  Chunk {i + 1}/{len(chunks)}: {len(ssml)} bytes SSML")

    max_workers = min(len(ssmls), 4)
    results: dict[int, bytes] = {}

    def synth(idx: int) -> tuple[int, bytes]:
        wav = _synthesize_wav_chunk(ssmls[idx], voice_name, language_code, client)
        return idx, wav

    print(f"  Synthesizing {len(ssmls)} chunks in parallel ({max_workers} workers)…")
    with ThreadPoolExecutor(max_workers=max_workers) as pool:
        futures = {pool.submit(synth, i): i for i in range(len(ssmls))}
        for future in as_completed(futures):
            idx, wav = future.result()
            results[idx] = wav
            print(f"  ✓ Chunk {idx + 1}/{len(ssmls)} done")

    return [results[i] for i in range(len(ssmls))]


def build_tts_debug_groups(
    paragraphs: list[str],
    breaks: list[int],
    chunking: str,
    forced_groups: list[tuple[list[int], list[str], list[int]]] | None = None,
    prosody: SsmlProsodyOptions | None = None,
) -> list[tuple[list[int], list[str], list[int]]]:
    """Build the exact paragraph groups that will be sent to Google TTS."""
    if forced_groups is not None:
        return forced_groups
    if chunking == "smart":
        return _merge_short_paragraphs(paragraphs, breaks, prosody=prosody)
    if chunking == "grouped":
        return _grouped_chunk_indices(paragraphs, breaks, prosody=prosody)
    return [([i], [paragraphs[i]], [breaks[i]]) for i in range(len(paragraphs))]


def _compact_text(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip()


def build_tts_debug_payload(
    slug: str,
    mdx_path: Path,
    raw_chunks: list[tuple[int, str, bool]],
    paragraph_specs: list[tuple[int, str, bool]],
    paragraph_specs_for_tts: list[tuple[int, str, bool]],
    paragraphs_tts: list[str],
    breaks: list[int],
    chunking: str,
    forced_groups: list[tuple[list[int], list[str], list[int]]] | None = None,
    prosody: SsmlProsodyOptions | None = None,
) -> dict:
    paragraphs_payload: list[dict] = []
    for idx, ((pid, raw_chunk, is_break), (_, display_text, _), (_, tts_text, _), spoken_text) in enumerate(
        zip(raw_chunks, paragraph_specs, paragraph_specs_for_tts, paragraphs_tts),
        start=1,
    ):
        paragraphs_payload.append(
            {
                "index": idx,
                "id": pid,
                "isBreak": is_break,
                "breakBeforeMs": breaks[idx - 1],
                "raw": raw_chunk.strip(),
                "displayText": display_text,
                "ttsNormalizedText": tts_text,
                "ttsSpokenText": spoken_text,
            }
        )

    groups_payload: list[dict] = []
    for group_index, (indices, texts, group_breaks) in enumerate(
        build_tts_debug_groups(
            paragraphs_tts,
            breaks,
            chunking,
            forced_groups=forced_groups,
            prosody=prosody,
        ),
        start=1,
    ):
        groups_payload.append(
            {
                "groupIndex": group_index,
                "paragraphIndices": [i + 1 for i in indices],
                "paragraphIds": [raw_chunks[i][0] for i in indices],
                "breaksMs": group_breaks,
                "texts": texts,
                "ssml": build_ssml(texts, group_breaks, prosody=prosody),
            }
        )

    return {
        "slug": slug,
        "mdx": str(mdx_path.relative_to(REPO_ROOT)),
        "chunking": chunking,
        "paragraphs": paragraphs_payload,
        "ttsGroups": groups_payload,
    }


def emit_tts_debug_payload(payload: dict, out_path: Path) -> None:
    print("  Verbose TTS debug:")
    for paragraph in payload["paragraphs"]:
        print(
            f"    ¶{paragraph['id']} spoken: {paragraph['ttsSpokenText']}"
        )

    print("  TTS groups / SSML:")
    for group in payload["ttsGroups"]:
        ids = ", ".join(str(pid) for pid in group["paragraphIds"])
        print(f"    group {group['groupIndex']} (¶{ids})")
        print(f"      ssml: {_compact_text(group['ssml'])}")

    out_path.write_text(
        json.dumps(payload, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
    print(f"  TTS debug: {out_path.relative_to(REPO_ROOT)}")


def synthesize_opus(
    paragraphs: list[str],
    breaks: list[int],
    voice_name: str,
    language_code: str,
    out_path: Path,
    parallel: bool = True,
    prosody: SsmlProsodyOptions | None = None,
) -> list[tuple[float, float]]:
    """Synthesize each paragraph independently and concatenate with silence gaps.

    Returns a list of (start_seconds, end_seconds) ground-truth boundaries for
    each paragraph, derived from the actual per-paragraph audio durations.
    """
    import io
    import wave

    from concurrent.futures import ThreadPoolExecutor, as_completed

    from google.cloud import texttospeech

    client = texttospeech.TextToSpeechClient()
    n = len(paragraphs)

    # Build single-paragraph SSML for each paragraph
    ssmls = [build_ssml([p], [0], prosody=prosody) for p in paragraphs]
    for i, ssml in enumerate(ssmls):
        size = len(ssml.encode("utf-8"))
        if size > MAX_SSML_BYTES:
            sys.stderr.write(
                f"Warning: paragraph {i + 1} SSML is {size} bytes "
                f"(limit {MAX_SSML_BYTES}). Synthesis may fail.\n"
            )

    # Synthesize paragraphs in parallel
    max_workers = min(n, 4) if parallel else 1
    results: dict[int, bytes] = {}

    def synth(idx: int) -> tuple[int, bytes]:
        wav = _synthesize_wav_chunk(ssmls[idx], voice_name, language_code, client)
        return idx, wav

    print(f"  Synthesizing {n} paragraphs individually ({max_workers} workers)…")
    done_count = 0
    with ThreadPoolExecutor(max_workers=max_workers) as pool:
        futures = {pool.submit(synth, i): i for i in range(n)}
        for future in as_completed(futures):
            idx, wav = future.result()
            results[idx] = wav
            done_count += 1
            print(f"  ✓ Paragraph {idx + 1} done ({done_count}/{n})")

    wav_chunks = [results[i] for i in range(n)]

    # Concatenate with silence gaps and compute exact boundaries
    out_path.parent.mkdir(parents=True, exist_ok=True)
    combined_wav = out_path.with_suffix(".tmp.wav")
    boundaries: list[tuple[float, float]] = []

    try:
        params = None
        cursor = 0.0
        with wave.open(str(combined_wav), "wb") as wout:
            for i, raw_wav in enumerate(wav_chunks):
                buf = io.BytesIO(raw_wav)
                with wave.open(buf, "rb") as win:
                    if params is None:
                        params = win.getparams()
                        wout.setparams(params)

                    # Insert silence gap before this paragraph (except first)
                    if i > 0 and breaks[i] > 0:
                        silence_sec = breaks[i] / 1000.0
                        n_silence = int(silence_sec * params.framerate)
                        wout.writeframes(
                            b"\x00" * (n_silence * params.sampwidth * params.nchannels)
                        )
                        cursor += n_silence / params.framerate

                    # Record paragraph boundary and write audio
                    n_frames = win.getnframes()
                    dur = n_frames / params.framerate
                    boundaries.append((round(cursor, 4), round(cursor + dur, 4)))
                    wout.writeframes(win.readframes(n_frames))
                    cursor += dur

        cmd = (
            f'ffmpeg -y -i "{combined_wav}" -c:a libopus -b:a 32k '
            f'-vbr on -application voip -f webm "{out_path}" -loglevel error 2>&1'
        )
        ret = os.system(cmd)
        if ret != 0:
            raise RuntimeError(f"ffmpeg Opus encoding exited with code {ret}")
    finally:
        combined_wav.unlink(missing_ok=True)

    total_dur = boundaries[-1][1] if boundaries else 0
    print(f"  {n} paragraphs → {total_dur:.1f}s total audio")
    return boundaries


def synthesize_opus_smart(
    paragraphs: list[str],
    breaks: list[int],
    voice_name: str,
    language_code: str,
    out_path: Path,
    parallel: bool = True,
    forced_groups: list[tuple[list[int], list[str], list[int]]] | None = None,
    paragraph_specs_display: list[tuple[int, str, bool]] | None = None,
    prosody: SsmlProsodyOptions | None = None,
) -> list[tuple[float, float]]:
    """Smart synthesis: merge short paragraphs into groups for better TTS context.

    Long paragraphs are synthesized individually (exact boundary).
    Short consecutive paragraphs are merged into one TTS call, then inner
    boundaries are estimated proportionally by character count.
    """
    import io
    import wave

    from concurrent.futures import ThreadPoolExecutor, as_completed

    from google.cloud import texttospeech

    client = texttospeech.TextToSpeechClient()
    n = len(paragraphs)
    groups = (
        forced_groups
        if forced_groups is not None
        else _merge_short_paragraphs(paragraphs, breaks, prosody=prosody)
    )

    n_solo = sum(1 for g in groups if len(g[0]) == 1)
    n_merged = len(groups) - n_solo
    merged_paras = sum(len(g[0]) for g in groups if len(g[0]) > 1)
    if forced_groups is None:
        print(f"  Smart merge: {n} paragraphs → {len(groups)} groups "
              f"({n_solo} solo, {n_merged} merged covering {merged_paras} paragraphs)")
    else:
        print(f"  User-provided grouping: {n} paragraphs → {len(groups)} groups "
              f"({n_solo} solo, {n_merged} merged covering {merged_paras} paragraphs)")

    # Build SSML for each group
    ssmls: list[str] = []
    for indices, texts, brks in groups:
        ssml = build_ssml(texts, brks, prosody=prosody)
        ssmls.append(ssml)
        size = len(ssml.encode("utf-8"))
        if size > MAX_SSML_BYTES:
            sys.stderr.write(
                f"Warning: group [{indices[0]+1}..{indices[-1]+1}] SSML is {size} bytes "
                f"(limit {MAX_SSML_BYTES}). Synthesis may fail.\n"
            )

    # Synthesize groups in parallel
    max_workers = min(len(groups), 4) if parallel else 1
    results: dict[int, bytes] = {}

    def synth(idx: int) -> tuple[int, bytes]:
        wav = _synthesize_wav_chunk(ssmls[idx], voice_name, language_code, client)
        return idx, wav

    print(f"  Synthesizing {len(groups)} groups ({max_workers} workers)…")
    done_count = 0
    with ThreadPoolExecutor(max_workers=max_workers) as pool:
        futures = {pool.submit(synth, i): i for i in range(len(groups))}
        for future in as_completed(futures):
            idx, wav = future.result()
            results[idx] = wav
            done_count += 1
            g = groups[idx]
            label = f"¶{g[0][0]+1}" if len(g[0]) == 1 else f"¶{g[0][0]+1}–{g[0][-1]+1}"
            print(f"  ✓ Group {idx + 1} ({label}) done ({done_count}/{len(groups)})")
            if paragraph_specs_display is not None:
                print_tts_group_paragraph_previews(
                    g[0], paragraph_specs_display, VOICE_PREVIEW_WORDS_GEN
                )

    wav_chunks = [results[i] for i in range(len(groups))]

    # Concatenate groups with silence gaps and compute per-paragraph boundaries
    out_path.parent.mkdir(parents=True, exist_ok=True)
    combined_wav = out_path.with_suffix(".tmp.wav")
    boundaries: list[tuple[float, float]] = [None] * n  # type: ignore[list-item]

    try:
        params = None
        cursor = 0.0
        with wave.open(str(combined_wav), "wb") as wout:
            for gi, raw_wav in enumerate(wav_chunks):
                indices, texts, brks = groups[gi]

                buf = io.BytesIO(raw_wav)
                with wave.open(buf, "rb") as win:
                    if params is None:
                        params = win.getparams()
                        wout.setparams(params)

                    # Insert silence gap before this group (use break of first para in group)
                    first_idx = indices[0]
                    if first_idx > 0 and breaks[first_idx] > 0:
                        silence_sec = breaks[first_idx] / 1000.0
                        n_silence = int(silence_sec * params.framerate)
                        wout.writeframes(
                            b"\x00" * (n_silence * params.sampwidth * params.nchannels)
                        )
                        cursor += n_silence / params.framerate

                    group_start = cursor
                    n_frames = win.getnframes()
                    group_dur = n_frames / params.framerate
                    wout.writeframes(win.readframes(n_frames))

                if len(indices) == 1:
                    # Solo paragraph: exact boundary
                    boundaries[indices[0]] = (round(group_start, 4), round(group_start + group_dur, 4))
                else:
                    # Merged group: estimate inner boundaries by char count
                    char_counts = [max(len(t), 1) for t in texts]
                    total_chars = sum(char_counts)
                    inner_cursor = group_start
                    for j, pi in enumerate(indices):
                        frac = char_counts[j] / total_chars
                        para_dur = group_dur * frac
                        boundaries[pi] = (round(inner_cursor, 4), round(inner_cursor + para_dur, 4))
                        inner_cursor += para_dur

                cursor = group_start + group_dur

        cmd = (
            f'ffmpeg -y -i "{combined_wav}" -c:a libopus -b:a 32k '
            f'-vbr on -application voip -f webm "{out_path}" -loglevel error 2>&1'
        )
        ret = os.system(cmd)
        if ret != 0:
            raise RuntimeError(f"ffmpeg Opus encoding exited with code {ret}")
    finally:
        combined_wav.unlink(missing_ok=True)

    total_dur = boundaries[-1][1] if boundaries and boundaries[-1] else 0
    print(f"  {n} paragraphs → {total_dur:.1f}s total audio")

    # Build tts_groups: list of (group_start, group_end, [para_indices])
    tts_groups: list[tuple[float, float, list[int]]] = []
    for indices, texts, brks in groups:
        g_start = boundaries[indices[0]][0]
        g_end = boundaries[indices[-1]][1]
        tts_groups.append((g_start, g_end, list(indices)))

    return boundaries, tts_groups


def synthesize_opus_grouped(
    paragraphs: list[str],
    breaks: list[int],
    voice_name: str,
    language_code: str,
    out_path: Path,
    parallel: bool = True,
    prosody: SsmlProsodyOptions | None = None,
) -> list[tuple[float, float]]:
    """Grouped (byte-size) synthesis: pack paragraphs into SSML-size chunks.

    Restores the old strategy of clubbing paragraphs by byte budget.
    Inner paragraph boundaries are estimated proportionally.
    """
    import io
    import wave

    from concurrent.futures import ThreadPoolExecutor, as_completed

    from google.cloud import texttospeech

    client = texttospeech.TextToSpeechClient()
    n = len(paragraphs)
    chunks = _chunk_paragraphs(paragraphs, breaks, prosody=prosody)

    # Build a mapping from chunk index to original paragraph indices
    chunk_para_indices: list[list[int]] = []
    pi = 0
    for chunk_texts, _ in chunks:
        indices = list(range(pi, pi + len(chunk_texts)))
        chunk_para_indices.append(indices)
        pi += len(chunk_texts)

    print(f"  Grouped mode: {n} paragraphs → {len(chunks)} byte-size chunks")

    wav_chunks = _synthesize_chunks_parallel(
        chunks, voice_name, language_code, client, prosody=prosody
    )

    # Concatenate and estimate per-paragraph boundaries
    out_path.parent.mkdir(parents=True, exist_ok=True)
    combined_wav = out_path.with_suffix(".tmp.wav")
    boundaries: list[tuple[float, float]] = [None] * n  # type: ignore[list-item]

    try:
        params = None
        cursor = 0.0
        with wave.open(str(combined_wav), "wb") as wout:
            for ci, raw_wav in enumerate(wav_chunks):
                buf = io.BytesIO(raw_wav)
                with wave.open(buf, "rb") as win:
                    if params is None:
                        params = win.getparams()
                        wout.setparams(params)

                    indices = chunk_para_indices[ci]
                    first_idx = indices[0]

                    # Silence gap before this chunk
                    if first_idx > 0 and breaks[first_idx] > 0:
                        silence_sec = breaks[first_idx] / 1000.0
                        n_silence = int(silence_sec * params.framerate)
                        wout.writeframes(
                            b"\x00" * (n_silence * params.sampwidth * params.nchannels)
                        )
                        cursor += n_silence / params.framerate

                    chunk_start = cursor
                    n_frames = win.getnframes()
                    chunk_dur = n_frames / params.framerate
                    wout.writeframes(win.readframes(n_frames))

                # Estimate per-paragraph boundaries by char count
                chunk_texts = chunks[ci][0]
                char_counts = [max(len(t), 1) for t in chunk_texts]
                total_chars = sum(char_counts)
                inner_cursor = chunk_start
                for j, pi_idx in enumerate(indices):
                    frac = char_counts[j] / total_chars
                    para_dur = chunk_dur * frac
                    boundaries[pi_idx] = (round(inner_cursor, 4), round(inner_cursor + para_dur, 4))
                    inner_cursor += para_dur

                cursor = chunk_start + chunk_dur

        cmd = (
            f'ffmpeg -y -i "{combined_wav}" -c:a libopus -b:a 32k '
            f'-vbr on -application voip -f webm "{out_path}" -loglevel error 2>&1'
        )
        ret = os.system(cmd)
        if ret != 0:
            raise RuntimeError(f"ffmpeg Opus encoding exited with code {ret}")
    finally:
        combined_wav.unlink(missing_ok=True)

    total_dur = boundaries[-1][1] if boundaries and boundaries[-1] else 0
    print(f"  {n} paragraphs → {total_dur:.1f}s total audio")
    return boundaries


def _fix_degenerate_word_times(paragraphs: list[dict], duration: float | None) -> None:
    """Fix words with degenerate (zero-duration) or anomalously long timestamps.

    Handles two patterns produced by stable-ts alignment failures:
    1. A single short word consuming many seconds (e.g. "of" spanning 8s)
    2. Consecutive words collapsed to the same point (start == end)
    These often appear together: one word eats time, the rest get nothing.
    """
    for p in paragraphs:
        words = p.get("words", [])
        if len(words) < 2:
            continue

        p_start = p.get("start", 0) or 0
        p_end = p.get("end", 0) or 0
        total_dur = p_end - p_start
        if total_dur <= 0:
            continue
        avg_dur = total_dur / len(words)

        bad = [False] * len(words)
        for i, w in enumerate(words):
            d = w["e"] - w["s"]
            if d <= 0:
                bad[i] = True
            elif d > max(avg_dur * 5, 2.0) and len(w["w"]) < 10:
                bad[i] = True

        for i in range(1, len(words) - 1):
            if not bad[i] and bad[i - 1]:
                d = words[i]["e"] - words[i]["s"]
                has_bad_after = any(bad[j] for j in range(i + 1, min(i + 3, len(words))))
                if has_bad_after and d < avg_dur * 0.5:
                    bad[i] = True

        i = 0
        while i < len(words):
            if bad[i]:
                run_start = i
                while i < len(words) and bad[i]:
                    i += 1
                run_end = i

                begin = words[run_start - 1]["e"] if run_start > 0 else p_start
                if run_end < len(words):
                    end = words[run_end]["s"]
                else:
                    end = duration if duration else p_end

                n = run_end - run_start
                if n > 0 and end > begin:
                    step = (end - begin) / n
                    for j in range(run_start, run_end):
                        words[j]["s"] = round(begin + (j - run_start) * step, 4)
                        words[j]["e"] = round(begin + (j - run_start + 1) * step, 4)
            else:
                i += 1

        if words and not p.get("_tts_boundaries"):
            p["start"] = min(p_start, words[0]["s"])
            p["end"] = max(p_end, words[-1]["e"])


def _retry_failed_segments(
    paragraphs_out: list[dict],
    audio_path: Path,
    paragraph_specs: list[tuple[int, str, bool]],
    model,
) -> None:
    """Re-align individual paragraphs where the first pass mostly failed.

    Extracts the audio slice for each bad paragraph and runs Whisper
    alignment on that short clip. Much more reliable than a full-file pass
    for isolated failures.
    """
    import tempfile

    if len(paragraphs_out) != len(paragraph_specs):
        return

    retried = 0
    for i, p in enumerate(paragraphs_out):
        words = p.get("words", [])
        if len(words) < 3:
            continue
        degenerate = sum(1 for w in words if w["e"] - w["s"] <= 0)
        if degenerate < len(words) * 0.4:
            continue

        start = p.get("start")
        end = p.get("end")
        if start is None or end is None or end <= start:
            continue

        pid, text, _brk = paragraph_specs[i]
        margin = 0.5
        ss = max(0, start - margin)
        to = end + margin

        tmp = tempfile.NamedTemporaryFile(suffix=".wav", delete=False)
        tmp_path = tmp.name
        tmp.close()

        cmd = (
            f'ffmpeg -y -i "{audio_path}" -ss {ss} -to {to} '
            f'-acodec pcm_s16le -ar 16000 "{tmp_path}" -loglevel error 2>&1'
        )
        ret = os.system(cmd)
        if ret != 0:
            try:
                os.unlink(tmp_path)
            except OSError:
                pass
            continue

        try:
            result = model.align(
                tmp_path, text, "en", original_split=True, fast_mode=True
            )
            new_words: list[dict] = []
            for seg in result.segments or []:
                for w in seg.words or []:
                    new_words.append(
                        {
                            "w": w.word.strip(),
                            "s": round(float(w.start) + ss, 4),
                            "e": round(float(w.end) + ss, 4),
                        }
                    )

            if new_words:
                new_degen = sum(1 for w in new_words if w["e"] - w["s"] <= 0)
                if new_degen < degenerate:
                    p["words"] = new_words
                    p["start"] = new_words[0]["s"]
                    p["end"] = new_words[-1]["e"]
                    retried += 1
                    print(
                        f"  Re-aligned ¶{pid}: {degenerate}/{len(words)} → "
                        f"{new_degen}/{len(new_words)} degenerate words"
                    )
        except Exception as e:
            sys.stderr.write(
                f"  Warning: retry alignment ¶{pid} failed: {e}\n"
            )
        finally:
            try:
                os.unlink(tmp_path)
            except OSError:
                pass

    if retried:
        print(f"  Second-pass alignment improved {retried} paragraph(s)")


def _retry_sentence_split_segments(
    paragraphs_out: list[dict],
    audio_path: Path,
    paragraph_specs: list[tuple[int, str, bool]],
    model,
) -> None:
    """Optional post-pass for repeated adjacent sentence phrases.

    This is intentionally isolated so it is easy to remove or disable:
    set VOICE_ENABLE_SENTENCE_REALIGN=0 to skip it.
    """
    import tempfile

    if os.environ.get("VOICE_ENABLE_SENTENCE_REALIGN", "1") in {"0", "false", "False"}:
        return
    if len(paragraphs_out) != len(paragraph_specs):
        return

    retried = 0
    for i, p in enumerate(paragraphs_out):
        pid, text, _brk = paragraph_specs[i]
        if not _has_adjacent_sentence_overlap(text):
            continue

        sentences = _split_sentences(text)
        if len(sentences) < 2:
            continue

        start = p.get("start")
        end = p.get("end")
        if start is None or end is None or end <= start:
            continue

        expected_words = len(text.split())
        old_words = p.get("words", [])
        old_degen = sum(1 for w in old_words if w["e"] - w["s"] <= 0)

        margin = 0.6
        ss = max(0, start - margin)
        to = end + margin

        tmp = tempfile.NamedTemporaryFile(suffix=".wav", delete=False)
        tmp_path = tmp.name
        tmp.close()

        cmd = (
            f'ffmpeg -y -i "{audio_path}" -ss {ss} -to {to} '
            f'-acodec pcm_s16le -ar 16000 "{tmp_path}" -loglevel error 2>&1'
        )
        ret = os.system(cmd)
        if ret != 0:
            try:
                os.unlink(tmp_path)
            except OSError:
                pass
            continue

        try:
            result = model.align(
                tmp_path,
                "\n\n".join(sentences),
                "en",
                original_split=True,
                fast_mode=True,
            )
            segs = list(result.segments or [])
            if len(segs) != len(sentences):
                continue

            new_words: list[dict] = []
            for seg in segs:
                for w in seg.words or []:
                    new_words.append(
                        {
                            "w": w.word.strip(),
                            "s": round(float(w.start) + ss, 4),
                            "e": round(float(w.end) + ss, 4),
                        }
                    )

            if len(new_words) != expected_words:
                continue

            monotonic = True
            for j, w in enumerate(new_words):
                if w["e"] < w["s"]:
                    monotonic = False
                    break
                if j and w["s"] < new_words[j - 1]["s"]:
                    monotonic = False
                    break
            if not monotonic:
                continue

            new_degen = sum(1 for w in new_words if w["e"] - w["s"] <= 0)
            if new_degen > old_degen:
                continue

            p["words"] = new_words
            p["start"] = new_words[0]["s"]
            p["end"] = new_words[-1]["e"]
            retried += 1
            print(f"  Sentence re-aligned ¶{pid}: {len(sentences)} sentence(s)")
        except Exception as e:
            sys.stderr.write(
                f"  Warning: sentence re-align ¶{pid} failed: {e}\n"
            )
        finally:
            try:
                os.unlink(tmp_path)
            except OSError:
                pass

    if retried:
        print(f"  Sentence-level re-alignment improved {retried} paragraph(s)")


def _align_with_whisperx(
    audio_path: Path,
    paragraph_specs: list[tuple[int, str, bool]],
    paragraph_boundaries: list[tuple[float, float]],
    tts_groups: list[tuple[float, float, list[int]]] | None = None,
    paragraph_specs_display: list[tuple[int, str, bool]] | None = None,
) -> tuple[list[dict], float]:
    """Word-level alignment using WhisperX with known paragraph boundaries.

    When tts_groups are provided (smart chunking), aligns each TTS group as a
    whole using the group's exact audio boundary, then splits aligned words
    across constituent paragraphs by expected word count.  This avoids the
    char-count proportional boundary estimation error that occurs when a long
    paragraph is grouped with several short ones.

    When tts_groups are absent, falls back to per-paragraph alignment using
    the (exact or estimated) paragraph boundaries.

    Returns (paragraphs_out, duration).
    """
    import whisperx

    SAMPLE_RATE = 16000
    device = "cpu"
    audio = whisperx.load_audio(str(audio_path))
    duration = len(audio) / SAMPLE_RATE

    print("  Loading WhisperX alignment model…")
    model_a, metadata = whisperx.load_align_model(language_code="en", device=device)

    paragraphs_out: list[dict] = [None] * len(paragraph_specs)  # type: ignore[list-item]

    if tts_groups:
        print(f"  Aligning {len(tts_groups)} TTS groups with WhisperX (per-group)…")
        for gi, (g_start, g_end, indices) in enumerate(tts_groups):
            # Crop audio to the exact group boundary
            s_sample = int(g_start * SAMPLE_RATE)
            e_sample = int(g_end * SAMPLE_RATE)
            chunk = audio[s_sample:e_sample]
            chunk_dur = len(chunk) / SAMPLE_RATE

            # Build segments: one per paragraph in the group
            group_specs = [(paragraph_specs[i], i) for i in indices]
            expected_word_counts = [len(spec[1].split()) for spec, _ in group_specs]

            if len(indices) == 1:
                # Solo paragraph: align directly
                pid, text, _brk = paragraph_specs[indices[0]]
                pb_start, pb_end = paragraph_boundaries[indices[0]]
                seg = [{"text": text, "start": 0.0, "end": chunk_dur}]
                words_out = _whisperx_align_chunk(
                    seg, model_a, metadata, chunk, device, g_start
                )
                if not words_out:
                    words_out = _proportional_fallback(text, g_start, g_end)
                    sys.stderr.write(f"  Warning: ¶{pid} fell back to proportional word timing\n")
                paragraphs_out[indices[0]] = {
                    "id": pid,
                    "start": pb_start,
                    "end": pb_end,
                    "words": words_out,
                    "_tts_boundaries": True,
                }
            else:
                # Multi-paragraph group: align all text as one chunk, split by word count
                combined_text = " ".join(spec[1] for spec, _ in group_specs)
                seg = [{"text": combined_text, "start": 0.0, "end": chunk_dur}]
                all_words = _whisperx_align_chunk(
                    seg, model_a, metadata, chunk, device, g_start
                )

                if all_words:
                    # Split aligned words across paragraphs by expected word count
                    per_para_words: list[list[dict]] = []
                    widx = 0
                    for j, pi in enumerate(indices):
                        exp_n = expected_word_counts[j]
                        para_words = all_words[widx:widx + exp_n]
                        widx += exp_n
                        per_para_words.append(para_words)
                    if widx != len(all_words):
                        sys.stderr.write(
                            f"  Warning: group {gi+1} word split mismatch: "
                            f"used {widx} of {len(all_words)} aligned words\n"
                        )

                    # Recalculate inner boundaries from actual word
                    # timestamps instead of char-count proportional
                    # estimates.  First/last paragraphs keep the group's
                    # TTS boundary; inner splits use the midpoint of the
                    # silence gap between adjacent paragraphs' words.
                    for j, pi in enumerate(indices):
                        pw = per_para_words[j]
                        if j == 0:
                            new_start = paragraph_boundaries[indices[0]][0]
                        else:
                            prev_pw = per_para_words[j - 1]
                            prev_last_e = prev_pw[-1]["e"] if prev_pw else paragraph_boundaries[pi][0]
                            cur_first_s = pw[0]["s"] if pw else paragraph_boundaries[pi][0]
                            new_start = round((prev_last_e + cur_first_s) / 2, 4)
                        if j == len(indices) - 1:
                            new_end = paragraph_boundaries[indices[-1]][1]
                        else:
                            next_pw = per_para_words[j + 1]
                            cur_last_e = pw[-1]["e"] if pw else paragraph_boundaries[pi][1]
                            next_first_s = next_pw[0]["s"] if next_pw else paragraph_boundaries[pi][1]
                            new_end = round((cur_last_e + next_first_s) / 2, 4)
                        paragraph_boundaries[pi] = (new_start, new_end)

                    for j, pi in enumerate(indices):
                        pid = paragraph_specs[pi][0]
                        pb_start, pb_end = paragraph_boundaries[pi]
                        paragraphs_out[pi] = {
                            "id": pid,
                            "start": pb_start,
                            "end": pb_end,
                            "words": per_para_words[j],
                            "_tts_boundaries": True,
                        }
                else:
                    # Fallback: proportional per paragraph
                    for pi in indices:
                        pid, text, _brk = paragraph_specs[pi]
                        p_start, p_end = paragraph_boundaries[pi]
                        words_out = _proportional_fallback(text, p_start, p_end)
                        sys.stderr.write(f"  Warning: ¶{pid} fell back to proportional word timing\n")
                        paragraphs_out[pi] = {
                            "id": pid, "start": p_start, "end": p_end,
                            "words": words_out, "_tts_boundaries": True,
                        }

            label = (
                f"¶{indices[0]+1}"
                if len(indices) == 1
                else f"¶{indices[0]+1}–{indices[-1]+1}"
            )
            n_aligned = sum(len(paragraphs_out[pi]["words"]) for pi in indices)
            print(f"  Group {gi+1} ({label}): {n_aligned} words aligned")
            if paragraph_specs_display is not None:
                print_tts_group_paragraph_previews(
                    indices, paragraph_specs_display, VOICE_PREVIEW_WORDS_GEN
                )
    else:
        # Fallback: per-paragraph alignment (paragraph mode or no group info)
        print(f"  Aligning {len(paragraph_specs)} paragraphs with WhisperX (per-paragraph)…")
        for i, (pid, text, _brk) in enumerate(paragraph_specs):
            p_start, p_end = paragraph_boundaries[i]

            s_sample = int(p_start * SAMPLE_RATE)
            e_sample = int(p_end * SAMPLE_RATE)
            chunk = audio[s_sample:e_sample]
            chunk_dur = len(chunk) / SAMPLE_RATE

            seg = [{"text": text, "start": 0.0, "end": chunk_dur}]
            words_out = _whisperx_align_chunk(
                seg, model_a, metadata, chunk, device, p_start
            )
            if not words_out:
                words_out = _proportional_fallback(text, p_start, p_end)
                sys.stderr.write(f"  Warning: ¶{pid} fell back to proportional word timing\n")

            paragraphs_out[i] = {
                "id": pid, "start": p_start, "end": p_end,
                "words": words_out, "_tts_boundaries": True,
            }

    print("  WhisperX alignment complete")

    del model_a
    import gc
    gc.collect()

    return paragraphs_out, duration


def _whisperx_align_chunk(
    segments: list[dict],
    model_a,
    metadata,
    audio_chunk,
    device: str,
    time_offset: float,
) -> list[dict]:
    """Run WhisperX alignment on an audio chunk and return word list with absolute times."""
    import whisperx

    try:
        result = whisperx.align(
            segments, model_a, metadata, audio_chunk, device,
            return_char_alignments=False,
        )
        words_out: list[dict] = []
        for aseg in result.get("segments", []):
            for w in aseg.get("words", []):
                w_start = w.get("start")
                w_end = w.get("end")
                w_text = w.get("word", "").strip()
                if w_start is not None and w_end is not None:
                    words_out.append({
                        "w": w_text,
                        "s": round(time_offset + float(w_start), 4),
                        "e": round(time_offset + float(w_end), 4),
                    })
                else:
                    words_out.append({
                        "w": w_text,
                        "s": round(time_offset + float(w_start or 0), 4),
                        "e": round(time_offset + float(w_end or 0), 4),
                    })
        return words_out
    except Exception as e:
        sys.stderr.write(f"  Warning: WhisperX alignment failed: {e}\n")
        return []


def _proportional_fallback(
    text: str, p_start: float, p_end: float
) -> list[dict]:
    """Distribute words proportionally by character count as a last resort."""
    word_list = text.split()
    total_chars = sum(max(len(w), 1) for w in word_list)
    p_dur = p_end - p_start
    cur = p_start
    words_out: list[dict] = []
    for w in word_list:
        frac = max(len(w), 1) / total_chars
        w_dur = p_dur * frac
        words_out.append({"w": w, "s": round(cur, 4), "e": round(cur + w_dur, 4)})
        cur += w_dur
    return words_out


def align_to_manifest(
    audio_path: Path,
    paragraph_specs: list[tuple[int, str, bool]],
    voice_name: str,
    text_hash_hex: str,
    skip_align: bool,
    paragraph_boundaries: list[tuple[float, float]] | None = None,
    tts_groups: list[tuple[float, float, list[int]]] | None = None,
    paragraph_specs_display: list[tuple[int, str, bool]] | None = None,
) -> dict:
    audio_hash = file_hash(audio_path)

    if skip_align:
        return {
            "version": 1,
            "textHash": text_hash_hex,
            "audioHash": audio_hash,
            "voice": voice_name,
            "generatedAt": None,
            "duration": None,
            "paragraphs": [
                {
                    "id": pid,
                    "start": None,
                    "end": None,
                    "words": [],
                }
                for pid, _, _brk in paragraph_specs
            ],
            "note": "Alignment skipped (--skip-align).",
        }

    paragraphs_out: list[dict] | None = None
    duration: float | None = None

    # ── New path: WhisperX with ground-truth paragraph boundaries ──
    if paragraph_boundaries:
        try:
            paragraphs_out, duration = _align_with_whisperx(
                audio_path, paragraph_specs, paragraph_boundaries,
                tts_groups=tts_groups,
                paragraph_specs_display=paragraph_specs_display,
            )
        except ImportError:
            sys.stderr.write(
                "  Warning: whisperx not installed, falling back to stable_whisper\n"
            )
        except Exception as e:
            sys.stderr.write(
                f"  Warning: WhisperX alignment failed ({e}), "
                f"falling back to stable_whisper\n"
            )

    # ── Legacy path: full-file stable_whisper alignment ──
    if paragraphs_out is None:
        import stable_whisper

        model_name = os.environ.get("WHISPER_MODEL", "base")
        model = stable_whisper.load_model(model_name)

        transcript_for_align = "\n\n".join(p for _, p, _brk in paragraph_specs)

        result = model.align(
            str(audio_path),
            transcript_for_align,
            "en",
            original_split=True,
            fast_mode=True,
        )

        duration = getattr(result, "duration", None)
        if duration is None and result.segments:
            duration = max(s.end for s in result.segments)

        paragraphs_out = []

        segs = list(result.segments) if result.segments else []
        if len(segs) == len(paragraph_specs):
            for i_seg, ((pid, _, _brk), seg) in enumerate(zip(paragraph_specs, segs)):
                words_out: list[dict] = []
                if seg.words:
                    for w in seg.words:
                        words_out.append(
                            {
                                "w": w.word.strip(),
                                "s": round(float(w.start), 4),
                                "e": round(float(w.end), 4),
                            }
                        )
                if paragraph_boundaries and i_seg < len(paragraph_boundaries):
                    pb_start, pb_end = paragraph_boundaries[i_seg]
                else:
                    pb_start = round(float(seg.start), 4)
                    pb_end = round(float(seg.end), 4)
                paragraphs_out.append(
                    {
                        "id": pid,
                        "start": pb_start,
                        "end": pb_end,
                        "words": words_out,
                    }
                )
        else:
            flat: list = []
            for seg in segs:
                if seg.words:
                    flat.extend(seg.words)
            expected_counts = [len(p.split()) for _, p, _brk in paragraph_specs]
            idx = 0
            for i_seg, ((pid, _, _brk), exp_n) in enumerate(zip(paragraph_specs, expected_counts)):
                slice_words = flat[idx : idx + exp_n]
                idx += exp_n
                words_out = [
                    {
                        "w": w.word.strip(),
                        "s": round(float(w.start), 4),
                        "e": round(float(w.end), 4),
                    }
                    for w in slice_words
                ]
                if paragraph_boundaries and i_seg < len(paragraph_boundaries):
                    pb_start, pb_end = paragraph_boundaries[i_seg]
                else:
                    pb_start = words_out[0]["s"] if words_out else None
                    pb_end = words_out[-1]["e"] if words_out else None
                paragraphs_out.append(
                    {
                        "id": pid,
                        "start": pb_start,
                        "end": pb_end,
                        "words": words_out,
                    }
                )
            if idx != len(flat):
                sys.stderr.write(
                    f"Warning: word count mismatch after assign "
                    f"(used {idx} of {len(flat)} aligned words).\n"
                )

        _retry_failed_segments(paragraphs_out, audio_path, paragraph_specs, model)
        _retry_sentence_split_segments(
            paragraphs_out, audio_path, paragraph_specs, model
        )

    _fix_degenerate_word_times(paragraphs_out, duration)

    # ── Clamp first/last paragraph to [0, duration] ──────────────────────
    # Paragraph boundaries derive from raw WAV cursor positions, but the
    # manifest duration comes from the encoded opus/webm file which may be
    # slightly longer due to codec padding.  Ensure the first paragraph
    # starts at 0.0 and the last paragraph ends at the true audio duration
    # so playback never clips the beginning/end.
    if duration is not None and paragraphs_out:
        dur_rounded = round(float(duration), 4)
        if paragraphs_out[0]["start"] > 0.0:
            paragraphs_out[0]["start"] = 0.0
        if paragraphs_out[-1]["end"] < dur_rounded:
            paragraphs_out[-1]["end"] = dur_rounded
        if paragraph_boundaries:
            s0, e0 = paragraph_boundaries[0]
            if s0 > 0.0:
                paragraph_boundaries[0] = (0.0, e0)
            sN, eN = paragraph_boundaries[-1]
            if eN < dur_rounded:
                paragraph_boundaries[-1] = (sN, dur_rounded)
        if tts_groups:
            gs0, ge0, gi0 = tts_groups[0]
            if gs0 > 0.0:
                tts_groups[0] = (0.0, ge0, gi0)
            gsN, geN, giN = tts_groups[-1]
            if geN < dur_rounded:
                tts_groups[-1] = (gsN, dur_rounded, giN)

    from datetime import datetime, timezone

    manifest: dict = {
        "version": 2 if paragraph_boundaries else 1,
        "textHash": text_hash_hex,
        "audioHash": audio_hash,
        "voice": voice_name,
        "generatedAt": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "duration": round(float(duration), 4) if duration is not None else None,
        "paragraphs": paragraphs_out,
    }

    if paragraph_boundaries:
        manifest["ttsBoundaries"] = [
            {"start": s, "end": e} for s, e in paragraph_boundaries
        ]

    if tts_groups:
        manifest["ttsGroups"] = [
            {"start": s, "end": e, "paragraphs": indices}
            for s, e, indices in tts_groups
        ]

    # Strip internal flags before serialisation
    for p in paragraphs_out:
        p.pop("_tts_boundaries", None)

    return manifest


def resolve_mdx_path(slug: str) -> Path:
    en_dir = REPO_ROOT / "src" / "content" / "en"
    found = list(en_dir.rglob(f"{slug}.mdx"))
    if len(found) != 1:
        raise FileNotFoundError(
            f"Expected exactly one {slug}.mdx under src/content/en, found {len(found)}: {found}"
        )
    return found[0]


def process_one_discourse(
    slug: str,
    voice_name: str,
    language_code: str,
    break_ms: int,
    consecutive_break_ms: int,
    skip_align: bool,
    align_only: bool = False,
    chunking: str = "smart",
    verbose_tts: bool = False,
    grouping_preference: str | None = None,
    prosody: SsmlProsodyOptions | None = None,
) -> int:
    mdx_path = resolve_mdx_path(slug)
    raw = mdx_path.read_text(encoding="utf-8")
    body = strip_frontmatter(raw)
    raw_chunks = extract_paragraph_chunks_auto(body)
    # Display text: used for forced alignment and manifest word tokens (matches DOM).
    paragraph_specs = extract_paragraphs_auto(body)
    if not paragraph_specs:
        print(
            f"[skip] {slug}: no paragraphs extracted from MDX.",
            file=sys.stderr,
        )
        return 1

    # TTS text: built from the same raw body with TTS overrides applied.
    # Used ONLY for synthesis — never for alignment or manifest tokens.
    paragraph_specs_for_tts = extract_paragraphs_auto(body, for_tts=True)

    paragraphs_tts = [
        apply_tts_long_a_macron_hint(apply_tts_phonetic_spellings(p))
        for _, p, _ in paragraph_specs_for_tts
    ]
    # Alignment: DOM display + loanword phonetics (matches audio for those words). No ā→aa.
    paragraph_specs_align = [
        (pid, apply_tts_phonetic_spellings(p), brk)
        for pid, p, brk in paragraph_specs
    ]
    paragraphs_text = [p for _, p, _ in paragraph_specs]
    full_plain = "\n\n".join(paragraphs_text)
    th = text_hash(full_plain)

    out_audio = REPO_ROOT / "public" / "audio" / f"{slug}.webm"
    out_manifest = REPO_ROOT / "public" / "audio" / f"{slug}.manifest.json"
    out_tts_debug = REPO_ROOT / "public" / "audio" / f"{slug}.tts-debug.json"

    print(f"\nMDX: {mdx_path.relative_to(REPO_ROOT)}")
    print(f"Paragraphs: {len(paragraph_specs)}")
    print(f"Output: {out_audio.relative_to(REPO_ROOT)}")

    # Backup existing files before any writes (enables rollback after generation)
    _backed_up: list[str] = []
    for _f in [out_audio, out_manifest]:
        if _f.exists():
            _bak = _f.with_suffix(_f.suffix + ".bak")
            shutil.copy2(_f, _bak)
            _backed_up.append(str(_bak.relative_to(REPO_ROOT)))

    breaks: list[int] = []
    for i, (_, _, is_break) in enumerate(paragraph_specs):
        if i == 0:
            breaks.append(0)
        elif is_break:
            breaks.append(break_ms)
        else:
            breaks.append(consecutive_break_ms)

    forced_groups: list[tuple[list[int], list[str], list[int]]] | None = None
    if grouping_preference:
        if align_only:
            print(
                f"[skip] {slug}: --grouping-preference cannot be used with --align-only.",
                file=sys.stderr,
            )
            return 1
        try:
            forced_groups = build_grouping_preference_groups(
                paragraphs_tts,
                breaks,
                grouping_preference,
                prosody=prosody,
            )
            print(f"  Grouping preference: {grouping_preference}")
        except ValueError as e:
            print(
                f"[skip] {slug}: {e}",
                file=sys.stderr,
            )
            return 1

    chunking_for_display = "user-provided" if forced_groups is not None else chunking

    if verbose_tts:
        debug_payload = build_tts_debug_payload(
            slug,
            mdx_path,
            raw_chunks,
            paragraph_specs,
            paragraph_specs_for_tts,
            paragraphs_tts,
            breaks,
            chunking_for_display,
            forced_groups=forced_groups,
            prosody=prosody,
        )
        emit_tts_debug_payload(debug_payload, out_tts_debug)

    paragraph_boundaries: list[tuple[float, float]] | None = None
    tts_groups: list[tuple[float, float, list[int]]] | None = None

    if align_only:
        if not out_audio.exists():
            print(f"[skip] {slug}: no existing .webm file for --align-only.", file=sys.stderr)
            return 1
        print(f"  --align-only: skipping TTS, re-aligning existing {out_audio.name}")
        # Try to read TTS boundaries and groups from existing manifest
        if out_manifest.exists():
            try:
                existing = json.loads(out_manifest.read_text(encoding="utf-8"))
                tts_b = existing.get("ttsBoundaries")
                # Real TTS boundaries always start at 0.0 (the audio cursor
                # begins there).  If the first boundary start > 0, these were
                # likely carried over from tight word alignment, not actual TTS
                # synthesis — treat as if missing.
                if (
                    tts_b
                    and len(tts_b) == len(paragraph_specs)
                    and tts_b[0].get("start", 1) == 0
                ):
                    paragraph_boundaries = [
                        (b["start"], b["end"]) for b in tts_b
                    ]
                    print(
                        f"  Using {len(paragraph_boundaries)} TTS paragraph "
                        f"boundaries from existing manifest"
                    )
                elif not tts_b or (tts_b and tts_b[0].get("start", 1) > 0):
                    # v1 manifests lack ttsBoundaries; recover from paragraph
                    # start/end but extend into silence gaps so each paragraph
                    # owns the natural TTS breath room around its speech.
                    existing_paras = existing.get("paragraphs", [])
                    ex_dur = existing.get("duration")
                    if len(existing_paras) == len(paragraph_specs):
                        tight = []
                        for ep in existing_paras:
                            s = ep.get("start")
                            e = ep.get("end")
                            if s is not None and e is not None:
                                tight.append((float(s), float(e)))
                        if len(tight) == len(paragraph_specs):
                            recovered = []
                            for i, (s, e) in enumerate(tight):
                                # Extend start: midpoint of gap to previous paragraph
                                if i == 0:
                                    new_s = 0.0
                                else:
                                    prev_end = tight[i - 1][1]
                                    new_s = round((prev_end + s) / 2, 4)
                                # Extend end: midpoint of gap to next paragraph
                                if i == len(tight) - 1:
                                    new_e = round(float(ex_dur), 4) if ex_dur else e
                                else:
                                    next_start = tight[i + 1][0]
                                    new_e = round((e + next_start) / 2, 4)
                                recovered.append((new_s, new_e))
                            paragraph_boundaries = recovered
                            print(
                                f"  Recovered {len(paragraph_boundaries)} paragraph "
                                f"boundaries from v1 manifest (gap-split)"
                            )
                tts_g = existing.get("ttsGroups")
                if tts_g:
                    tts_groups = [
                        (g["start"], g["end"], g["paragraphs"]) for g in tts_g
                    ]
                    print(f"  Using {len(tts_groups)} TTS groups from existing manifest")
                elif paragraph_boundaries and chunking == "smart":
                    # Reconstruct groups from text for older manifests missing ttsGroups
                    _breaks: list[int] = []
                    _texts: list[str] = []
                    for j, (_, _, is_brk) in enumerate(paragraph_specs):
                        _texts.append(paragraphs_tts[j])
                        if j == 0:
                            _breaks.append(0)
                        elif is_brk:
                            _breaks.append(break_ms)
                        else:
                            _breaks.append(consecutive_break_ms)
                    groups = _merge_short_paragraphs(_texts, _breaks, prosody=prosody)
                    tts_groups = []
                    for indices, _, _ in groups:
                        g_start = paragraph_boundaries[indices[0]][0]
                        g_end = paragraph_boundaries[indices[-1]][1]
                        tts_groups.append((g_start, g_end, list(indices)))
                    print(f"  Reconstructed {len(tts_groups)} TTS groups from paragraph text")
            except Exception:
                pass
    else:
        n_long = sum(1 for b in breaks if b == break_ms)
        n_short = sum(1 for b in breaks if b == consecutive_break_ms)
        print(f"  Breaks: {n_long} × {break_ms}ms (verse), {n_short} × {consecutive_break_ms}ms (prose)")
        print(f"  Chunking: {chunking_for_display}")

        if forced_groups is not None:
            paragraph_boundaries, tts_groups = synthesize_opus_smart(
                paragraphs_tts,
                breaks,
                voice_name,
                language_code,
                out_audio,
                forced_groups=forced_groups,
                paragraph_specs_display=paragraph_specs,
                prosody=prosody,
            )
        elif chunking == "smart":
            paragraph_boundaries, tts_groups = synthesize_opus_smart(
                paragraphs_tts,
                breaks,
                voice_name,
                language_code,
                out_audio,
                paragraph_specs_display=paragraph_specs,
                prosody=prosody,
            )
        elif chunking == "grouped":
            paragraph_boundaries = synthesize_opus_grouped(
                paragraphs_tts,
                breaks,
                voice_name,
                language_code,
                out_audio,
                prosody=prosody,
            )
        else:  # "paragraph"
            paragraph_boundaries = synthesize_opus(
                paragraphs_tts,
                breaks,
                voice_name,
                language_code,
                out_audio,
                prosody=prosody,
            )

    manifest = align_to_manifest(
        out_audio,
        paragraph_specs_align,
        voice_name,
        th,
        skip_align=skip_align,
        paragraph_boundaries=paragraph_boundaries,
        tts_groups=tts_groups,
        paragraph_specs_display=paragraph_specs,
    )
    if not skip_align:
        restore_manifest_display_words(manifest["paragraphs"], paragraph_specs)

    out_manifest.write_text(
        json.dumps(manifest, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
    print(f"Manifest: {out_manifest.relative_to(REPO_ROOT)}")
    if _backed_up:
        for _b in _backed_up:
            print(f"  Backup: {_b}")
        print(f"  Rollback: npm run voice:edit -- {slug} --rollback")
    return 0


def main() -> int:
    load_dotenv()

    parser = argparse.ArgumentParser(
        description="Generate TTS audio + manifest for one or more discourses.",
    )
    parser.add_argument(
        "targets",
        nargs="+",
        metavar="TARGET",
        help="Discourse slugs and/or collection tokens (see scripts/README-voice.md).",
    )
    parser.add_argument(
        "--skip-align",
        action="store_true",
        help="Only run Google TTS; skip Whisper alignment.",
    )
    parser.add_argument(
        "--align-only",
        action="store_true",
        help="Re-run Whisper alignment on existing .webm; skip TTS synthesis.",
    )
    parser.add_argument(
        "--chunking",
        choices=["smart", "paragraph", "grouped"],
        default="smart",
        help=(
            "TTS chunking strategy. "
            "'smart' (default): merges short paragraphs with neighbors for better prosody. "
            "'paragraph': each paragraph synthesized individually (old default). "
            "'grouped': pack paragraphs into byte-size chunks (legacy)."
        ),
    )
    parser.add_argument(
        "--verbose-tts",
        action="store_true",
        help=(
            "Print and save the exact per-paragraph spoken text and SSML sent to Google TTS, "
            "including warnings for empty |display::::| overrides that fall back to display text."
        ),
    )
    parser.add_argument(
        "--grouping-preference",
        help=(
            "Optional user-provided paragraph grouping for TTS calls. "
            "Format: 1-3,4-5,6 (1-based paragraph indices). "
            "Must cover all paragraphs exactly once in ascending order. "
            "If any group exceeds the SSML byte limit, generation stops with a hint."
        ),
    )
    parser.add_argument(
        "--prosody-pitch",
        metavar="VALUE",
        default=None,
        help="Wrap SSML in <prosody pitch=…> (e.g. medium, default, +0st).",
    )
    parser.add_argument(
        "--prosody-rate",
        metavar="VALUE",
        default=None,
        help="Wrap SSML in <prosody rate=…> (e.g. 90%%, slow). May stack with TTS_SPEAKING_RATE.",
    )
    parser.add_argument(
        "--prosody-volume",
        metavar="VALUE",
        default=None,
        help="Wrap SSML in <prosody volume=…> (e.g. silent, soft, medium).",
    )
    args = parser.parse_args()

    creds = os.environ.get("GOOGLE_APPLICATION_CREDENTIALS")
    if not creds or not Path(creds).expanduser().is_file():
        print(
            "Set GOOGLE_APPLICATION_CREDENTIALS to your service account JSON path.",
            file=sys.stderr,
        )
        return 1

    voice_name = os.environ.get("TTS_VOICE", "en-US-Studio-M")
    language_code = os.environ.get("TTS_LANGUAGE_CODE", "en-US")
    speaking_rate = float(os.environ.get("TTS_SPEAKING_RATE", "0.9"))
    break_ms = int(os.environ.get("TTS_PARAGRAPH_BREAK_MS", "1200"))
    consecutive_break_ms = int(os.environ.get("TTS_CONSECUTIVE_PARAGRAPH_BREAK_MS", "800"))

    routes = load_routes()
    slugs = expand_all_args(args.targets, routes)

    if not slugs:
        print(
            "No matching discourses for: "
            + " ".join(args.targets)
            + "\nCheck spelling and src/utils/routes.ts.",
            file=sys.stderr,
        )
        return 1

    print(f"Resolved {len(slugs)} discourse(s): {', '.join(slugs[:12])}{' …' if len(slugs) > 12 else ''}")
    chunking = args.chunking
    chunking_banner = "user-provided" if args.grouping_preference else chunking
    prosody = optional_ssml_prosody(
        args.prosody_pitch, args.prosody_rate, args.prosody_volume
    )
    print(
        f"Voice: {voice_name} | rate: {speaking_rate} | breaks: {break_ms}ms (verse) / {consecutive_break_ms}ms (prose) | chunking: {chunking_banner}"
    )
    if prosody:
        bits = []
        if prosody.pitch:
            bits.append(f"pitch={prosody.pitch}")
        if prosody.rate:
            bits.append(f"rate={prosody.rate}")
        if prosody.volume:
            bits.append(f"volume={prosody.volume}")
        print(f"SSML prosody: {' '.join(bits)}")

    failed = 0
    for slug in slugs:
        try:
            rc = process_one_discourse(
                slug,
                voice_name,
                language_code,
                break_ms,
                consecutive_break_ms,
                skip_align=args.skip_align,
                align_only=args.align_only,
                chunking=chunking,
                verbose_tts=args.verbose_tts,
                grouping_preference=args.grouping_preference,
                prosody=prosody,
            )
            failed += rc
        except Exception as e:
            print(f"[error] {slug}: {e}", file=sys.stderr)
            failed += 1

    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
