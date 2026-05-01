#!/usr/bin/env python3
from __future__ import annotations

import argparse
import difflib
import json
import os
import re
import shlex
import subprocess
import sys
from dataclasses import dataclass, field
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
if str(SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIR))

from voice_text_normalizer import (
    extract_paragraph_chunks_heading_style,
    extract_paragraphs_auto,
    strip_frontmatter,
)

REPO_ROOT = Path(__file__).resolve().parent.parent
EN_PREFIX = "src/content/en/"


@dataclass(frozen=True)
class SlugImpact:
    slug: str
    severity: str
    recommendation: str
    changed_paragraphs: list[int]
    reason_flags: list[str]
    manifest_changed_count: int
    tts_changed_count: int
    display_changed_count: int
    # Unified diffs of manifest-normalized text per paragraph (listener-visible).
    manifest_diffs: tuple[tuple[int, str], ...] = field(default_factory=tuple)


def run_git(args: list[str]) -> str:
    res = subprocess.run(
        ["git", *args],
        cwd=REPO_ROOT,
        capture_output=True,
        text=True,
        check=False,
    )
    if res.returncode != 0:
        raise RuntimeError(res.stderr.strip() or f"git {' '.join(args)} failed")
    return res.stdout


def load_recorded_slugs() -> set[str]:
    p = REPO_ROOT / "src/data/audioStatus.ts"
    raw = p.read_text(encoding="utf-8")
    m = re.search(r"new Set\((\[[\s\S]*\])\)", raw)
    if not m:
        return set()
    return set(json.loads(m.group(1)))


def changed_english_files(rev_range: str) -> list[str]:
    out = run_git(["diff", "--name-only", rev_range, "--", "src/content/en"])
    files = [x.strip() for x in out.splitlines() if x.strip().endswith(".mdx")]
    return files


def slug_from_path(path: str) -> str:
    return Path(path).stem


def file_at_revision(rev: str, path: str) -> str:
    if rev == "WORKTREE":
        p = REPO_ROOT / path
        if not p.exists():
            return ""
        return p.read_text(encoding="utf-8")
    out = subprocess.run(
        ["git", "show", f"{rev}:{path}"],
        cwd=REPO_ROOT,
        capture_output=True,
        text=True,
        check=False,
    )
    if out.returncode != 0:
        return ""
    return out.stdout


def paragraph_texts(raw_mdx: str, mode: str) -> dict[int, str]:
    body = strip_frontmatter(raw_mdx)
    if mode == "manifest":
        pairs = extract_paragraphs_auto(body, for_manifest=True)
    elif mode == "tts":
        pairs = extract_paragraphs_auto(body, for_tts=True)
    else:
        pairs = extract_paragraphs_auto(body)
    return {pid: txt for pid, txt, _ in pairs}


def classify(
    slug: str,
    manifest_old: dict[int, str],
    manifest_new: dict[int, str],
    tts_old: dict[int, str],
    tts_new: dict[int, str],
    display_old: dict[int, str],
    display_new: dict[int, str],
    heading_structure_changed: bool = False,
) -> SlugImpact:
    all_ids = sorted(set(manifest_old) | set(manifest_new) | set(tts_old) | set(tts_new))
    changed_manifest = [pid for pid in all_ids if manifest_old.get(pid, "") != manifest_new.get(pid, "")]
    changed_tts = [pid for pid in all_ids if tts_old.get(pid, "") != tts_new.get(pid, "")]
    changed_display = [
        pid
        for pid in sorted(set(display_old) | set(display_new))
        if display_old.get(pid, "") != display_new.get(pid, "")
    ]
    changed_union = sorted(set(changed_manifest) | set(changed_tts) | set(changed_display))

    reasons: list[str] = []
    if len(manifest_old) != len(manifest_new):
        reasons.append("paragraphCountChanged")
    if len(tts_old) != len(tts_new):
        reasons.append("ttsParagraphCountChanged")
    if heading_structure_changed:
        reasons.append("headingStructureChanged")
    if changed_manifest:
        reasons.append("manifestTextChanged")
    if changed_tts:
        reasons.append("ttsTextChanged")
    if changed_display:
        reasons.append("displayTextChanged")

    if (
        "paragraphCountChanged" in reasons
        or "ttsParagraphCountChanged" in reasons
        or "headingStructureChanged" in reasons
    ):
        severity = "major"
    elif not changed_union:
        severity = "none"
    elif len(changed_union) <= 2:
        severity = "minor"
    elif len(changed_union) <= 8:
        severity = "moderate"
    else:
        severity = "major"

    rec = retake_recommendation(severity, changed_union)

    return SlugImpact(
        slug=slug,
        severity=severity,
        recommendation=rec,
        changed_paragraphs=changed_union,
        reason_flags=reasons,
        manifest_changed_count=len(changed_manifest),
        tts_changed_count=len(changed_tts),
        display_changed_count=len(changed_display),
    )


