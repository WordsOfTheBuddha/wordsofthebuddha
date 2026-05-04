#!/usr/bin/env python3
"""
LUFS loudness normalization across multiple discourse audio files (two-pass ffmpeg loudnorm).

Strategies:
  fixed    — normalize each file toward --target-lufs (default -16).
  reference — target loudness = measured integrated loudness of --reference slug.
  median   — target loudness = median of measured integrated loudness across the batch.

Default is dry-run (measure only). Use --apply to write normalized WebM + update manifests.

Examples (default: measure only; add --apply to write files):
  npm run voice:normalize -- iti1 iti2 iti3
  npm run voice:normalize -- iti1-3 iti10
  npm run voice:normalize -- sn1.1-10
  npm run voice:normalize -- --strategy reference --reference iti5 iti1-20
  npm run voice:normalize -- --apply --strategy median iti1-5
"""

from __future__ import annotations

import argparse
import json
import os
import re
import shutil
import statistics
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

_SCRIPT_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(_SCRIPT_DIR))

from generate_voice import (
    REPO_ROOT,
    expand_target_token,
    file_hash,
    load_routes,
    natural_sort_key,
    write_manifest_v2,
)

AUDIO_DIR = REPO_ROOT / "public" / "audio"
CACHE_VOICE_EDIT = REPO_ROOT / ".cache" / "voice-edit"


def _env_float(name: str, default: float) -> float:
    raw = os.environ.get(name)
    if raw is None or raw == "":
        return default
    return float(raw)


def _env_str(name: str, default: str) -> str:
    return os.environ.get(name, default)


def loudnorm_defaults() -> tuple[float, str, str]:
    """I (LUFS), TP (dBTP), LRA (LU). Env: VOICE_NORM_TARGET_LUFS, VOICE_NORM_TP, VOICE_NORM_LRA."""
    i = _env_float("VOICE_NORM_TARGET_LUFS", -16.0)
    tp = _env_str("VOICE_NORM_TP", "-1.5")
    lra = _env_str("VOICE_NORM_LRA", "11")
    return i, tp, lra


def _extract_loudnorm_json(stderr: str) -> dict[str, str]:
    """Parse first JSON object after loudnorm from ffmpeg stderr."""
    if not stderr.strip():
        raise ValueError("empty ffmpeg stderr")
    start = stderr.find("{")
    if start < 0:
        raise ValueError("no JSON object in ffmpeg output")
    depth = 0
    for i in range(start, len(stderr)):
        c = stderr[i]
        if c == "{":
            depth += 1
        elif c == "}":
            depth -= 1
            if depth == 0:
                blob = stderr[start : i + 1]
                return json.loads(blob)
    raise ValueError("unbalanced JSON in ffmpeg output")


def loudnorm_measure(
    webm: Path, *, i_probe: float, tp: str, lra: str
) -> dict[str, str]:
    cmd = [
        "ffmpeg",
        "-hide_banner",
        "-nostats",
        "-i",
        str(webm),
        "-af",
        f"loudnorm=I={i_probe}:TP={tp}:LRA={lra}:print_format=json",
        "-f",
        "null",
        "-",
    ]
    r = subprocess.run(
        cmd,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
    )
    text = (r.stderr or "") + (r.stdout or "")
    if r.returncode != 0:
        raise RuntimeError(f"ffmpeg pass1 failed ({r.returncode}): {text[-2000:]}")
    return _extract_loudnorm_json(text)


def loudnorm_apply(
    in_webm: Path,
    out_webm: Path,
    *,
    target_i: float,
    tp: str,
    lra: str,
    m: dict[str, str],
) -> None:
    """Second pass: linear loudnorm + same chain as voice:edit encode (alimiter + libopus)."""
    af = (
        f"loudnorm=I={target_i}:TP={tp}:LRA={lra}:"
        f"measured_I={m['input_i']}:measured_TP={m['input_tp']}:"
        f"measured_LRA={m['input_lra']}:measured_thresh={m['input_thresh']}:"
        f"offset={m['target_offset']}:linear=true:print_format=summary,"
        f"alimiter=limit=0.95:level=disabled"
    )
    cmd = [
        "ffmpeg",
        "-y",
        "-hide_banner",
        "-i",
        str(in_webm),
        "-af",
        af,
        "-c:a",
        "libopus",
        "-b:a",
        "32k",
        "-vbr",
        "on",
        "-application",
        "voip",
        "-f",
        "webm",
        str(out_webm),
    ]
    r = subprocess.run(
        cmd,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
    )
    if r.returncode != 0:
        msg = (r.stderr or "") + (r.stdout or "")
        raise RuntimeError(f"ffmpeg pass2 failed ({r.returncode}): {msg[-2500:]}")


