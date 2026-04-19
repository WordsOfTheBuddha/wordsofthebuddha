#!/usr/bin/env python3
"""
Sync local audio files (Opus + manifests) with Cloudflare R2.

Objects are stored at the bucket root (e.g. mn10.webm, mn10.manifest.json) so the
public URL is https://<custom-domain>/mn10.webm — no /audio/ path segment.

Push scales to large libraries: it lists remote keys in bulk (ListObjectsV2 pages)
instead of one HEAD per file, hashes local files in parallel, and --force skips both
so a full re-upload is not slowed by comparison work.

Usage:
  python scripts/sync_audio_r2.py push              # upload all local → R2
  python scripts/sync_audio_r2.py push dhp1-20      # upload one discourse
  python scripts/sync_audio_r2.py push mn10,mn11    # upload several (comma-separated slugs)
  python scripts/sync_audio_r2.py push --dry-run    # list files that would upload, with reasons
  python scripts/sync_audio_r2.py pull              # download R2 → local (skip when local MD5 matches ETag)
  python scripts/sync_audio_r2.py pull mn10         # same, one discourse slug
  python scripts/sync_audio_r2.py pull mn10,mn11    # pull several discourses
  python scripts/sync_audio_r2.py pull --force      # re-download all, ignoring MD5 match
  python scripts/sync_audio_r2.py pull --dry-run    # list files that would download, with reasons

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
from concurrent.futures import ThreadPoolExecutor, as_completed
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


def parse_slugs(slug_arg: str | None) -> list[str] | None:
    """Split comma-separated discourse slugs; None means no filter (all discourses)."""
    if slug_arg is None:
        return None
    parts = [p.strip() for p in slug_arg.split(",") if p.strip()]
    return parts if parts else None


def _is_syncable_audio_basename(name: str) -> bool:
    """True for published audio keys only: *.webm and *.manifest.json (not other *.json)."""
    return name.endswith(".webm") or name.endswith(".manifest.json")


def local_audio_files(slugs: list[str] | None = None) -> list[Path]:
    """List .webm and .manifest.json files in public/audio/ (excludes e.g. *.tts-debug.json)."""
    if not AUDIO_DIR.is_dir():
        return []
    files: list[Path] = []
    allowed: set[str] | None = None
    if slugs:
        allowed = set()
        for slug in slugs:
            allowed.add(f"{slug}.webm")
            allowed.add(f"{slug}.manifest.json")
    for f in sorted(AUDIO_DIR.iterdir()):
        if not _is_syncable_audio_basename(f.name):
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


def _local_md5_parallel(paths: list[Path]) -> dict[str, str]:
    """name -> md5 hex. Parallel reads for many audio files."""
    if not paths:
        return {}
    if len(paths) == 1:
        p = paths[0]
        return {p.name: _local_md5(p)}
    n = len(paths)
    workers = min(32, max(4, (os.cpu_count() or 4) * 2), n)
    out: dict[str, str] = {}

    def _one(p: Path) -> tuple[str, str]:
        return p.name, _local_md5(p)

    with ThreadPoolExecutor(max_workers=workers) as pool:
        futures = [pool.submit(_one, p) for p in paths]
        for fut in as_completed(futures):
            name, digest = fut.result()
            out[name] = digest
    return out


def _is_audio_object_key(key: str) -> bool:
    if "/" in key:
        return False
    return _is_syncable_audio_basename(key)


def _fetch_remote_etags_bulk(s3, bucket: str, slugs: list[str] | None) -> dict[str, str]:
    """
    key -> ETag (stripped). Uses ListObjectsV2 (paginated) instead of per-key HEAD,
    so a full sync touches O(pages) HTTP calls instead of O(files).
    """
    from botocore.exceptions import ClientError

    out: dict[str, str] = {}
    allowed: set[str] | None = None
    list_prefix = ""
    if slugs:
        if len(slugs) == 1:
            list_prefix = f"{slugs[0]}."
        else:
            allowed = set()
            for s in slugs:
                allowed.add(f"{s}.webm")
                allowed.add(f"{s}.manifest.json")
    paginator = s3.get_paginator("list_objects_v2")
    try:
        for page in paginator.paginate(Bucket=bucket, Prefix=list_prefix):
            for obj in page.get("Contents", []):
                key = obj["Key"]
                if not _is_audio_object_key(key):
                    continue
                if allowed is not None and key not in allowed:
                    continue
                etag = (obj.get("ETag") or "").strip('"')
                if etag:
                    out[key] = etag
    except ClientError as e:
        code = e.response.get("Error", {}).get("Code", "") or ""
        print(f"Failed to list remote objects: {code}", file=sys.stderr)
        raise
    return out


def _human_upload_reason(
    *,
    force: bool,
    local_hash: str,
    remote_etag: str | None,
    remote_missing: bool,
    remote_error: str | None,
) -> str:
    if force:
        return "would upload because --force was set (ignores remote comparison)"
    if remote_error:
        return (
            f"would upload — could not compare to remote ({remote_error}); "
            "assuming upload is needed"
        )
    if remote_missing:
        return "would upload — no object with this key on remote (new upload)"
    return "would upload — local file differs from remote (MD5 ≠ remote ETag)"


def _human_pull_reason(*, force: bool, local_exists: bool) -> str:
    """Reason text for pull --dry-run (only called when a download would occur)."""
    if force:
        return "would download because --force was set (ignores local comparison)"
    if not local_exists:
        return "would download — no local file yet"
    return "would download — local file differs from remote (MD5 ≠ remote ETag)"


def push(s3, bucket: str, slugs: list[str] | None, force: bool = False, dry_run: bool = False) -> None:
    from boto3.s3.transfer import TransferConfig

    upload_config = TransferConfig(multipart_threshold=UPLOAD_MULTIPART_THRESHOLD_BYTES)
    files = local_audio_files(slugs)
    if not files:
        print("No audio files to push.")
        return

    uploaded = 0
    skipped = 0

    # --force: skip remote listing and MD5; upload every file (fast path for full re-push).
    if force:
        for f in files:
            if dry_run:
                reason = _human_upload_reason(
                    force=True,
                    local_hash="",
                    remote_etag=None,
                    remote_missing=False,
                    remote_error=None,
                )
                print(f"  ↑ {f.name} — {reason}")
                uploaded += 1
                continue
            key = f.name
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
        if dry_run:
            if uploaded:
                print(f"Dry run: would upload {uploaded} file(s).")
            else:
                print("Dry run: nothing to upload.")
        else:
            print(f"Pushed {uploaded} file(s), {skipped} unchanged.")
        return

    remote_etags = _fetch_remote_etags_bulk(s3, bucket, slugs)
    local_hashes = _local_md5_parallel(files)

    for f in files:
        key = f.name
        local_hash = local_hashes[key]
        remote_etag = remote_etags.get(key)
        remote_missing = key not in remote_etags

        if dry_run:
            if remote_etag and local_hash.lower() == remote_etag.lower():
                continue
            reason = _human_upload_reason(
                force=False,
                local_hash=local_hash,
                remote_etag=remote_etag,
                remote_missing=remote_missing,
                remote_error=None,
            )
            print(f"  ↑ {f.name} — {reason}")
            uploaded += 1
            continue

        if remote_etag and local_hash.lower() == remote_etag.lower():
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

    if dry_run:
        if uploaded:
            print(f"Dry run: would upload {uploaded} file(s).")
        else:
            print("Dry run: nothing to upload.")
    else:
        print(f"Pushed {uploaded} file(s), {skipped} unchanged.")


def pull(s3, bucket: str, slugs: list[str] | None, force: bool = False, dry_run: bool = False) -> None:
    AUDIO_DIR.mkdir(parents=True, exist_ok=True)
    pulled = 0
    skipped = 0
    paginator = s3.get_paginator("list_objects_v2")
    allowed: set[str] | None = None
    list_prefix = ""
    if slugs:
        if len(slugs) == 1:
            s = slugs[0]
            allowed = {f"{s}.webm", f"{s}.manifest.json"}
            list_prefix = f"{s}."
        else:
            allowed = set()
            for s in slugs:
                allowed.add(f"{s}.webm")
                allowed.add(f"{s}.manifest.json")
    for page in paginator.paginate(
        Bucket=bucket,
        Prefix=list_prefix,
    ):
        for obj in page.get("Contents", []):
            key = obj["Key"]
            if "/" in key:
                continue
            if allowed is not None and key not in allowed:
                continue
            if not _is_syncable_audio_basename(key):
                continue
            local = AUDIO_DIR / key
            remote_hash = (obj.get("ETag") or "").strip('"').lower()

            if dry_run:
                exists = local.is_file()
                if force:
                    would_pull = True
                    reason = _human_pull_reason(force=True, local_exists=exists)
                elif not exists:
                    would_pull = True
                    reason = _human_pull_reason(force=False, local_exists=False)
                else:
                    local_hash = _local_md5(local).lower()
                    would_pull = not (remote_hash and local_hash == remote_hash)
                    if not would_pull:
                        skipped += 1
                        continue
                    reason = _human_pull_reason(force=False, local_exists=True)
                print(f"  ↓ s3://{bucket}/{key} → {local.relative_to(REPO_ROOT)} — {reason}")
                pulled += 1
                continue

            if not force and local.is_file():
                local_hash = _local_md5(local).lower()
                if remote_hash and local_hash == remote_hash:
                    skipped += 1
                    continue
            print(f"  ↓ s3://{bucket}/{key} → {local.relative_to(REPO_ROOT)}")
            s3.download_file(bucket, key, str(local))
            pulled += 1
    if dry_run:
        if pulled:
            print(f"Dry run: would download {pulled} file(s).")
        else:
            print("Dry run: nothing to download.")
    else:
        print(f"Pulled {pulled} file(s), skipped {skipped} unchanged (local MD5 matches remote ETag).")


def main() -> int:
    load_dotenv()

    parser = argparse.ArgumentParser(description="Sync audio with Cloudflare R2.")
    parser.add_argument("action", choices=["push", "pull"], help="push (local→R2) or pull (R2→local)")
    parser.add_argument(
        "slug",
        nargs="?",
        default=None,
        help="Optional discourse slug(s), comma-separated to sync several (e.g. mn10,mn11)",
    )
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
        "--dry-run",
        action="store_true",
        help="List files that would change (push: upload; pull: download) and why (no data transfer).",
    )
    args = parser.parse_args()

    bucket = args.bucket or os.environ.get("R2_BUCKET", DEFAULT_BUCKET)
    s3 = get_s3_client()
    slugs = parse_slugs(args.slug)

    if args.action == "push":
        push(s3, bucket, slugs, force=args.force, dry_run=args.dry_run)
    else:
        pull(s3, bucket, slugs, force=args.force, dry_run=args.dry_run)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
