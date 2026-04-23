#!/usr/bin/env python3
"""
Re-take specific TTS groups in an existing discourse audio.

Usage:
  # Retake TTS group 1 (first group) for iti23:
  python scripts/edit_voice.py iti23 --retake-groups 1
  python scripts/edit_voice.py iti23 -g 1

  # Retake groups 1 and 3:
  python scripts/edit_voice.py iti23 --retake-groups 1,3

  # Retake by paragraph range (1-based): paragraphs 1-3:
  python scripts/edit_voice.py iti23 --retake-paragraphs 1-3
  python scripts/edit_voice.py iti23 -p 1-3

  # Retake paragraphs by expanding to covering TTS groups:
  python scripts/edit_voice.py iti23 -p 1-3 --covering-groups

  # Rollback to previous version:
  python scripts/edit_voice.py iti23 --rollback

  # Preview: show group structure without making changes:
  python scripts/edit_voice.py iti23 --preview

  # Re-run alignment on existing audio/manifest only (no TTS synthesis):
  python scripts/edit_voice.py iti23 --align-only

  # Copy paragraph audio from another discourse without TTS:
  python scripts/edit_voice.py iti23 --copy-from iti10 --copy-paragraphs 2=5,3=6

Saves .bak backup files before editing. Use --rollback to restore.
Keeps lossless WAV intermediates in .cache/voice-edit/ for re-encoding
without quality loss on subsequent retakes.

Environment variables (same as voice:gen):
  TTS_VOICE                         Voice name (default: en-US-Studio-M)
  TTS_SPEAKING_RATE                 Speech rate 0.25–4.0 (default: 0.9)
  TTS_PARAGRAPH_BREAK_MS            Verse/section break in ms (default: 1200)
  TTS_CONSECUTIVE_PARAGRAPH_BREAK_MS  Prose break in ms (default: 800)
  GOOGLE_APPLICATION_CREDENTIALS   Path to GCP service account JSON

Optional SSML prosody (retake only): use --prosody-pitch / --prosody-rate / --prosody-volume
to wrap re-synthesized groups/paragraphs in <prosody> (see Google Cloud TTS SSML). Combining
SSML rate with TTS_SPEAKING_RATE may compound speed—try API rate 1.0 if you set rate in SSML.
"""

from __future__ import annotations

import argparse
import io
import json
import os
import re
import shutil
import sys
import wave
from datetime import datetime, timezone
from pathlib import Path

# ── Import shared utilities from generate_voice.py ────────────────────────

_SCRIPT_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(_SCRIPT_DIR))

from generate_voice import (
    REPO_ROOT,
    SsmlProsodyOptions,
    _synthesize_wav_chunk,
    align_to_manifest,
    apply_tts_long_a_macron_hint,
    apply_tts_phonetic_spellings,
    build_ssml,
    extract_paragraphs_auto,
    file_hash,
    load_dotenv,
    optional_ssml_prosody,
    resolve_mdx_path,
    restore_manifest_display_words,
    strip_frontmatter,
    text_hash,
)