def _backup(slug: str) -> None:
    for ext in (".webm", ".manifest.json"):
        src = AUDIO_DIR / f"{slug}{ext}"
        dst = AUDIO_DIR / f"{slug}{ext}.bak"
        if src.exists():
            shutil.copy2(src, dst)


def _clear_voice_edit_cache(slug: str) -> None:
    for name in (f"{slug}.full.wav", f"{slug}.full.meta.json"):
        p = CACHE_VOICE_EDIT / name
        if p.exists():
            p.unlink()


def expand_one_token(token: str, rset: set[str], routes: list[str]) -> list[str]:
    """Resolve one CLI token to discourse slugs (see README-voice normalize section)."""
    token = token.strip()
    if not token:
        return []

    if token in rset or (AUDIO_DIR / f"{token}.webm").exists():
        return [token]

    m = re.fullmatch(r"([a-z]+)(\d+)\.(\d+)-(\d+)", token, re.I)
    if m:
        a = m.group(1).lower()
        b, lo, hi = int(m.group(2)), int(m.group(3)), int(m.group(4))
        if lo > hi:
            lo, hi = hi, lo
        out: list[str] = []
        for k in range(lo, hi + 1):
            slug = f"{a}{b}.{k}"
            if slug in rset or (AUDIO_DIR / f"{slug}.webm").exists():
                out.append(slug)
        if out:
            return sorted(out, key=natural_sort_key)

    m = re.fullmatch(r"([a-z]+)(\d+)-(\d+)", token, re.I)
    if m:
        a = m.group(1).lower()
        lo, hi = int(m.group(2)), int(m.group(3))
        if lo > hi:
            lo, hi = hi, lo
        out = []
        for k in range(lo, hi + 1):
            slug = f"{a}{k}"
            if slug in rset or (AUDIO_DIR / f"{slug}.webm").exists():
                out.append(slug)
        if out:
            return sorted(out, key=natural_sort_key)

    out = expand_target_token(token, routes)
    return out


def expand_discourse_args(tokens: list[str], routes: list[str]) -> list[str]:
    rset = set(routes)
    seen: set[str] = set()
    ordered: list[str] = []
    for raw in tokens:
        for slug in expand_one_token(raw, rset, routes):
            if slug not in seen:
                seen.add(slug)
                ordered.append(slug)
    return ordered


def float_from_measure(k: str, m: dict[str, str]) -> float:
    return float(m[k].strip())


