#!/usr/bin/env python3
"""
Sync local audio files (Opus + manifests) with Cloudflare R2.

Objects are stored at the bucket root (e.g. mn10.webm, mn10.manifest.json) so the
public URL is https://<custom-domain>/mn10.webm — no /audio/ path segment.

Usage:
  python scripts/sync_audio_r2.py push              # upload all local → R2
  python scripts/sync_audio_r2.py push dhp1-20      # upload one discourse
  python scripts/sync_audio_r2.py pull              # download R2 → local (skip when local MD5 matches ETag)
  python scripts/sync_audio_r2.py pull mn10         # same, one discourse slug
  python scripts/sync_audio_r2.py pull --force      # re-download all, ignoring MD5 match

Env vars (set in .env or export):
  R2_ACCOUNT_ID          Cloudflare account ID
  R2_ACCESS_KEY_ID       S3-compat access key
  R2_SECRET_ACCESS_KEY   S3-compat secret key
  R2_BUCKET              Bucket name (default: dhamma-audio)
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
AUDIO_DIR = REPO_ROOT / "public" / "audio"
DEFAULT_BUCKET = "dhamma-audio"
# Boto3 defaults to multipart above 8 MiB; multipart ETag is not the file MD5, so
# local MD5 vs remote ETag would always disagree. Keep uploads single-part up to 32 MiB.
UPLOAD_MULTIPART_THRESHOLD_BYTES = 32 * 1024 * 1024


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


def _purge_cloudflare_cache(urls: list[str]) -> None:
    """Purge Cloudflare CDN edge cache for the given public URLs.

    Requires CF_ZONE_ID and CF_API_TOKEN env vars. Silently skips if not set.
    """
    import urllib.request

    zone_id = os.environ.get("CF_ZONE_ID", "")
    api_token = os.environ.get("CF_API_TOKEN", "")
    if not zone_id or not api_token:
        print(
            "  (skipping CDN purge — CF_ZONE_ID or CF_API_TOKEN not set)",
            file=sys.stderr,
        )
        return

    endpoint = f"https://api.cloudflare.com/client/v4/zones/{zone_id}/purge_cache"
    payload = json.dumps({"files": urls}).encode()
    req = urllib.request.Request(
        endpoint,
        data=payload,
        headers={
            "Authorization": f"Bearer {api_token}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            result = json.loads(resp.read())
            if result.get("success"):
                print(f"  ✓ CDN cache purged for {len(urls)} URL(s)")
            else:
                print(f"  ✗ CDN purge failed: {result.get('errors')}", file=sys.stderr)
    except Exception as exc:
        print(f"  ✗ CDN purge error: {exc}", file=sys.stderr)


def push(s3, bucket: str, slug: str | None, force: bool = False, purge_cdn: bool = False) -> None:
    from boto3.s3.transfer import TransferConfig

    upload_config = TransferConfig(multipart_threshold=UPLOAD_MULTIPART_THRESHOLD_BYTES)
    files = local_audio_files(slug)
    if not files:
        print("No audio files to push.")
        return

    public_origin = os.environ.get("PUBLIC_AUDIO_BASE_URL", "").rstrip("/")
    uploaded = 0
    skipped = 0
    purge_urls: list[str] = []

    for f in files:
        key = f.name
        local_hash = _local_md5(f)
        remote_hash = _remote_etag(s3, bucket, key)
        if not force and local_hash == remote_hash:
            if purge_cdn and public_origin:
                # R2 already has the latest content but CDN may be stale — queue for purge
                purge_urls.append(f"{public_origin}/{key}")
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
            Config=upload_config,
        )
        uploaded += 1
        if public_origin:
            purge_urls.append(f"{public_origin}/{key}")

    print(f"Pushed {uploaded} file(s), {skipped} unchanged.")

    if purge_cdn and purge_urls:
        print(f"  Purging CDN cache for {len(purge_urls)} URL(s)…")
        _purge_cloudflare_cache(purge_urls)
    elif purge_cdn and not purge_urls:
        print("  No URLs to purge from CDN.")
    elif purge_cdn and not public_origin:
        print(
            "  (skipping CDN purge — PUBLIC_AUDIO_BASE_URL not set)",
            file=sys.stderr,
        )


def pull(s3, bucket: str, slug: str | None, force: bool = False) -> None:
    AUDIO_DIR.mkdir(parents=True, exist_ok=True)
    pulled = 0
    skipped = 0
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
            if not force and local.is_file():
                remote_hash = (obj.get("ETag") or "").strip('"').lower()
                local_hash = _local_md5(local).lower()
                if remote_hash and local_hash == remote_hash:
                    skipped += 1
                    continue
            print(f"  ↓ s3://{bucket}/{key} → {local.relative_to(REPO_ROOT)}")
            s3.download_file(bucket, key, str(local))
            pulled += 1
    print(f"Pulled {pulled} file(s), skipped {skipped} unchanged (local MD5 matches remote ETag).")


def main() -> int:
    load_dotenv()

    parser = argparse.ArgumentParser(description="Sync audio with Cloudflare R2.")
    parser.add_argument("action", choices=["push", "pull"], help="push (local→R2) or pull (R2→local)")
    parser.add_argument("slug", nargs="?", default=None, help="Optional discourse slug to limit sync")
    parser.add_argument("--bucket", default=None, help=f"R2 bucket name (default: {DEFAULT_BUCKET})")
    parser.add_argument(
        "--force",
        action="store_true",
        help=(
            "Push: bypass MD5 check and always upload (useful when R2 ETag is stale/wrong). "
            "Pull: download even when local MD5 already matches remote ETag."
        ),
    )
    parser.add_argument(
        "--purge-cdn",
        action="store_true",
        help=(
            "Push: purge Cloudflare CDN edge cache for uploaded files + any unchanged slug-matched files "
            "(needs CF_ZONE_ID, CF_API_TOKEN, and PUBLIC_AUDIO_BASE_URL in env)"
        ),
    )
    args = parser.parse_args()

    bucket = args.bucket or os.environ.get("R2_BUCKET", DEFAULT_BUCKET)
    s3 = get_s3_client()

    if args.action == "push":
        push(s3, bucket, args.slug, force=args.force, purge_cdn=args.purge_cdn)
    else:
        pull(s3, bucket, args.slug, force=args.force)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
