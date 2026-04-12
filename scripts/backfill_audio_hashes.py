#!/usr/bin/env python3
"""
Backfill `audioHash` into existing voice manifests in public/audio.

For each <slug>.manifest.json, computes SHA-256 of matching <slug>.webm and writes
`audioHash` into the manifest if missing or different.

Usage:
  python scripts/backfill_audio_hashes.py                # all manifests
  python scripts/backfill_audio_hashes.py --slug mn5     # one slug
  python scripts/backfill_audio_hashes.py --dry-run      # preview only
"""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
AUDIO_DIR = REPO_ROOT / "public" / "audio"


def sha256_hex(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as fh:
        for chunk in iter(lambda: fh.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def manifest_paths(slug: str | None) -> list[Path]:
    if slug:
        p = AUDIO_DIR / f"{slug}.manifest.json"
        return [p] if p.exists() else []
    return sorted(AUDIO_DIR.glob("*.manifest.json"))


def backfill(slug: str | None, dry_run: bool) -> int:
    manifests = manifest_paths(slug)
    if not manifests:
        print("No manifest files found.")
        return 1

    updated = 0
    skipped = 0
    missing_audio = 0

    for mp in manifests:
        discourse = mp.name.removesuffix(".manifest.json")
        ap = AUDIO_DIR / f"{discourse}.webm"
        if not ap.exists():
            print(f"[missing-audio] {discourse}: {ap.relative_to(REPO_ROOT)}")
            missing_audio += 1
            continue

        audio_hash = sha256_hex(ap)
        try:
            data = json.loads(mp.read_text(encoding="utf-8"))
        except Exception as e:
            print(f"[invalid-json] {discourse}: {e}")
            skipped += 1
            continue

        prev = data.get("audioHash")
        if prev == audio_hash:
            skipped += 1
            continue

        data["audioHash"] = audio_hash

        if dry_run:
            print(f"[would-update] {discourse}: {prev!r} -> {audio_hash}")
        else:
            mp.write_text(
                json.dumps(data, ensure_ascii=False, indent=2) + "\n",
                encoding="utf-8",
            )
            print(f"[updated] {discourse}: {audio_hash}")
        updated += 1

    print(
        f"Done. updated={updated}, skipped={skipped}, missing-audio={missing_audio}, total={len(manifests)}"
    )
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description="Backfill audioHash in voice manifests.")
    parser.add_argument("--slug", default=None, help="Optional discourse slug (e.g. dhp90-99)")
    parser.add_argument("--dry-run", action="store_true", help="Preview changes without writing files")
    args = parser.parse_args()
    return backfill(args.slug, args.dry_run)


if __name__ == "__main__":
    raise SystemExit(main())