def format_ranges(nums: list[int]) -> str:
    if not nums:
        return "-"
    ranges: list[tuple[int, int]] = []
    start = prev = nums[0]
    for n in nums[1:]:
        if n == prev + 1:
            prev = n
            continue
        ranges.append((start, prev))
        start = prev = n
    ranges.append((start, prev))
    return ", ".join(f"{a}" if a == b else f"{a}-{b}" for a, b in ranges)


def retake_recommendation(severity: str, changed_union: list[int]) -> str:
    if severity == "none":
        return "No re-record needed."
    if severity == "major":
        return "Recommend full discourse re-record."
    rng = format_ranges(changed_union)
    n = len(changed_union)
    if severity == "minor":
        word = "paragraph" if n == 1 else "paragraphs"
        return f"Retake {word} {rng}."
    return f"Retake paragraphs {rng}."


def compute_manifest_unified_diffs(
    old_m: dict[int, str],
    new_m: dict[int, str],
    paragraph_ids: list[int],
    *,
    context_lines: int = 2,
) -> list[tuple[int, str]]:
    out: list[tuple[int, str]] = []
    for pid in paragraph_ids:
        a = old_m.get(pid, "")
        b = new_m.get(pid, "")
        if a == b:
            continue
        # unified_diff expects lines that end with \n so -/+ hunks stay on separate lines.
        al = [ln + "\n" for ln in a.split("\n")]
        bl = [ln + "\n" for ln in b.split("\n")]
        if not al:
            al = ["\n"]
        if not bl:
            bl = ["\n"]
        diff = difflib.unified_diff(
            al,
            bl,
            fromfile=f"¶{pid} (before)",
            tofile=f"¶{pid} (after)",
            n=context_lines,
        )
        block = "".join(diff)
        if block:
            out.append((pid, block))
    return out


def color_enabled(mode: str) -> bool:
    if mode == "always":
        return True
    if mode == "never":
        return False
    # auto
    return sys.stdout.isatty() and os.getenv("NO_COLOR") is None


def _mark_removed(text: str, use_color: bool) -> str:
    if not text:
        return text
    if use_color:
        return f"\x1b[31m{text}\x1b[0m"
    return f"[-{text}-]"


def _mark_added(text: str, use_color: bool) -> str:
    if not text:
        return text
    if use_color:
        return f"\x1b[32m{text}\x1b[0m"
    return f"{{+{text}+}}"


def highlight_inline_word_diff(old_text: str, new_text: str, use_color: bool) -> tuple[str, str]:
    old_tokens = re.split(r"(\s+)", old_text)
    new_tokens = re.split(r"(\s+)", new_text)
    sm = difflib.SequenceMatcher(a=old_tokens, b=new_tokens)

    old_out: list[str] = []
    new_out: list[str] = []
    for tag, i1, i2, j1, j2 in sm.get_opcodes():
        old_chunk = "".join(old_tokens[i1:i2])
        new_chunk = "".join(new_tokens[j1:j2])
        if tag == "equal":
            old_out.append(old_chunk)
            new_out.append(new_chunk)
        elif tag == "replace":
            old_out.append(_mark_removed(old_chunk, use_color))
            new_out.append(_mark_added(new_chunk, use_color))
        elif tag == "delete":
            old_out.append(_mark_removed(old_chunk, use_color))
        elif tag == "insert":
            new_out.append(_mark_added(new_chunk, use_color))

    return "".join(old_out), "".join(new_out)


def render_precise_diff_block(pid: int, unified_block: str, use_color: bool) -> str:
    """Render paragraph diff with precise inline highlighting when possible.

    Falls back to the original unified diff block if parsing is not possible.
    """
    lines = unified_block.splitlines()
    removed = [ln[1:] for ln in lines if ln.startswith("-") and not ln.startswith("---")]
    added = [ln[1:] for ln in lines if ln.startswith("+") and not ln.startswith("+++")]
    if len(removed) == 1 and len(added) == 1:
        old_h, new_h = highlight_inline_word_diff(removed[0], added[0], use_color)
        return (
            f"¶{pid}\n"
            f"  before: {old_h}\n"
            f"  after : {new_h}"
        )
    return "\n".join(lines)


