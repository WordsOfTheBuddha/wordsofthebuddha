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

See scripts/README-voice.md
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import sys
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
    """
    def _replace(m: re.Match) -> str:
        display = m.group(1)
        rest = m.group(2)  # "tooltip" or "tooltip::tts-override"
        parts = rest.split("::")
        if len(parts) >= 2 and parts[1].strip():
            return parts[1].strip()
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
    """Rewrite selected loanwords for English Chirp TTS before synthesis (e.g. bhikkhu → bickkoo).

    Canonical MDX text is unchanged in `paragraph_specs`; alignment uses this text, then
    `restore_manifest_display_words` maps manifest tokens back to real spellings.
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


# Lowercase cores of phonetic tokens → canonical (for manifest restore fallback)
_PHONETIC_CORE_TO_CANONICAL = {
    "ara-hant": "arahant",
    "ara-hants": "arahants",
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
    text = re.sub(r"—", ", ", text)
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


def _starts_with_quote(text: str) -> bool:
    """True if the normalized text begins with a quotation mark."""
    return bool(re.match(r"""^[\u2018\u2019\u201c\u201d"']""", text.strip()))


def extract_paragraphs_heading_style(body: str, for_tts: bool = False) -> list[tuple[int, str, bool]]:
    """Split on #### N headings (DHP-style).
    Returns (paragraph_number, normalized_text, is_verse_or_quote)."""
    pattern = re.compile(r"^####\s+(\d+)\s*$", re.MULTILINE)
    matches = list(pattern.finditer(body))
    out: list[tuple[int, str, bool]] = []
    for i, m in enumerate(matches):
        start = m.end()
        end = matches[i + 1].start() if i + 1 < len(matches) else len(body)
        num = int(m.group(1))
        chunk = body[start:end]
        plain = normalize_paragraph_body(chunk, for_tts=for_tts)
        if plain:
            is_break = _is_verse(chunk) or _starts_with_quote(plain)
            out.append((num, plain, is_break))
    return out


def extract_paragraphs_prose(body: str, for_tts: bool = False) -> list[tuple[int, str, bool]]:
    """Prose / MN-style: split on blank lines into blocks; paragraph numbers 1..n.
    Returns (paragraph_number, normalized_text, is_verse_or_quote)."""
    chunks = re.split(r"\n\s*\n+", body.strip())
    out: list[tuple[int, str, bool]] = []
    n = 1
    for ch in chunks:
        plain = normalize_paragraph_body(ch, for_tts=for_tts)
        if plain:
            is_break = _is_verse(ch) or _starts_with_quote(plain)
            out.append((n, plain, is_break))
            n += 1
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


def build_ssml(
    paragraphs: list[str],
    break_ms: int | list[int],
) -> str:
    """Build SSML from paragraphs with per-paragraph break durations.
    break_ms can be a single int (uniform) or a list aligned with paragraphs
    where each value is the break *before* that paragraph (index 0 is unused)."""
    breaks: list[int]
    if isinstance(break_ms, list):
        breaks = break_ms
    else:
        breaks = [break_ms] * len(paragraphs)

    parts: list[str] = ["<speak>"]
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
    parts.append("</speak>")
    return "".join(parts)


def text_hash(full_text: str) -> str:
    return hashlib.sha256(full_text.encode("utf-8")).hexdigest()


MAX_SSML_BYTES = 4800  # Google TTS limit is 5000; leave margin


def _chunk_paragraphs(
    paragraphs: list[str],
    breaks: list[int],
) -> list[tuple[list[str], list[int]]]:
    """Split paragraph list into groups whose SSML fits within the byte limit.
    Returns list of (paragraph_texts, break_durations) tuples per chunk."""
    chunks: list[tuple[list[str], list[int]]] = []
    cur_texts: list[str] = []
    cur_breaks: list[int] = []
    for i, p in enumerate(paragraphs):
        trial_texts = cur_texts + [p]
        trial_breaks = cur_breaks + [breaks[i] if i < len(breaks) else 800]
        ssml = build_ssml(trial_texts, trial_breaks)
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
        speaking_rate=1.0,
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
) -> list[bytes]:
    """Synthesize TTS chunks in parallel using a thread pool.
    Google TTS is IO-bound (network), so threads give near-linear speedup."""
    from concurrent.futures import ThreadPoolExecutor, as_completed

    ssmls: list[str] = []
    for i, (chunk_texts, chunk_breaks) in enumerate(chunks):
        ssml = build_ssml(chunk_texts, chunk_breaks)
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


