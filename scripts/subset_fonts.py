#!/usr/bin/env python3
"""
Split the body fonts into a small "core" file (Latin + Pāli + punctuation)
and an "ext" file holding every other glyph, for `unicode-range` loading in
src/styles/global.css. Browsers fetch the ext file only when a page uses one
of its characters, so nothing the original fonts could render is lost.

Sources stay in public/assets/fonts (the TTFs are also read by
src/utils/generate-og-image.mjs). Hinting is kept so Windows rendering does
not change.

Usage:
  pip install fonttools brotli
  python3 scripts/subset_fonts.py        # writes *-core.woff2 / *-ext.woff2, prints ranges
"""

from pathlib import Path

from fontTools import subset
from fontTools.ttLib import TTFont

FONTS = Path(__file__).resolve().parent.parent / "public" / "assets" / "fonts"

# Latin, Latin-1, Latin Extended-A/B, spacing modifiers, combining marks, the
# Pāli/Sanskrit dot letters from Latin Extended Additional, general
# punctuation, and the arrows/math signs that appear in content and UI.
CORE = [
    (0x0000, 0x024F),
    (0x02B9, 0x02DD),
    (0x0300, 0x036F),
    (0x1E0C, 0x1E0D),
    (0x1E24, 0x1E25),
    (0x1E36, 0x1E39),
    (0x1E40, 0x1E47),
    (0x1E5A, 0x1E5D),
    (0x1E62, 0x1E63),
    (0x1E6C, 0x1E6D),
    (0x1E8E, 0x1E8F),
    (0x1E92, 0x1E93),
    (0x2000, 0x206F),
    (0x20AC, 0x20AC),
    (0x2122, 0x2122),
    (0x2190, 0x2199),
    (0x2212, 0x2212),
    (0x2215, 0x2215),
    (0x221A, 0x221A),
    (0x2248, 0x2248),
    (0x2260, 0x2260),
    (0x2264, 0x2265),
    (0x2713, 0x2713),
    (0xFEFF, 0xFEFF),
    (0xFFFD, 0xFFFD),
]

# Spectral has no ṁ/Ṁ glyphs; global.css routes those to Gentium Plus.
SPECTRAL_EXCLUDE = {0x1E40, 0x1E41}

JOBS = [
    ("Spectral-Regular.woff2", "Spectral-Regular", SPECTRAL_EXCLUDE),
    ("Spectral-Italic.woff2", "Spectral-Italic", SPECTRAL_EXCLUDE),
    ("Spectral-Bold.woff2", "Spectral-Bold", SPECTRAL_EXCLUDE),
    ("GentiumPlus-Regular.ttf", "GentiumPlus-Regular", set()),
]


def expand(ranges):
    return {cp for lo, hi in ranges for cp in range(lo, hi + 1)}


def to_ranges(codepoints):
    out = []
    for cp in sorted(codepoints):
        if out and cp == out[-1][1] + 1:
            out[-1][1] = cp
        else:
            out.append([cp, cp])
    return ", ".join(
        f"U+{lo:04X}" if lo == hi else f"U+{lo:04X}-{hi:04X}" for lo, hi in out
    )


def write_subset(src: Path, dest: Path, codepoints):
    options = subset.Options()
    options.flavor = "woff2"
    options.layout_features = ["*"]
    options.name_IDs = ["*"]
    options.notdef_outline = True
    font = TTFont(src)
    subsetter = subset.Subsetter(options)
    subsetter.populate(unicodes=codepoints)
    subsetter.subset(font)
    font.flavor = "woff2"
    font.save(dest)


def main():
    core_wanted = expand(CORE)
    for src_name, stem, exclude in JOBS:
        src = FONTS / src_name
        cmap = set(TTFont(src).getBestCmap())
        core = (cmap & core_wanted) - exclude
        ext = cmap - core_wanted - exclude
        write_subset(src, FONTS / f"{stem}-core.woff2", core)
        write_subset(src, FONTS / f"{stem}-ext.woff2", ext)
        print(f"{stem}-core.woff2  {(FONTS / f'{stem}-core.woff2').stat().st_size:>7} B")
        print(f"  unicode-range: {to_ranges(core)};")
        print(f"{stem}-ext.woff2   {(FONTS / f'{stem}-ext.woff2').stat().st_size:>7} B")
        print(f"  unicode-range: {to_ranges(ext)};")


if __name__ == "__main__":
    main()