def main() -> int:
    default_i, default_tp, default_lra = loudnorm_defaults()

    p = argparse.ArgumentParser(
        description="LUFS loudness normalization for discourse WebM audio (ffmpeg loudnorm)."
    )
    p.add_argument(
        "discourses",
        nargs="*",
        help="Discourse tokens: exact slugs, ranges (iti1-3, sn1.1-10), or voice:gen-style shortcuts (iti, sn36, …).",
    )
    p.add_argument(
        "--apply",
        action="store_true",
        help="Write normalized audio and update manifests (creates .bak). Default is measure-only.",
    )
    p.add_argument(
        "--strategy",
        choices=("fixed", "reference", "median"),
        default="fixed",
        help="fixed: --target-lufs; reference: match --reference measured I; median: batch median I.",
    )
    p.add_argument(
        "--target-lufs",
        type=float,
        default=default_i,
        metavar="LUFS",
        help=f"Integrated loudness target for fixed strategy (default {default_i} or VOICE_NORM_TARGET_LUFS).",
    )
    p.add_argument(
        "--reference",
        metavar="SLUG",
        help="Reference discourse for reference strategy (must have audio).",
    )
    p.add_argument(
        "--tp",
        default=default_tp,
        help=f"True peak ceiling for loudnorm (default {default_tp} or VOICE_NORM_TP).",
    )
    p.add_argument(
        "--lra",
        default=default_lra,
        help=f"Loudness range anchor for loudnorm (default {default_lra} or VOICE_NORM_LRA).",
    )
    args = p.parse_args()
    dry_run = not args.apply  # default: dry-run (no --apply)

    i_probe = args.target_lufs if args.strategy == "fixed" else default_i

    if not args.discourses:
        p.print_help()
        print("\n[error] Pass at least one discourse token.", file=sys.stderr)
        return 1

    routes = load_routes()
    slugs = expand_discourse_args(args.discourses, routes)
    if not slugs:
        print("[error] No discourses matched (check routes, ranges, and existing .webm).", file=sys.stderr)
        return 1

    missing_webm = [s for s in slugs if not (AUDIO_DIR / f"{s}.webm").exists()]
    if missing_webm:
        for s in missing_webm:
            print(f"[warn] skip (no audio): {s}", file=sys.stderr)
        slugs = [s for s in slugs if s not in missing_webm]
    if not slugs:
        print("[error] No inputs left after filtering missing WebM.", file=sys.stderr)
        return 1

    if args.strategy == "reference":
        if not args.reference:
            print("[error] --reference is required for reference strategy.", file=sys.stderr)
            return 1
        ref_path = AUDIO_DIR / f"{args.reference}.webm"
        if not ref_path.exists():
            print(f"[error] Reference has no WebM: {ref_path.relative_to(REPO_ROOT)}", file=sys.stderr)
            return 1

    measures: dict[str, dict[str, str]] = {}
    input_is: list[float] = []

    print(f"Strategy: {args.strategy}  (probe I={i_probe} LUFS for measurement pass)")
    print(f"loudnorm TP={args.tp}  LRA={args.lra}")
    print()

    for slug in slugs:
        webm = AUDIO_DIR / f"{slug}.webm"
        try:
            m = loudnorm_measure(webm, i_probe=i_probe, tp=args.tp, lra=args.lra)
        except Exception as e:
            print(f"[error] {slug}: {e}", file=sys.stderr)
            return 1
        measures[slug] = m
        input_is.append(float_from_measure("input_i", m))

    target_lufs: float
    if args.strategy == "fixed":
        target_lufs = float(args.target_lufs)
    elif args.strategy == "reference":
        ref_m = loudnorm_measure(
            AUDIO_DIR / f"{args.reference}.webm",
            i_probe=i_probe,
            tp=args.tp,
            lra=args.lra,
        )
        target_lufs = float_from_measure("input_i", ref_m)
        print(f"Reference {args.reference}: input_i = {target_lufs:.2f} LUFS (target for all)")
    else:
        target_lufs = float(statistics.median(input_is))
        print(f"Median input_i over batch: {target_lufs:.2f} LUFS")

    print()
    hdr = (
        f"{'slug':<18} {'input_i':>10} {'input_tp':>10} {'input_lra':>10} "
        f"{'Δ→target':>10} {'target_I':>10}"
    )
    print(hdr)
    print("-" * len(hdr))

    for slug in slugs:
        m = measures[slug]
        ini = float_from_measure("input_i", m)
        delta = target_lufs - ini
        print(
            f"{slug:<18} {ini:>9.2f} {float_from_measure('input_tp', m):>9.2f} "
            f"{float_from_measure('input_lra', m):>9.2f} "
            f"{delta:>+9.2f} {target_lufs:>9.2f}"
        )

    print()

    if dry_run:
        print("Dry-run only (no files written). Use --apply to normalize and update manifests.")
        return 0

    # Apply
    for slug in slugs:
        webm = AUDIO_DIR / f"{slug}.webm"
        m = measures[slug]
        tmp = AUDIO_DIR / f"{slug}.webm.norm.tmp"
        try:
            loudnorm_apply(
                webm,
                tmp,
                target_i=target_lufs,
                tp=args.tp,
                lra=args.lra,
                m=m,
            )
        except Exception as e:
            print(f"[error] {slug}: {e}", file=sys.stderr)
            if tmp.exists():
                tmp.unlink(missing_ok=True)
            return 1

        _backup(slug)
        shutil.move(str(tmp), str(webm))
        _clear_voice_edit_cache(slug)

        man_path = AUDIO_DIR / f"{slug}.manifest.json"
        if man_path.exists():
            try:
                manifest = json.loads(man_path.read_text(encoding="utf-8"))
                h = file_hash(webm)
                if h:
                    manifest["audioHash"] = h
                manifest["generatedAt"] = datetime.now(timezone.utc).strftime(
                    "%Y-%m-%dT%H:%M:%SZ"
                )
                write_manifest_v2(man_path, manifest, slug)
            except Exception as e:
                print(f"[warn] {slug}: manifest update failed: {e}", file=sys.stderr)
        print(f"  OK {slug}")

    print("\nDone. Backups: *.bak  Rollback: copy .bak over live files if needed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
