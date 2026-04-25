#!/usr/bin/env python3
"""Backfill section headings into existing voice manifests.

Adds a top-level `headings` array, where each heading is aligned to the next
spoken paragraph id. Audio and paragraph timings are left untouched.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from audio_headings import apply_heading_metadata, mdx_path_for


ROOT = Path(__file__).resolve().parents[1]
AUDIO_DIR = ROOT / "public" / "audio"


def backfill_slug(slug: str, *, verbose: bool = False) -> bool:
    manifest_path = AUDIO_DIR / f"{slug}.manifest.json"
    mdx_path = mdx_path_for(slug)
    if not manifest_path.exists():
        if verbose:
            print(f"skip {slug}: manifest not found")
        return False
    if not mdx_path:
        if verbose:
            print(f"skip {slug}: MDX not found")
        return False

    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    heading_count = apply_heading_metadata(
        manifest,
        mdx_path.read_text(encoding="utf-8"),
        schema_version=3,
    )

    manifest_path.write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    if verbose:
        print(f"{slug}: headings={heading_count}")
    return True


def manifest_slugs() -> list[str]:
    return sorted(path.name.removesuffix(".manifest.json") for path in AUDIO_DIR.glob("*.manifest.json"))


def main() -> None:
    parser = argparse.ArgumentParser(description="Backfill section headings into voice manifests.")
    parser.add_argument("slugs", nargs="*", help="Audio slugs to update, e.g. mn25 sn22.7")
    parser.add_argument(
        "--all-targets",
        action="store_true",
        help="Process every local audio manifest with a matching MDX file.",
    )
    parser.add_argument(
        "--verbose",
        action="store_true",
        help="Print per-discourse heading counts and skip reasons.",
    )
    args = parser.parse_args()
    slugs = manifest_slugs() if args.all_targets else args.slugs
    if not slugs:
        parser.error("provide at least one slug, or use --all-targets")
    updated = sum(1 for slug in slugs if backfill_slug(slug, verbose=args.verbose))
    print(f"Done. updated={updated}, total={len(slugs)}")


if __name__ == "__main__":
    main()