def _preview_max_words_from_terminal() -> int:
    """Use more of the terminal width than a fixed short cap (see voice:gen brief previews)."""
    try:
        cols = shutil.get_terminal_size().columns
    except OSError:
        cols = 100
    # Roughly two lines of prose at typical font width.
    return max(24, min(72, cols // 2))

AUDIO_DIR = REPO_ROOT / "public" / "audio"
CACHE_DIR = REPO_ROOT / ".cache" / "voice-edit"


def _print_voice_tts_settings() -> None:
    """Print resolved TTS configuration (same env defaults as retake synthesis)."""
    voice_name = os.environ.get("TTS_VOICE", "en-US-Studio-M")
    language_code = os.environ.get("TTS_LANGUAGE_CODE", "en-US")
    speaking_rate = float(os.environ.get("TTS_SPEAKING_RATE", "0.9"))
    break_ms = int(os.environ.get("TTS_PARAGRAPH_BREAK_MS", "1200"))
    consecutive_break_ms = int(os.environ.get("TTS_CONSECUTIVE_PARAGRAPH_BREAK_MS", "800"))
    creds = os.environ.get("GOOGLE_APPLICATION_CREDENTIALS")
    cred_display = str(Path(creds).expanduser()) if creds else "(unset)"
    print("  TTS (effective for retake / voice:gen):")
    print(f"    Voice name:        {voice_name}")
    print(f"    Language code:     {language_code}")
    print(f"    API speaking rate: {speaking_rate}")
    print(
        f"    Paragraph pauses:  {break_ms} ms (verse/section) · "
        f"{consecutive_break_ms} ms (prose/consecutive)"
    )
    print(f"    GCP credentials:   {cred_display}")
    print("    Backend:           Google Cloud Text-to-Speech (SSML)")
    print(
        "    SSML prosody:      optional; use --prosody-pitch / --prosody-rate / "
        "--prosody-volume on retake (or voice:gen)"
    )


# ── Helpers ───────────────────────────────────────────────────────────────


def _load_manifest(slug: str) -> dict:
    path = AUDIO_DIR / f"{slug}.manifest.json"
    if not path.exists():
        raise FileNotFoundError(f"No manifest found: {path.relative_to(REPO_ROOT)}")
    return json.loads(path.read_text(encoding="utf-8"))


def _groups_for_paragraphs(
    manifest: dict,
    para_indices: set[int],
) -> list[int]:
    """Return 0-based group indices that cover the given paragraph indices."""
    tts_groups = manifest.get("ttsGroups")
    if not tts_groups:
        raise ValueError("Manifest has no ttsGroups — cannot determine group boundaries.")
    group_indices: list[int] = []
    for gi, g in enumerate(tts_groups):
        if any(pi in para_indices for pi in g["paragraphs"]):
            group_indices.append(gi)
    return sorted(group_indices)


def _parse_retake_groups(spec: str) -> list[int]:
    """Parse comma-separated 1-based group indices: '1,3' -> [0, 2] (0-based internally)."""
    parts = [p.strip() for p in spec.split(",")]
    indices: list[int] = []
    for p in parts:
        if "-" in p:
            lo, hi = p.split("-", 1)
            # Convert 1-based to 0-based: groups 1-3 become indices 0-2
            indices.extend(range(int(lo) - 1, int(hi)))
        else:
            # Convert 1-based to 0-based
            indices.append(int(p) - 1)
    return sorted(set(indices))


def _parse_retake_paragraphs(spec: str, manifest: dict) -> list[int]:
    """Parse 1-based paragraph spec '1-3,5' -> group indices covering those paragraphs."""
    parts = [p.strip() for p in spec.split(",")]
    para_indices: set[int] = set()
    for p in parts:
        if "-" in p:
            lo, hi = p.split("-", 1)
            # Convert 1-based to 0-based
            para_indices.update(range(int(lo) - 1, int(hi)))
        else:
            para_indices.add(int(p) - 1)
    return _groups_for_paragraphs(manifest, para_indices)


def _parse_retake_paragraph_indices(spec: str, manifest: dict) -> list[int]:
    """Parse 1-based paragraph spec '1-3,5' -> 0-based paragraph indices."""
    parts = [p.strip() for p in spec.split(",")]
    para_indices: set[int] = set()
    n_paras = len(manifest.get("paragraphs", []))
    for p in parts:
        if "-" in p:
            lo, hi = p.split("-", 1)
            lo_i = int(lo)
            hi_i = int(hi)
            if lo_i > hi_i:
                lo_i, hi_i = hi_i, lo_i
            for i in range(lo_i - 1, hi_i):
                para_indices.add(i)
        else:
            para_indices.add(int(p) - 1)
    out = sorted(para_indices)
    for pi in out:
        if pi < 0 or pi >= n_paras:
            raise ValueError(f"Paragraph index {pi + 1} out of range 1-{n_paras}.")
    return out


def _backup(slug: str) -> None:
    """Create .bak copies of audio + manifest."""
    for ext in (".webm", ".manifest.json"):
        src = AUDIO_DIR / f"{slug}{ext}"
        dst = AUDIO_DIR / f"{slug}{ext}.bak"
        if src.exists():
            shutil.copy2(src, dst)
            print(f"  Backup: {dst.relative_to(REPO_ROOT)}")


def _rollback(slug: str) -> bool:
    """Restore from .bak files. Returns True on success."""
    restored = False
    for ext in (".webm", ".manifest.json"):
        bak = AUDIO_DIR / f"{slug}{ext}.bak"
        dst = AUDIO_DIR / f"{slug}{ext}"
        if bak.exists():
            shutil.copy2(bak, dst)
            bak.unlink()
            print(f"  Restored: {dst.relative_to(REPO_ROOT)}")
            restored = True
        else:
            print(f"  No backup found: {bak.relative_to(REPO_ROOT)}", file=sys.stderr)
    return restored


def _decode_webm_to_wav(
    webm_path: Path, wav_path: Path,
    sample_rate: int | None = None, channels: int | None = None,
) -> None:
    """Decode webm to PCM WAV using ffmpeg.

    If sample_rate/channels are provided, force output to match (for
    consistent concatenation with freshly synthesized TTS chunks).
    """
    wav_path.parent.mkdir(parents=True, exist_ok=True)
    rate_flag = f"-ar {sample_rate} " if sample_rate else ""
    chan_flag = f"-ac {channels} " if channels else ""
    cmd = (
        f'ffmpeg -y -i "{webm_path}" -acodec pcm_s16le '
        f'{rate_flag}{chan_flag}"{wav_path}" -loglevel error 2>&1'
    )
    ret = os.system(cmd)
    if ret != 0:
        raise RuntimeError(f"ffmpeg decode failed (exit {ret})")


def _encode_wav_to_webm(wav_path: Path, webm_path: Path) -> None:
    """Encode WAV to Opus/WebM."""
    cmd = (
        f'ffmpeg -y -i "{wav_path}" -c:a libopus -b:a 32k '
        f'-vbr on -application voip -f webm "{webm_path}" -loglevel error 2>&1'
    )
    ret = os.system(cmd)
    if ret != 0:
        raise RuntimeError(f"ffmpeg encode failed (exit {ret})")


def _get_wav_params(wav_path: Path):
    """Read WAV params (nchannels, sampwidth, framerate, ...)."""
    with wave.open(str(wav_path), "rb") as w:
        return w.getparams()


def _extract_wav_segment(
    wav_path: Path, start_sec: float, end_sec: float
) -> bytes:
    """Extract a segment from a WAV as raw frames."""
    with wave.open(str(wav_path), "rb") as w:
        rate = w.getframerate()
        sampwidth = w.getsampwidth()
        nchannels = w.getnchannels()
        s_frame = int(start_sec * rate)
        e_frame = int(end_sec * rate)
        w.setpos(s_frame)
        return w.readframes(e_frame - s_frame)


def _silence_frames(duration_sec: float, framerate: int, sampwidth: int, nchannels: int) -> bytes:
    """Generate silent PCM frames."""
    n_frames = int(duration_sec * framerate)
    return b"\x00" * (n_frames * sampwidth * nchannels)


def _cache_wav_path(slug: str) -> Path:
    """Path for cached full-discourse WAV (lossless intermediate)."""
    return CACHE_DIR / f"{slug}.full.wav"


def _ensure_cached_wav(slug: str, sample_rate: int | None = None, channels: int | None = None) -> Path:
    """Ensure a lossless WAV exists for the discourse. Decode from webm if needed.

    If sample_rate/channels are given and a cached WAV already exists but
    doesn't match, re-decode to get consistent parameters.
    """
    cached = _cache_wav_path(slug)
    if cached.exists():
        # Verify params match if specified
        if sample_rate or channels:
            params = _get_wav_params(cached)
            if (sample_rate and params.framerate != sample_rate) or \
               (channels and params.nchannels != channels):
                print(f"  Re-decoding cached WAV (rate/channels mismatch)…")
                cached.unlink()
            else:
                print(f"  Using cached WAV: {cached.relative_to(REPO_ROOT)}")
                return cached
        else:
            print(f"  Using cached WAV: {cached.relative_to(REPO_ROOT)}")
            return cached
    webm = AUDIO_DIR / f"{slug}.webm"
    if not webm.exists():
        raise FileNotFoundError(f"No audio: {webm.relative_to(REPO_ROOT)}")
    print(f"  Decoding {webm.name} → cached WAV…")
    _decode_webm_to_wav(webm, cached, sample_rate=sample_rate, channels=channels)
    return cached


def _parse_index_token(token: str) -> list[int]:
    """Parse one 1-based index token ('3' or '3-5') to a list of 0-based indices."""
    token = token.strip()
    m_range = re.fullmatch(r"(\d+)\s*-\s*(\d+)", token)
    if m_range:
        lo = int(m_range.group(1))
        hi = int(m_range.group(2))
        if lo > hi:
            lo, hi = hi, lo
        return [i - 1 for i in range(lo, hi + 1)]
    m_single = re.fullmatch(r"\d+", token)
    if m_single:
        return [int(token) - 1]
    raise ValueError(f"Invalid index token '{token}'. Use N or N-M.")


def _parse_copy_paragraph_mapping(spec: str) -> dict[int, int]:
    """Parse mapping like '2=7,3-4=9-10' (1-based) to {target0: source0}."""
    mapping: dict[int, int] = {}
    pairs = [p.strip() for p in spec.split(",") if p.strip()]
    if not pairs:
        raise ValueError("Empty --copy-paragraphs mapping.")
    for pair in pairs:
        if "=" not in pair:
            raise ValueError(f"Invalid mapping '{pair}'. Expected TARGET=SOURCE.")
        left, right = pair.split("=", 1)
        left_indices = _parse_index_token(left)
        right_indices = _parse_index_token(right)
        if len(left_indices) != len(right_indices):
            raise ValueError(
                f"Mapping '{pair}' has different sizes ({len(left_indices)} vs {len(right_indices)})."
            )
        for tgt, src in zip(left_indices, right_indices):
            if tgt in mapping:
                raise ValueError(f"Target paragraph {tgt + 1} mapped more than once.")
            mapping[tgt] = src
    return mapping


def _retime_words(words: list[dict], src_start: float, dst_start: float) -> list[dict]:
    """Shift paragraph word timestamps by constant offset."""
    delta = dst_start - src_start
    out: list[dict] = []
    for w in words or []:
        if "s" not in w or "e" not in w:
            continue
        out.append(
            {
                "w": w.get("w", ""),
                "s": round(float(w["s"]) + delta, 4),
                "e": round(float(w["e"]) + delta, 4),
            }
        )
    return out


# ── Core edit flow ────────────────────────────────────────────────────────


def preview_groups(slug: str) -> None:
    """Print the TTS group structure for a discourse."""
    manifest = _load_manifest(slug)
    tts_groups = manifest.get("ttsGroups", [])
    paragraphs = manifest.get("paragraphs", [])

    print(f"\n{slug}: {len(paragraphs)} paragraphs, {len(tts_groups)} TTS groups")
    _print_voice_tts_settings()
    mv = manifest.get("voice")
    if mv:
        print(f"  Manifest (this audio): voice={mv}")
    print(f"  Total duration: {manifest.get('duration', '?')}s\n")

    max_w = _preview_max_words_from_terminal()
    for gi, g in enumerate(tts_groups):
        pids = g["paragraphs"]
        dur = g["end"] - g["start"]
        para_ids_display = [paragraphs[pi]["id"] for pi in pids if pi < len(paragraphs)]
        first_words = []
        for pi in pids:
            if pi < len(paragraphs):
                words = paragraphs[pi].get("words", [])
                preview = " ".join(w["w"] for w in words[:max_w])
                if len(words) > max_w:
                    preview += "…"
                first_words.append(f"    ¶{paragraphs[pi]['id']}: {preview}")

        print(f"  Group {gi + 1}: ¶{para_ids_display} [{g['start']:.2f}s – {g['end']:.2f}s] ({dur:.1f}s)")
        for line in first_words:
            print(line)
        print()


def align_only(slug: str, voice_name: str) -> int:
    """Re-run alignment on existing discourse audio without any TTS retake."""
    manifest = _load_manifest(slug)
    out_audio = AUDIO_DIR / f"{slug}.webm"
    if not out_audio.exists():
        print(f"[error] {slug}: no existing audio file {out_audio.name}", file=sys.stderr)
        return 1

    mdx_path = resolve_mdx_path(slug)
    raw = mdx_path.read_text(encoding="utf-8")
    body = strip_frontmatter(raw)
    paragraph_specs = extract_paragraphs_auto(body)
    if not paragraph_specs:
        print(f"[error] {slug}: no paragraphs extracted from MDX.", file=sys.stderr)
        return 1
    paragraph_specs_align = [
        (pid, apply_tts_phonetic_spellings(p), brk)
        for pid, p, brk in paragraph_specs
    ]
    paragraphs_text = [p for _, p, _ in paragraph_specs]
    th = text_hash("\n\n".join(paragraphs_text))

    paragraph_boundaries: list[tuple[float, float]] | None = None
    tts_groups: list[tuple[float, float, list[int]]] | None = None

    try:
        tts_b = manifest.get("ttsBoundaries")
        if (
            tts_b
            and len(tts_b) == len(paragraph_specs)
            and tts_b[0].get("start", 1) == 0
        ):
            paragraph_boundaries = [(b["start"], b["end"]) for b in tts_b]
            print(
                f"  Using {len(paragraph_boundaries)} TTS paragraph boundaries "
                "from existing manifest"
            )
        elif not tts_b or (tts_b and tts_b[0].get("start", 1) > 0):
            existing_paras = manifest.get("paragraphs", [])
            ex_dur = manifest.get("duration")
            if len(existing_paras) == len(paragraph_specs):
                tight: list[tuple[float, float]] = []
                for ep in existing_paras:
                    s = ep.get("start")
                    e = ep.get("end")
                    if s is not None and e is not None:
                        tight.append((float(s), float(e)))
                if len(tight) == len(paragraph_specs):
                    recovered: list[tuple[float, float]] = []
                    for i, (s, e) in enumerate(tight):
                        if i == 0:
                            new_s = 0.0
                        else:
                            prev_end = tight[i - 1][1]
                            new_s = round((prev_end + s) / 2, 4)
                        if i == len(tight) - 1:
                            new_e = round(float(ex_dur), 4) if ex_dur else e
                        else:
                            next_start = tight[i + 1][0]
                            new_e = round((e + next_start) / 2, 4)
                        recovered.append((new_s, new_e))
                    paragraph_boundaries = recovered
                    print(
                        f"  Recovered {len(paragraph_boundaries)} paragraph boundaries "
                        "from v1 manifest (gap-split)"
                    )

        tts_g = manifest.get("ttsGroups")
        if tts_g:
            tts_groups = [(g["start"], g["end"], g["paragraphs"]) for g in tts_g]
            print(f"  Using {len(tts_groups)} TTS groups from existing manifest")
    except Exception:
        # Keep align-only robust; fallback alignment path will still run.
        pass

    print(f"\n{slug}: --align-only (no TTS synthesis)")
    manifest_out = align_to_manifest(
        out_audio,
        paragraph_specs_align,
        voice_name,
        th,
        skip_align=False,
        paragraph_boundaries=paragraph_boundaries,
        tts_groups=tts_groups,
        paragraph_specs_display=paragraph_specs,
    )
    restore_manifest_display_words(manifest_out["paragraphs"], paragraph_specs)

    out_manifest = AUDIO_DIR / f"{slug}.manifest.json"
    out_manifest.write_text(
        json.dumps(manifest_out, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
    print(f"  Manifest: {out_manifest.relative_to(REPO_ROOT)}")
    return 0


def retake_groups(
    slug: str,
    retake_group_indices: list[int],
    voice_name: str,
    language_code: str,
    break_ms: int,
    consecutive_break_ms: int,
    *,
    prosody: SsmlProsodyOptions | None = None,
) -> int:
    """Re-synthesize specific TTS groups and splice into existing audio.

    Returns 0 on success, 1 on error.
    """
    manifest = _load_manifest(slug)
    tts_groups = manifest.get("ttsGroups")
    if not tts_groups:
        print(f"[error] {slug}: manifest has no ttsGroups", file=sys.stderr)
        return 1

    n_groups = len(tts_groups)
    for gi in retake_group_indices:
        if gi < 0 or gi >= n_groups:
            print(f"[error] Group index {gi} out of range (0–{n_groups - 1})", file=sys.stderr)
            return 1

    kept_indices = [i for i in range(n_groups) if i not in retake_group_indices]
    retake_set = set(retake_group_indices)
    retake_1based = [gi + 1 for gi in retake_group_indices]
    kept_1based = [gi + 1 for gi in kept_indices]
    print(f"\n{slug}: retaking groups {retake_1based}, keeping {kept_1based}")

    # ── 1. Load MDX and extract paragraph data ───────────────────────────

    mdx_path = resolve_mdx_path(slug)
    raw = mdx_path.read_text(encoding="utf-8")
    body = strip_frontmatter(raw)

    paragraph_specs = extract_paragraphs_auto(body)
    paragraph_specs_for_tts = extract_paragraphs_auto(body, for_tts=True)

    paragraphs_tts = [
        apply_tts_long_a_macron_hint(apply_tts_phonetic_spellings(p))
        for _, p, _ in paragraph_specs_for_tts
    ]
    paragraph_specs_align = [
        (pid, apply_tts_phonetic_spellings(p), brk)
        for pid, p, brk in paragraph_specs
    ]

    n_paras = len(paragraph_specs)

    # Compute breaks
    breaks: list[int] = []
    for i, (_, _, is_break) in enumerate(paragraph_specs):
        if i == 0:
            breaks.append(0)
        elif is_break:
            breaks.append(break_ms)
        else:
            breaks.append(consecutive_break_ms)

    # ── 2. Backup existing files ─────────────────────────────────────────

    _backup(slug)

    # ── 3. Re-synthesize retake groups (do this first to learn WAV params) ─

    from google.cloud import texttospeech

    client = texttospeech.TextToSpeechClient()
    retake_wavs: dict[int, bytes] = {}  # gi -> raw WAV bytes

    for gi in retake_group_indices:
        g = tts_groups[gi]
        pids = g["paragraphs"]
        texts = [paragraphs_tts[pi] for pi in pids]
        brks = [breaks[pi] for pi in pids]

        ssml = build_ssml(texts, brks, prosody=prosody)
        print(f"  Re-synthesizing group {gi + 1} (¶{[pi+1 for pi in pids]})…")
        wav_bytes = _synthesize_wav_chunk(ssml, voice_name, language_code, client)
        retake_wavs[gi] = wav_bytes

    # Peek at the TTS WAV params so we can decode existing audio to match
    first_retake_wav = retake_wavs[retake_group_indices[0]]
    buf = io.BytesIO(first_retake_wav)
    with wave.open(buf, "rb") as tmp:
        tts_rate = tmp.getframerate()
        tts_channels = tmp.getnchannels()
    print(f"  TTS WAV: {tts_rate}Hz, {tts_channels}ch")

    # ── 4. Get/create lossless WAV of current audio (matching TTS params) ─

    current_wav = _ensure_cached_wav(slug, sample_rate=tts_rate, channels=tts_channels)
    wav_params = _get_wav_params(current_wav)

    # ── 5. Splice: concatenate all groups in order ───────────────────────

    combined_wav_path = AUDIO_DIR / f"{slug}.edit.tmp.wav"
    new_boundaries: list[tuple[float, float]] = [None] * n_paras  # type: ignore[list-item]

    try:
        cursor = 0.0

        with wave.open(str(combined_wav_path), "wb") as wout:
            wout.setparams(wav_params)

            for gi in range(n_groups):
                g = tts_groups[gi]
                pids = g["paragraphs"]
                first_pi = pids[0]

                # Insert silence gap before non-first groups
                if first_pi > 0 and breaks[first_pi] > 0:
                    silence_sec = breaks[first_pi] / 1000.0
                    wout.writeframes(
                        _silence_frames(silence_sec, wav_params.framerate,
                                        wav_params.sampwidth, wav_params.nchannels)
                    )
                    cursor += silence_sec

                group_start = cursor

                if gi in retake_set:
                    # Write re-synthesized audio
                    buf = io.BytesIO(retake_wavs[gi])
                    with wave.open(buf, "rb") as win:
                        n_frames = win.getnframes()
                        group_dur = n_frames / win.getframerate()
                        wout.writeframes(win.readframes(n_frames))
                else:
                    # Extract kept segment from cached WAV (lossless)
                    old_start = g["start"]
                    old_end = g["end"]
                    frames = _extract_wav_segment(current_wav, old_start, old_end)
                    n_frames = len(frames) // (wav_params.sampwidth * wav_params.nchannels)
                    group_dur = n_frames / wav_params.framerate
                    wout.writeframes(frames)

                # Compute paragraph boundaries within this group
                texts = [paragraphs_tts[pi] for pi in pids]
                if len(pids) == 1:
                    new_boundaries[pids[0]] = (round(group_start, 4),
                                                round(group_start + group_dur, 4))
                else:
                    char_counts = [max(len(t), 1) for t in texts]
                    total_chars = sum(char_counts)
                    inner_cursor = group_start
                    for j, pi in enumerate(pids):
                        frac = char_counts[j] / total_chars
                        para_dur = group_dur * frac
                        new_boundaries[pi] = (round(inner_cursor, 4),
                                               round(inner_cursor + para_dur, 4))
                        inner_cursor += para_dur

                cursor = group_start + group_dur

        # ── 6. Encode to WebM ────────────────────────────────────────────

        out_webm = AUDIO_DIR / f"{slug}.webm"
        print(f"  Encoding spliced audio → {out_webm.name}…")
        _encode_wav_to_webm(combined_wav_path, out_webm)

        # ── 7. Update cached WAV (for future lossless retakes) ───────────

        cached_wav = _cache_wav_path(slug)
        cached_wav.parent.mkdir(parents=True, exist_ok=True)
        shutil.move(str(combined_wav_path), str(cached_wav))
        print(f"  Updated cached WAV: {cached_wav.relative_to(REPO_ROOT)}")

    finally:
        if combined_wav_path.exists():
            combined_wav_path.unlink(missing_ok=True)

    # ── 8. Build new tts_groups with updated timings ─────────────────────

    new_tts_groups: list[tuple[float, float, list[int]]] = []
    for gi in range(n_groups):
        g = tts_groups[gi]
        pids = g["paragraphs"]
        g_start = new_boundaries[pids[0]][0]
        g_end = new_boundaries[pids[-1]][1]
        new_tts_groups.append((g_start, g_end, list(pids)))

    # ── 9. Align + build manifest ────────────────────────────────────────

    paragraphs_text = [p for _, p, _ in paragraph_specs]
    full_plain = "\n\n".join(paragraphs_text)
    th = text_hash(full_plain)

    out_audio = AUDIO_DIR / f"{slug}.webm"
    manifest_out = align_to_manifest(
        out_audio,
        paragraph_specs_align,
        voice_name,
        th,
        skip_align=False,
        paragraph_boundaries=list(new_boundaries),
        tts_groups=new_tts_groups,
        paragraph_specs_display=paragraph_specs,
    )
    restore_manifest_display_words(manifest_out["paragraphs"], paragraph_specs)

    # ── 10. Write manifest ───────────────────────────────────────────────

    out_manifest = AUDIO_DIR / f"{slug}.manifest.json"
    out_manifest.write_text(
        json.dumps(manifest_out, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
    print(f"  Manifest: {out_manifest.relative_to(REPO_ROOT)}")

    # ── Summary ──────────────────────────────────────────────────────────

    old_dur = manifest.get("duration", 0)
    new_dur = manifest_out.get("duration", 0)
    delta = (new_dur or 0) - (old_dur or 0)
    sign = "+" if delta >= 0 else ""
    print(f"\n  Done. Duration: {old_dur:.1f}s → {new_dur:.1f}s ({sign}{delta:.1f}s)")
    print(f"  Rollback: npm run voice:edit -- {slug} --rollback")

    return 0


def retake_paragraphs_exact(
    slug: str,
    retake_paragraph_indices: list[int],
    voice_name: str,
    language_code: str,
    break_ms: int,
    consecutive_break_ms: int,
    *,
    prosody: SsmlProsodyOptions | None = None,
) -> int:
    """Re-synthesize specific paragraphs only (even inside larger TTS groups)."""
    manifest = _load_manifest(slug)
    paragraphs_in_manifest = manifest.get("paragraphs")
    if not paragraphs_in_manifest:
        print(f"[error] {slug}: manifest has no paragraphs", file=sys.stderr)
        return 1

    n_paras_manifest = len(paragraphs_in_manifest)
    for pi in retake_paragraph_indices:
        if pi < 0 or pi >= n_paras_manifest:
            print(
                f"[error] Paragraph index {pi + 1} out of range (1–{n_paras_manifest})",
                file=sys.stderr,
            )
            return 1

    retake_set = set(retake_paragraph_indices)
    retake_1based = [i + 1 for i in retake_paragraph_indices]
    print(f"\n{slug}: exact paragraph retake {retake_1based}")

    mdx_path = resolve_mdx_path(slug)
    raw = mdx_path.read_text(encoding="utf-8")
    body = strip_frontmatter(raw)

    paragraph_specs = extract_paragraphs_auto(body)
    paragraph_specs_for_tts = extract_paragraphs_auto(body, for_tts=True)
    if len(paragraph_specs) != n_paras_manifest:
        print(
            f"[error] {slug}: manifest/MDX paragraph mismatch "
            f"({n_paras_manifest} vs {len(paragraph_specs)}).",
            file=sys.stderr,
        )
        return 1

    paragraphs_tts = [
        apply_tts_long_a_macron_hint(apply_tts_phonetic_spellings(p))
        for _, p, _ in paragraph_specs_for_tts
    ]
    paragraph_specs_align = [
        (pid, apply_tts_phonetic_spellings(p), brk)
        for pid, p, brk in paragraph_specs
    ]

    breaks: list[int] = []
    for i, (_, _, is_break) in enumerate(paragraph_specs):
        if i == 0:
            breaks.append(0)
        elif is_break:
            breaks.append(break_ms)
        else:
            breaks.append(consecutive_break_ms)

    _backup(slug)

    from google.cloud import texttospeech

    client = texttospeech.TextToSpeechClient()
    retake_wavs: dict[int, bytes] = {}
    for pi in retake_paragraph_indices:
        ssml = build_ssml([paragraphs_tts[pi]], [0], prosody=prosody)
        print(f"  Re-synthesizing paragraph {pi + 1}…")
        retake_wavs[pi] = _synthesize_wav_chunk(ssml, voice_name, language_code, client)

    first_retake_wav = retake_wavs[retake_paragraph_indices[0]]
    buf = io.BytesIO(first_retake_wav)
    with wave.open(buf, "rb") as tmp:
        tts_rate = tmp.getframerate()
        tts_channels = tmp.getnchannels()
    print(f"  TTS WAV: {tts_rate}Hz, {tts_channels}ch")

    current_wav = _ensure_cached_wav(slug, sample_rate=tts_rate, channels=tts_channels)
    wav_params = _get_wav_params(current_wav)

    combined_wav_path = AUDIO_DIR / f"{slug}.retake-para.tmp.wav"
    new_boundaries: list[tuple[float, float]] = [None] * len(paragraph_specs)  # type: ignore[list-item]

    try:
        cursor = 0.0
        with wave.open(str(combined_wav_path), "wb") as wout:
            wout.setparams(wav_params)

            for pi in range(len(paragraph_specs)):
                if pi > 0 and breaks[pi] > 0:
                    silence_sec = breaks[pi] / 1000.0
                    wout.writeframes(
                        _silence_frames(
                            silence_sec,
                            wav_params.framerate,
                            wav_params.sampwidth,
                            wav_params.nchannels,
                        )
                    )
                    cursor += silence_sec

                para_start = cursor
                if pi in retake_set:
                    in_buf = io.BytesIO(retake_wavs[pi])
                    with wave.open(in_buf, "rb") as win:
                        n_frames = win.getnframes()
                        para_dur = n_frames / win.getframerate()
                        wout.writeframes(win.readframes(n_frames))
                else:
                    old_para = paragraphs_in_manifest[pi]
                    old_start = float(old_para["start"])
                    old_end = float(old_para["end"])
                    frames = _extract_wav_segment(current_wav, old_start, old_end)
                    n_frames = len(frames) // (wav_params.sampwidth * wav_params.nchannels)
                    para_dur = n_frames / wav_params.framerate
                    wout.writeframes(frames)
                para_end = para_start + para_dur
                new_boundaries[pi] = (round(para_start, 4), round(para_end, 4))
                cursor = para_end

        out_webm = AUDIO_DIR / f"{slug}.webm"
        print(f"  Encoding spliced audio → {out_webm.name}…")
        _encode_wav_to_webm(combined_wav_path, out_webm)

        cached_wav = _cache_wav_path(slug)
        cached_wav.parent.mkdir(parents=True, exist_ok=True)
        shutil.move(str(combined_wav_path), str(cached_wav))
        print(f"  Updated cached WAV: {cached_wav.relative_to(REPO_ROOT)}")
    finally:
        if combined_wav_path.exists():
            combined_wav_path.unlink(missing_ok=True)

    new_tts_groups: list[tuple[float, float, list[int]]] | None = None
    if manifest.get("ttsGroups"):
        new_tts_groups = []
        for g in manifest["ttsGroups"]:
            pids = list(g["paragraphs"])
            g_start = new_boundaries[pids[0]][0]
            g_end = new_boundaries[pids[-1]][1]
            new_tts_groups.append((g_start, g_end, pids))

    paragraphs_text = [p for _, p, _ in paragraph_specs]
    full_plain = "\n\n".join(paragraphs_text)
    th = text_hash(full_plain)

    out_audio = AUDIO_DIR / f"{slug}.webm"
    manifest_out = align_to_manifest(
        out_audio,
        paragraph_specs_align,
        voice_name,
        th,
        skip_align=False,
        paragraph_boundaries=list(new_boundaries),
        tts_groups=None,
        paragraph_specs_display=paragraph_specs,
    )
    restore_manifest_display_words(manifest_out["paragraphs"], paragraph_specs)
    if new_tts_groups:
        manifest_out["ttsGroups"] = [
            {"start": s, "end": e, "paragraphs": pids}
            for s, e, pids in new_tts_groups
        ]

    out_manifest = AUDIO_DIR / f"{slug}.manifest.json"
    out_manifest.write_text(
        json.dumps(manifest_out, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
    print(f"  Manifest: {out_manifest.relative_to(REPO_ROOT)}")
    print("  Done. (exact paragraph retake mode)")
    print(f"  Rollback: npm run voice:edit -- {slug} --rollback")
    return 0


def copy_paragraphs(
    slug: str,
    source_slug: str,
    copy_mapping: dict[int, int],
    break_ms: int,
    consecutive_break_ms: int,
) -> int:
    """Copy paragraph audio from source discourse into target without TTS."""
    target_manifest = _load_manifest(slug)
    source_manifest = _load_manifest(source_slug)
    target_paras = target_manifest.get("paragraphs", [])
    source_paras = source_manifest.get("paragraphs", [])

    if not target_paras or not source_paras:
        print("[error] Missing paragraph data in manifest(s).", file=sys.stderr)
        return 1

    mdx_path = resolve_mdx_path(slug)
    raw = mdx_path.read_text(encoding="utf-8")
    body = strip_frontmatter(raw)
    paragraph_specs = extract_paragraphs_auto(body)
    if len(paragraph_specs) != len(target_paras):
        print(
            f"[error] {slug}: target manifest paragraph count ({len(target_paras)}) "
            f"does not match MDX ({len(paragraph_specs)}).",
            file=sys.stderr,
        )
        return 1

    n_target = len(target_paras)
    for tgt, src in copy_mapping.items():
        if tgt < 0 or tgt >= n_target:
            print(f"[error] Target paragraph {tgt + 1} is out of range 1-{n_target}.", file=sys.stderr)
            return 1
        if src < 0 or src >= len(source_paras):
            print(
                f"[error] Source paragraph {src + 1} is out of range 1-{len(source_paras)}.",
                file=sys.stderr,
            )
            return 1
        sp = source_paras[src]
        if sp.get("start") is None or sp.get("end") is None:
            print(
                f"[error] Source paragraph {src + 1} has no timing in {source_slug}.manifest.json.",
                file=sys.stderr,
            )
            return 1

    for i, tp in enumerate(target_paras):
        if tp.get("start") is None or tp.get("end") is None:
            print(
                f"[error] Target paragraph {i + 1} has no timing in {slug}.manifest.json.",
                file=sys.stderr,
            )
            return 1

    display_map = ", ".join(f"{t + 1}={s + 1}" for t, s in sorted(copy_mapping.items()))
    print(f"\n{slug}: copy paragraphs from {source_slug} ({display_map})")

    breaks: list[int] = []
    for i, (_, _, is_break) in enumerate(paragraph_specs):
        if i == 0:
            breaks.append(0)
        elif is_break:
            breaks.append(break_ms)
        else:
            breaks.append(consecutive_break_ms)

    _backup(slug)

    target_wav = _ensure_cached_wav(slug)
    wav_params = _get_wav_params(target_wav)
    source_wav = _ensure_cached_wav(
        source_slug, sample_rate=wav_params.framerate, channels=wav_params.nchannels
    )
    wav_params = _get_wav_params(source_wav)

    combined_wav_path = AUDIO_DIR / f"{slug}.copy.tmp.wav"
    new_boundaries: list[tuple[float, float]] = [None] * n_target  # type: ignore[list-item]
    paragraph_templates: list[dict] = [None] * n_target  # type: ignore[list-item]

    try:
        cursor = 0.0
        with wave.open(str(combined_wav_path), "wb") as wout:
            wout.setparams(wav_params)

            for i in range(n_target):
                if i > 0 and breaks[i] > 0:
                    silence_sec = breaks[i] / 1000.0
                    wout.writeframes(
                        _silence_frames(
                            silence_sec,
                            wav_params.framerate,
                            wav_params.sampwidth,
                            wav_params.nchannels,
                        )
                    )
                    cursor += silence_sec

                if i in copy_mapping:
                    src_i = copy_mapping[i]
                    source_para = source_paras[src_i]
                    seg_start = float(source_para["start"])
                    seg_end = float(source_para["end"])
                    frames = _extract_wav_segment(source_wav, seg_start, seg_end)
                    paragraph_templates[i] = source_para
                else:
                    target_para = target_paras[i]
                    seg_start = float(target_para["start"])
                    seg_end = float(target_para["end"])
                    frames = _extract_wav_segment(target_wav, seg_start, seg_end)
                    paragraph_templates[i] = target_para

                n_frames = len(frames) // (wav_params.sampwidth * wav_params.nchannels)
                para_dur = n_frames / wav_params.framerate
                para_start = cursor
                para_end = cursor + para_dur
                wout.writeframes(frames)
                new_boundaries[i] = (round(para_start, 4), round(para_end, 4))
                cursor = para_end

        out_webm = AUDIO_DIR / f"{slug}.webm"
        print(f"  Encoding spliced audio → {out_webm.name}…")
        _encode_wav_to_webm(combined_wav_path, out_webm)

        cached_wav = _cache_wav_path(slug)
        cached_wav.parent.mkdir(parents=True, exist_ok=True)
        shutil.move(str(combined_wav_path), str(cached_wav))
        print(f"  Updated cached WAV: {cached_wav.relative_to(REPO_ROOT)}")
    finally:
        if combined_wav_path.exists():
            combined_wav_path.unlink(missing_ok=True)

    new_tts_groups: list[tuple[float, float, list[int]]] | None = None
    if target_manifest.get("ttsGroups"):
        new_tts_groups = []
        for g in target_manifest["ttsGroups"]:
            pids = list(g["paragraphs"])
            g_start = new_boundaries[pids[0]][0]
            g_end = new_boundaries[pids[-1]][1]
            new_tts_groups.append((g_start, g_end, pids))

    paragraphs_out: list[dict] = []
    for i, (pid, _text, _brk) in enumerate(paragraph_specs):
        tpl = paragraph_templates[i]
        old_start = float(tpl.get("start", 0.0))
        words = _retime_words(tpl.get("words", []), old_start, new_boundaries[i][0])
        paragraphs_out.append(
            {
                "id": pid,
                "start": new_boundaries[i][0],
                "end": new_boundaries[i][1],
                "words": words,
            }
        )

    text_hash_hex = text_hash("\n\n".join(p for _, p, _ in paragraph_specs))
    out_audio = AUDIO_DIR / f"{slug}.webm"
    manifest_out = {
        "version": 2,
        "textHash": text_hash_hex,
        "audioHash": file_hash(out_audio),
        "voice": target_manifest.get("voice"),
        "generatedAt": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "duration": new_boundaries[-1][1] if new_boundaries else 0,
        "paragraphs": paragraphs_out,
        "ttsBoundaries": [{"start": s, "end": e} for s, e in new_boundaries],
    }
    if new_tts_groups:
        manifest_out["ttsGroups"] = [
            {"start": s, "end": e, "paragraphs": pids}
            for s, e, pids in new_tts_groups
        ]

    out_manifest = AUDIO_DIR / f"{slug}.manifest.json"
    out_manifest.write_text(
        json.dumps(manifest_out, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
    print(f"  Manifest: {out_manifest.relative_to(REPO_ROOT)}")
    print("  Done (copy mode, no TTS synthesis).")
    print(f"  Rollback: npm run voice:edit -- {slug} --rollback")
    return 0


# ── CLI ───────────────────────────────────────────────────────────────────


def main() -> int:
    load_dotenv()

    parser = argparse.ArgumentParser(
        description="Re-take specific TTS groups in an existing discourse audio.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    parser.add_argument(
        "slug",
        help="Discourse slug (e.g. iti23, mn10).",
    )

    action = parser.add_mutually_exclusive_group(required=True)
    action.add_argument(
        "-g",
        "--retake-groups",
        metavar="INDICES",
        help="Comma-separated 1-based group indices to re-synthesize (e.g. 1,3). See --preview for group numbering.",
    )
    action.add_argument(
        "-p",
        "--retake-paragraphs",
        metavar="RANGE",
        help="1-based paragraph range to re-synthesize (e.g. 1-3,5). "
             "Defaults to exact paragraph-only retake. "
             "Add --covering-groups to expand selected paragraphs to full covering TTS groups.",
    )
    parser.add_argument(
        "--covering-groups",
        action="store_true",
        help=(
            "With --retake-paragraphs, retake full covering TTS groups instead of exact paragraphs."
        ),
    )
    action.add_argument(
        "--rollback",
        action="store_true",
        help="Restore audio + manifest from .bak files.",
    )
    action.add_argument(
        "--preview",
        action="store_true",
        help="Show TTS group structure without making changes.",
    )
    action.add_argument(
        "--align-only",
        action="store_true",
        help="Re-run alignment on existing .webm/.manifest without TTS synthesis.",
    )
    action.add_argument(
        "--copy-paragraphs",
        metavar="MAP",
        help=(
            "Copy paragraph audio without TTS. Mapping format TARGET=SOURCE (1-based), "
            "comma-separated; ranges supported (e.g. 2=7,5-6=9-10)."
        ),
    )
    parser.add_argument(
        "--copy-from",
        metavar="SOURCE_SLUG",
        help="Source discourse slug for --copy-paragraphs (must have timed manifest/audio).",
    )

    parser.add_argument(
        "--prosody-pitch",
        metavar="VALUE",
        default=None,
        help="SSML prosody pitch for re-synthesized retakes (groups or exact paragraphs).",
    )
    parser.add_argument(
        "--prosody-rate",
        metavar="VALUE",
        default=None,
        help="SSML prosody rate for re-synthesized retakes (e.g. 90%%, slow). See note on TTS_SPEAKING_RATE in --help.",
    )
    parser.add_argument(
        "--prosody-volume",
        metavar="VALUE",
        default=None,
        help="SSML prosody volume for re-synthesized retakes (e.g. silent, soft, medium).",
    )
    parser.add_argument(
        "--exact",
        action="store_true",
        help=(
            "Backward-compatible no-op: exact paragraph retake is now the default "
            "for --retake-paragraphs."
        ),
    )

    args = parser.parse_args()
    slug = args.slug

    # ── Rollback ──────────────────────────────────────────────────────────

    if args.rollback:
        print(f"\nRolling back {slug}…")
        ok = _rollback(slug)
        # Also invalidate cached WAV so next retake decodes fresh
        cached = _cache_wav_path(slug)
        if cached.exists():
            cached.unlink()
            print(f"  Removed cached WAV: {cached.relative_to(REPO_ROOT)}")
        return 0 if ok else 1

    # ── Preview ───────────────────────────────────────────────────────────

    if args.preview:
        preview_groups(slug)
        return 0

    if args.align_only:
        # Preserve existing manifest voice by default for metadata consistency.
        manifest = _load_manifest(slug)
        manifest_voice = manifest.get("voice")
        voice_name_for_align = manifest_voice or os.environ.get("TTS_VOICE", "en-US-Studio-M")
        if manifest_voice:
            print(f"  Align-only voice metadata: {manifest_voice}")
        return align_only(slug, voice_name_for_align)

    if args.copy_paragraphs:
        if not args.copy_from:
            print("[error] --copy-from is required with --copy-paragraphs.", file=sys.stderr)
            return 1
        try:
            copy_mapping = _parse_copy_paragraph_mapping(args.copy_paragraphs)
        except ValueError as e:
            print(f"[error] {e}", file=sys.stderr)
            return 1
        break_ms = int(os.environ.get("TTS_PARAGRAPH_BREAK_MS", "1200"))
        consecutive_break_ms = int(os.environ.get("TTS_CONSECUTIVE_PARAGRAPH_BREAK_MS", "800"))
        return copy_paragraphs(
            slug,
            args.copy_from,
            copy_mapping,
            break_ms,
            consecutive_break_ms,
        )

    # ── Retake ────────────────────────────────────────────────────────────

    manifest = _load_manifest(slug)

    if args.exact and args.covering_groups:
        print(
            "[error] --exact and --covering-groups cannot be used together.",
            file=sys.stderr,
        )
        return 1

    if args.retake_paragraphs:
        if args.covering_groups:
            retake_gis = _parse_retake_paragraphs(args.retake_paragraphs, manifest)
            retake_gis_display = [i + 1 for i in retake_gis]
            print(f"  Paragraphs {args.retake_paragraphs} → groups {retake_gis_display}")
        else:
            try:
                retake_pis = _parse_retake_paragraph_indices(args.retake_paragraphs, manifest)
            except ValueError as e:
                print(f"[error] {e}", file=sys.stderr)
                return 1
            retake_pis_display = [i + 1 for i in retake_pis]
            print(f"  Exact paragraphs to retake: {retake_pis_display}")
            retake_gis = None
    else:
        retake_gis = _parse_retake_groups(args.retake_groups)

    # Validate GCP credentials
    creds = os.environ.get("GOOGLE_APPLICATION_CREDENTIALS")
    if not creds or not Path(creds).expanduser().is_file():
        print(
            "[error] GOOGLE_APPLICATION_CREDENTIALS not set or file not found.",
            file=sys.stderr,
        )
        return 1

    voice_name = os.environ.get("TTS_VOICE", "en-US-Studio-M")
    language_code = os.environ.get("TTS_LANGUAGE_CODE", "en-US")
    speaking_rate = float(os.environ.get("TTS_SPEAKING_RATE", "0.9"))
    break_ms = int(os.environ.get("TTS_PARAGRAPH_BREAK_MS", "1200"))
    consecutive_break_ms = int(os.environ.get("TTS_CONSECUTIVE_PARAGRAPH_BREAK_MS", "800"))
    print(f"Voice: {voice_name} | rate: {speaking_rate} | breaks: {break_ms}ms (verse) / {consecutive_break_ms}ms (prose)")

    prosody = optional_ssml_prosody(
        args.prosody_pitch, args.prosody_rate, args.prosody_volume
    )
    if prosody:
        bits = []
        if prosody.pitch:
            bits.append(f"pitch={prosody.pitch}")
        if prosody.rate:
            bits.append(f"rate={prosody.rate}")
        if prosody.volume:
            bits.append(f"volume={prosody.volume}")
        print(f"SSML prosody (retake only): {' '.join(bits)}")

    if args.retake_paragraphs and not args.covering_groups:
        return retake_paragraphs_exact(
            slug,
            retake_pis,
            voice_name,
            language_code,
            break_ms,
            consecutive_break_ms,
            prosody=prosody,
        )

    return retake_groups(
        slug,
        retake_gis,
        voice_name,
        language_code,
        break_ms,
        consecutive_break_ms,
        prosody=prosody,
    )


if __name__ == "__main__":
    sys.exit(main())