def synthesize_opus(
    paragraphs: list[str],
    breaks: list[int],
    voice_name: str,
    language_code: str,
    out_path: Path,
    parallel: bool = True,
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
    ssmls = [build_ssml([p], [0]) for p in paragraphs]
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
) -> tuple[list[dict], float]:
    """Word-level alignment using WhisperX with known paragraph boundaries.

    Aligns each paragraph independently by cropping the audio to the known
    TTS boundary, then offsetting word timestamps to absolute time. This
    avoids WhisperX ignoring segment boundaries when given the full file.

    Returns (paragraphs_out, duration).
    """
    import whisperx

    SAMPLE_RATE = 16000
    device = "cpu"
    audio = whisperx.load_audio(str(audio_path))
    duration = len(audio) / SAMPLE_RATE

    print("  Loading WhisperX alignment model…")
    model_a, metadata = whisperx.load_align_model(language_code="en", device=device)

    print(f"  Aligning {len(paragraph_specs)} paragraphs with WhisperX (per-paragraph)…")

    paragraphs_out: list[dict] = []
    for i, (pid, text, _brk) in enumerate(paragraph_specs):
        p_start, p_end = paragraph_boundaries[i]
        words_out: list[dict] = []

        # Crop audio to this paragraph's boundaries
        s_sample = int(p_start * SAMPLE_RATE)
        e_sample = int(p_end * SAMPLE_RATE)
        chunk = audio[s_sample:e_sample]
        chunk_dur = len(chunk) / SAMPLE_RATE

        # Single segment covering full chunk (relative times 0..chunk_dur)
        seg = [{"text": text, "start": 0.0, "end": chunk_dur}]

        try:
            result = whisperx.align(
                seg, model_a, metadata, chunk, device,
                return_char_alignments=False,
            )
            aligned = result.get("segments", [])
            if aligned:
                for aseg in aligned:
                    for w in aseg.get("words", []):
                        w_start = w.get("start")
                        w_end = w.get("end")
                        w_text = w.get("word", "").strip()
                        if w_start is not None and w_end is not None:
                            # Offset from chunk-relative to absolute time
                            words_out.append({
                                "w": w_text,
                                "s": round(p_start + float(w_start), 4),
                                "e": round(p_start + float(w_end), 4),
                            })
                        else:
                            words_out.append({
                                "w": w_text,
                                "s": round(p_start + float(w_start or 0), 4),
                                "e": round(p_start + float(w_end or 0), 4),
                            })
        except Exception as e:
            sys.stderr.write(f"  Warning: WhisperX failed on ¶{pid}: {e}\n")

        if not words_out:
            # Fallback: proportional distribution by character count
            word_list = text.split()
            total_chars = sum(max(len(w), 1) for w in word_list)
            p_dur = p_end - p_start
            cur = p_start
            for w in word_list:
                frac = max(len(w), 1) / total_chars
                w_dur = p_dur * frac
                words_out.append(
                    {"w": w, "s": round(cur, 4), "e": round(cur + w_dur, 4)}
                )
                cur += w_dur
            sys.stderr.write(f"  Warning: ¶{pid} fell back to proportional word timing\n")

        paragraphs_out.append(
            {"id": pid, "start": p_start, "end": p_end, "words": words_out,
             "_tts_boundaries": True}
        )

    print("  WhisperX alignment complete")

    # Free alignment model
    del model_a
    import gc

    gc.collect()

    return paragraphs_out, duration


