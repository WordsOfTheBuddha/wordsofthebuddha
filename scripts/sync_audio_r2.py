#!/usr/bin/env python3
"""
Sync local audio files (Opus + manifests) with Cloudflare R2.

Objects are stored at the bucket root (e.g. mn10.webm, mn10.manifest.json) so the
public URL is https://<custom-domain>/mn10.webm — no /audio/ path segment.

Usage:
  python scripts/sync_audio_r2.py push              # upload all local → R2
  python scripts/sync_audio_r2.py push dhp1-20      # upload one discourse
  python scripts/sync_audio_r2.py pull              # download all R2 → local
  python scripts/sync_audio_r2.py pull mn10         # download one discourse

Env vars (set in .env or export):
  R2_ACCOUNT_ID          Cloudflare account ID
  R2_ACCESS_KEY_ID       S3-compat access key
  R2_SECRET_ACCESS_KEY   S3-compat secret key
  R2_BUCKET              Bucket name (default: dhamma-audio)
"""

from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
AUDIO_DIR = REPO_ROOT / "public" / "audio"
DEFAULT_BUCKET = "dhamma-audio"


def load_dotenv() -> None:
    try:
        from dotenv import load_dotenv as _load
        _load(REPO_ROOT / ".env")
    except ImportError:
        pass


def get_s3_client():
    import boto3

    account_id = os.environ.get("R2_ACCOUNT_ID", "")
    access_key = os.environ.get("R2_ACCESS_KEY_ID", "")
    secret_key = os.environ.get("R2_SECRET_ACCESS_KEY", "")

    if not all([account_id, access_key, secret_key]):
        print(
            "Set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY.",
            file=sys.stderr,
        )
        sys.exit(1)

    return boto3.client(
        "s3",
        endpoint_url=f"https://{account_id}.r2.cloudflarestorage.com",
        aws_access_key_id=access_key,
        aws_secret_access_key=secret_key,
        region_name="auto",
    )


def local_audio_files(slug: str | None = None) -> list[Path]:
    """List .webm and .manifest.json files in public/audio/."""
    if not AUDIO_DIR.is_dir():
        return []
    files: list[Path] = []
    allowed: set[str] | None = None
    if slug:
        allowed = {f"{slug}.webm", f"{slug}.manifest.json"}
    for f in sorted(AUDIO_DIR.iterdir()):
        if f.suffix not in (".webm", ".json"):
            continue
        if allowed is not None and f.name not in allowed:
            continue
        files.append(f)
    return files


def _local_md5(path: Path) -> str:
    import hashlib
    h = hashlib.md5()
    with open(path, "rb") as fh:
        for chunk in iter(lambda: fh.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def _remote_etag(s3, bucket: str, key: str) -> str | None:
    try:
        resp = s3.head_object(Bucket=bucket, Key=key)
        return resp.get("ETag", "").strip('"')
    except Exception:
        return None


def push(s3, bucket: str, slug: str | None) -> None:
    files = local_audio_files(slug)
    if not files:
        print("No audio files to push.")
        return
    uploaded = 0
    skipped = 0
    for f in files:
        key = f.name
        local_hash = _local_md5(f)
        remote_hash = _remote_etag(s3, bucket, key)
        if local_hash == remote_hash:
            skipped += 1
            continue
        content_type = "audio/webm" if f.suffix == ".webm" else "application/json"
        cache = (
            "public, max-age=31536000, immutable"
            if f.suffix == ".webm"
            else "public, max-age=3600, stale-while-revalidate=86400"
        )
        print(f"  ↑ {f.name} → s3://{bucket}/{key}")
        s3.upload_file(
            str(f),
            bucket,
            key,
            ExtraArgs={"ContentType": content_type, "CacheControl": cache},
        )
        uploaded += 1
    print(f"Pushed {uploaded} file(s), {skipped} unchanged.")


def pull(s3, bucket: str, slug: str | None) -> None:
    AUDIO_DIR.mkdir(parents=True, exist_ok=True)
    count = 0
    paginator = s3.get_paginator("list_objects_v2")
    allowed: set[str] | None = None
    if slug:
        allowed = {f"{slug}.webm", f"{slug}.manifest.json"}
    for page in paginator.paginate(
        Bucket=bucket,
        Prefix=f"{slug}." if slug else "",
    ):
        for obj in page.get("Contents", []):
            key = obj["Key"]
            if "/" in key:
                continue
            if allowed is not None and key not in allowed:
                continue
            if not (key.endswith(".webm") or key.endswith(".manifest.json")):
                continue
            local = AUDIO_DIR / key
            print(f"  ↓ s3://{bucket}/{key} → {local.relative_to(REPO_ROOT)}")
            s3.download_file(bucket, key, str(local))
            count += 1
    print(f"Pulled {count} file(s).")


def main() -> int:
    load_dotenv()

    parser = argparse.ArgumentParser(description="Sync audio with Cloudflare R2.")
    parser.add_argument("action", choices=["push", "pull"], help="push (local→R2) or pull (R2→local)")
    parser.add_argument("slug", nargs="?", default=None, help="Optional discourse slug to limit sync")
    parser.add_argument("--bucket", default=None, help=f"R2 bucket name (default: {DEFAULT_BUCKET})")
    args = parser.parse_args()

    bucket = args.bucket or os.environ.get("R2_BUCKET", DEFAULT_BUCKET)
    s3 = get_s3_client()

    if args.action == "push":
        push(s3, bucket, args.slug)
    else:
        pull(s3, bucket, args.slug)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