def slug_matches_filters(
    slug: str,
    discourse_set: set[str] | None,
    discourse_regex: re.Pattern[str] | None,
) -> bool:
    if discourse_set is not None and slug not in discourse_set:
        return False
    if discourse_regex is not None and not discourse_regex.search(slug):
        return False
    return True


def resolve_commit_to_rev_range(commitish: str) -> str:
    res = subprocess.run(
        ["git", "rev-parse", "--verify", f"{commitish}^{{commit}}"],
        cwd=REPO_ROOT,
        capture_output=True,
        text=True,
        check=False,
    )
    if res.returncode != 0:
        raise SystemExit(
            f"detect-rerecord-impact: not a valid commit: {commitish!r}\n"
            f"{res.stderr.strip()}"
        )
    sha = res.stdout.strip()
    return f"{sha}^..{sha}"


def diff_hint_command(rev_range: str, slug: str) -> str:
    parts = [
        sys.executable,
        str(REPO_ROOT / "scripts" / "detect-rerecord-impact.py"),
        "--rev-range",
        rev_range,
        "--discourse",
        slug,
        "--show-diff",
    ]
    return shlex.join(parts)


def impact_to_json_dict(x: SlugImpact) -> dict:
    return {
        "slug": x.slug,
        "severity": x.severity,
        "recommendation": x.recommendation,
        "changedParagraphs": x.changed_paragraphs,
        "reasonFlags": x.reason_flags,
        "manifestChangedCount": x.manifest_changed_count,
        "ttsChangedCount": x.tts_changed_count,
        "displayChangedCount": x.display_changed_count,
        "manifestDiffs": [{"paragraphId": pid, "unifiedDiff": diff} for pid, diff in x.manifest_diffs],
    }


def pretty_print(
    impacts: list[SlugImpact],
    rev_range: str,
    *,
    inline_diff_threshold: int = 2,
    color_mode: str = "auto",
) -> None:
    use_color = color_enabled(color_mode)
    print(f"Re-record impact (revision range: {rev_range})")
    if not impacts:
        print("No recorded discourse changes detected.")
        return
    for item in impacts:
        print(f"\n{item.slug}  [{item.severity}]")
        print(f"  {item.recommendation}")
        print(f"  Changed paragraphs: {format_ranges(item.changed_paragraphs)}")
        print(f"  Reasons: {', '.join(item.reason_flags) if item.reason_flags else '—'}")

        if item.manifest_diffs:
            print("  Manifest text (listener-visible) diff:")
            for i, (pid, block) in enumerate(item.manifest_diffs):
                if i:
                    print()
                rendered = render_precise_diff_block(pid, block, use_color)
                for line in rendered.rstrip().splitlines():
                    print(f"    {line}")
        elif (
            item.severity != "none"
            and len(item.changed_paragraphs) > inline_diff_threshold
        ):
            print(f"  To see per-paragraph diffs, run:")
            print(f"    {diff_hint_command(rev_range, item.slug)}")


