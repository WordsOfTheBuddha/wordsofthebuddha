#!/usr/bin/env python3
"""
Re-take specific TTS groups in an existing discourse audio.

Usage:
  # Retake TTS group 0 (first group) for iti23:
  python scripts/edit_voice.py iti23 --retake-groups 0

  # Retake groups 0 and 2:
  python scripts/edit_voice.py iti23 --retake-groups 0,2

  # Retake by paragraph range (1-based): paragraphs 1-3:
  python scripts/edit_voice.py iti23 --retake-paragraphs 1-3

  # Rollback to previous version:
  python scripts/edit_voice.py iti23 --rollback

  # Preview: show group structure without making changes:
  python scripts/edit_voice.py iti23 --preview

Saves .bak backup files before editing. Use --rollback to restore.
Keeps lossless WAV intermediates in .cache/voice-edit/ for re-encoding
without quality loss on subsequent retakes.
"""

from __future__ import annotations

import argparse
import io
import json
import os
import shutil
import sys
import wave
from pathlib import Path

# ── Import shared utilities from generate_voice.py ────────────────────────

_SCRIPT_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(_SCRIPT_DIR))

from generate_voice import (
    REPO_ROOT,
    _synthesize_wav_chunk,
    align_to_manifest,
    apply_tts_long_a_macron_hint,
    apply_tts_phonetic_spellings,
    build_ssml,
    extract_paragraphs_auto,
    load_dotenv,
    resolve_mdx_path,
    restore_manifest_display_words,
    strip_frontmatter,
    text_hash,
)

AUDIO_DIR = REPO_ROOT / "public" / "audio"
CACHE_DIR = REPO_ROOT / ".cache" / "voice-edit"


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
    """Parse comma-separated group indices: '0,2' -> [0, 2]."""
    parts = [p.strip() for p in spec.split(",")]
    indices: list[int] = []
    for p in parts:
        if "-" in p:
            lo, hi = p.split("-", 1)
            indices.extend(range(int(lo), int(hi) + 1))
        else:
            indices.append(int(p))
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


# ── Core edit flow ────────────────────────────────────────────────────────


def preview_groups(slug: str) -> None:
    """Print the TTS group structure for a discourse."""
    manifest = _load_manifest(slug)
    tts_groups = manifest.get("ttsGroups", [])
    paragraphs = manifest.get("paragraphs", [])

    print(f"\n{slug}: {len(paragraphs)} paragraphs, {len(tts_groups)} TTS groups")
    print(f"  Total duration: {manifest.get('duration', '?')}s\n")

    for gi, g in enumerate(tts_groups):
        pids = g["paragraphs"]
        dur = g["end"] - g["start"]
        para_ids_display = [paragraphs[pi]["id"] for pi in pids if pi < len(paragraphs)]
        first_words = []
        for pi in pids:
            if pi < len(paragraphs):
                words = paragraphs[pi].get("words", [])
                preview = " ".join(w["w"] for w in words[:8])
                if len(words) > 8:
                    preview += "…"
                first_words.append(f"    ¶{paragraphs[pi]['id']}: {preview}")

        print(f"  Group {gi}: ¶{para_ids_display} [{g['start']:.2f}s – {g['end']:.2f}s] ({dur:.1f}s)")
        for line in first_words:
            print(line)
        print()


def retake_groups(
    slug: str,
    retake_group_indices: list[int],
    voice_name: str,
    language_code: str,
    break_ms: int,
    consecutive_break_ms: int,
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
    print(f"\n{slug}: retaking groups {retake_group_indices}, keeping {kept_indices}")

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

        ssml = build_ssml(texts, brks)
        print(f"  Re-synthesizing group {gi} (¶{[pi+1 for pi in pids]})…")
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
    print(f"  Rollback: python scripts/edit_voice.py {slug} --rollback")

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
        "--retake-groups",
        metavar="INDICES",
        help="Comma-separated 0-based group indices to re-synthesize (e.g. 0,2).",
    )
    action.add_argument(
        "--retake-paragraphs",
        metavar="RANGE",
        help="1-based paragraph range to re-synthesize (e.g. 1-3,5). "
             "Resolves to the TTS groups covering those paragraphs.",
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

    # ── Retake ────────────────────────────────────────────────────────────

    manifest = _load_manifest(slug)

    if args.retake_paragraphs:
        retake_gis = _parse_retake_paragraphs(args.retake_paragraphs, manifest)
        print(f"  Paragraphs {args.retake_paragraphs} → groups {retake_gis}")
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

    voice_name = os.environ.get("TTS_VOICE", "en-US-Chirp3-HD-Charon")
    language_code = os.environ.get("TTS_LANGUAGE_CODE", "en-US")
    break_ms = int(os.environ.get("TTS_PARAGRAPH_BREAK_MS", "1200"))
    consecutive_break_ms = int(os.environ.get("TTS_CONSECUTIVE_PARAGRAPH_BREAK_MS", "800"))

    return retake_groups(
        slug,
        retake_gis,
        voice_name,
        language_code,
        break_ms,
        consecutive_break_ms,
    )


if __name__ == "__main__":
    sys.exit(main())