def align_to_manifest(
    audio_path: Path,
    paragraph_specs: list[tuple[int, str, bool]],
    voice_name: str,
    text_hash_hex: str,
    skip_align: bool,
    paragraph_boundaries: list[tuple[float, float]] | None = None,
) -> dict:
    if skip_align:
        return {
            "version": 1,
            "textHash": text_hash_hex,
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
                audio_path, paragraph_specs, paragraph_boundaries
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
            for (pid, _, _brk), seg in zip(paragraph_specs, segs):
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
                paragraphs_out.append(
                    {
                        "id": pid,
                        "start": round(float(seg.start), 4),
                        "end": round(float(seg.end), 4),
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
            for (pid, _, _brk), exp_n in zip(paragraph_specs, expected_counts):
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
                start = words_out[0]["s"] if words_out else None
                end = words_out[-1]["e"] if words_out else None
                paragraphs_out.append(
                    {
                        "id": pid,
                        "start": start,
                        "end": end,
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

    from datetime import datetime, timezone

    manifest: dict = {
        "version": 2 if paragraph_boundaries else 1,
        "textHash": text_hash_hex,
        "voice": voice_name,
        "generatedAt": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "duration": round(float(duration), 4) if duration is not None else None,
        "paragraphs": paragraphs_out,
    }

    if paragraph_boundaries:
        manifest["ttsBoundaries"] = [
            {"start": s, "end": e} for s, e in paragraph_boundaries
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
) -> int:
    mdx_path = resolve_mdx_path(slug)
    raw = mdx_path.read_text(encoding="utf-8")
    body = strip_frontmatter(raw)
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

    paragraphs_tts = [apply_tts_phonetic_spellings(p) for _, p, _ in paragraph_specs_for_tts]
    paragraph_specs_align = [
        (pid, apply_tts_phonetic_spellings(p), brk)
        for pid, p, brk in paragraph_specs  # display text → alignment transcript matches DOM
    ]
    paragraphs_text = [p for _, p, _ in paragraph_specs]
    full_plain = "\n\n".join(paragraphs_text)
    th = text_hash(full_plain)

    out_audio = REPO_ROOT / "public" / "audio" / f"{slug}.webm"
    out_manifest = REPO_ROOT / "public" / "audio" / f"{slug}.manifest.json"

    print(f"\nMDX: {mdx_path.relative_to(REPO_ROOT)}")
    print(f"Paragraphs: {len(paragraph_specs)}")
    print(f"Output: {out_audio.relative_to(REPO_ROOT)}")

    paragraph_boundaries: list[tuple[float, float]] | None = None

    if align_only:
        if not out_audio.exists():
            print(f"[skip] {slug}: no existing .webm file for --align-only.", file=sys.stderr)
            return 1
        print(f"  --align-only: skipping TTS, re-aligning existing {out_audio.name}")
        # Try to read TTS boundaries from existing manifest
        if out_manifest.exists():
            try:
                existing = json.loads(out_manifest.read_text(encoding="utf-8"))
                tts_b = existing.get("ttsBoundaries")
                if tts_b and len(tts_b) == len(paragraph_specs):
                    paragraph_boundaries = [
                        (b["start"], b["end"]) for b in tts_b
                    ]
                    print(
                        f"  Using {len(paragraph_boundaries)} TTS paragraph "
                        f"boundaries from existing manifest"
                    )
            except Exception:
                pass
    else:
        # Per-paragraph break duration
        breaks: list[int] = []
        for i, (_, _, is_break) in enumerate(paragraph_specs):
            if i == 0:
                breaks.append(0)
            elif is_break:
                breaks.append(break_ms)
            else:
                breaks.append(consecutive_break_ms)

        n_long = sum(1 for b in breaks if b == break_ms)
        n_short = sum(1 for b in breaks if b == consecutive_break_ms)
        print(f"  Breaks: {n_long} × {break_ms}ms (verse/quote), {n_short} × {consecutive_break_ms}ms (continuing)")

        paragraph_boundaries = synthesize_opus(
            paragraphs_tts, breaks, voice_name, language_code, out_audio
        )

    manifest = align_to_manifest(
        out_audio,
        paragraph_specs_align,
        voice_name,
        th,
        skip_align=skip_align,
        paragraph_boundaries=paragraph_boundaries,
    )
    if not skip_align:
        restore_manifest_display_words(manifest["paragraphs"], paragraph_specs)

    out_manifest.write_text(
        json.dumps(manifest, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
    print(f"Manifest: {out_manifest.relative_to(REPO_ROOT)}")
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
    args = parser.parse_args()

    creds = os.environ.get("GOOGLE_APPLICATION_CREDENTIALS")
    if not creds or not Path(creds).expanduser().is_file():
        print(
            "Set GOOGLE_APPLICATION_CREDENTIALS to your service account JSON path.",
            file=sys.stderr,
        )
        return 1

    voice_name = os.environ.get("TTS_VOICE", "en-US-Chirp3-HD-Charon")
    language_code = os.environ.get("TTS_LANGUAGE_CODE", "en-US")
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
    print(f"Voice: {voice_name} | breaks: {break_ms}ms (verse/quote) / {consecutive_break_ms}ms (continuing)")

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
            )
            failed += rc
        except Exception as e:
            print(f"[error] {slug}: {e}", file=sys.stderr)
            failed += 1

    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