def main() -> int:
    ap = argparse.ArgumentParser(
        description="Detect audio re-record impact from git changes to English discourse MDX.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  %(prog)s --commit abc1234
  %(prog)s --rev-range main..HEAD
  %(prog)s --rev-range HEAD --discourse mn26 --show-diff
  %(prog)s --discourse-regex 'iti4[0-9]' --rev-range HEAD^..HEAD
        """.strip(),
    )
    ap.add_argument(
        "--rev-range",
        default="HEAD^..HEAD",
        help="Git revision range for git diff (default: HEAD^..HEAD). "
        "Single revision (e.g. HEAD) diffs against the working tree.",
    )
    ap.add_argument(
        "--commit",
        metavar="SHA",
        help="Analyze exactly one commit (same as SHA^..SHA). Overrides --rev-range.",
    )
    ap.add_argument(
        "--discourse",
        "-d",
        action="append",
        dest="discourses",
        metavar="SLUG",
        help="Only these discourse slug(s). Repeat for multiple.",
    )
    ap.add_argument(
        "--discourse-regex",
        metavar="PATTERN",
        help="Only slugs matching this regular expression (Python re syntax).",
    )
    ap.add_argument(
        "--show-diff",
        action="store_true",
        help="Include unified diffs for every changed paragraph (manifest / listen-visible text).",
    )
    ap.add_argument(
        "--color",
        choices=["auto", "always", "never"],
        default="auto",
        help="Color mode for highlighted precise diffs in pretty output (default: auto).",
    )
    ap.add_argument(
        "--inline-diff-max-paragraphs",
        type=int,
        default=2,
        metavar="N",
        help="Show diffs inline in pretty output when at most N paragraphs changed (default: 2).",
    )
    ap.add_argument("--format", choices=["pretty", "json"], default="pretty")
    ap.add_argument("--output", help="Optional JSON output path.")
    args = ap.parse_args()

    if args.commit:
        rev_range = resolve_commit_to_rev_range(args.commit)
    else:
        rev_range = args.rev_range

    discourse_set: set[str] | None = (
        set(args.discourses) if args.discourses else None
    )
    discourse_rx: re.Pattern[str] | None = None
    if args.discourse_regex:
        try:
            discourse_rx = re.compile(args.discourse_regex)
        except re.error as e:
            raise SystemExit(f"detect-rerecord-impact: invalid --discourse-regex: {e}") from e

    recorded = load_recorded_slugs()
    files = changed_english_files(rev_range)
    if ".." in rev_range:
        base_rev, target_rev = rev_range.split("..", 1)
    else:
        base_rev, target_rev = rev_range, "WORKTREE"

    impacts: list[SlugImpact] = []
    for path in files:
        if not path.startswith(EN_PREFIX):
            continue
        slug = slug_from_path(path)
        if slug not in recorded:
            continue
        if not slug_matches_filters(slug, discourse_set, discourse_rx):
            continue
        old_raw = file_at_revision(base_rev, path)
        new_raw = file_at_revision(target_rev, path)
        if not old_raw and not new_raw:
            continue

        manifest_old = paragraph_texts(old_raw, "manifest")
        manifest_new = paragraph_texts(new_raw, "manifest")
        impact = classify(
            slug,
            manifest_old,
            manifest_new,
            paragraph_texts(old_raw, "tts"),
            paragraph_texts(new_raw, "tts"),
            paragraph_texts(old_raw, "display"),
            paragraph_texts(new_raw, "display"),
            heading_structure_changed=has_heading_structure_drift(old_raw, new_raw),
        )
        if impact.severity == "none":
            continue

        want_diffs = args.show_diff or (
            len(impact.changed_paragraphs) <= args.inline_diff_max_paragraphs
        )
        diffs: tuple[tuple[int, str], ...] = ()
        if want_diffs:
            diffs = tuple(
                compute_manifest_unified_diffs(
                    manifest_old,
                    manifest_new,
                    impact.changed_paragraphs,
                )
            )
        impacts.append(
            SlugImpact(
                slug=impact.slug,
                severity=impact.severity,
                recommendation=impact.recommendation,
                changed_paragraphs=impact.changed_paragraphs,
                reason_flags=impact.reason_flags,
                manifest_changed_count=impact.manifest_changed_count,
                tts_changed_count=impact.tts_changed_count,
                display_changed_count=impact.display_changed_count,
                manifest_diffs=diffs,
            )
        )

    impacts.sort(key=lambda x: x.slug)
    if args.format == "pretty":
        pretty_print(
            impacts,
            rev_range,
            inline_diff_threshold=args.inline_diff_max_paragraphs,
            color_mode=args.color,
        )
    else:
        print(json.dumps([impact_to_json_dict(x) for x in impacts], indent=2, ensure_ascii=False))

    if args.output:
        out = Path(args.output)
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(
            json.dumps([impact_to_json_dict(x) for x in impacts], indent=2, ensure_ascii=False),
            encoding="utf-8",
        )
    return 0


def has_heading_structure_drift(old_raw: str, new_raw: str) -> bool:
    old_body = strip_frontmatter(old_raw)
    new_body = strip_frontmatter(new_raw)
    old_h = extract_paragraph_chunks_heading_style(old_body)
    new_h = extract_paragraph_chunks_heading_style(new_body)
    old_mode = bool(old_h)
    new_mode = bool(new_h)
    if old_mode != new_mode:
        return True
    if old_mode and new_mode and len(old_h) != len(new_h):
        return True
    return False


if __name__ == "__main__":
    raise SystemExit(main())

