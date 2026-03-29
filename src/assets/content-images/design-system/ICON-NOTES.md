# Design-system icons — implementation notes

Companion to **`DESIGN-LANGUAGE.md`** and **`icons-extraction-status.md`**. Canonical vector assets live as **flat files** under **`design-system/icons/<id>.svg`**; metadata is in **`buildIconsManifest.ts`** → **`icons-manifest.json`**.

## Coverage (reference — how motifs map to discourses)

- **MN 1 (`mn1.svg`)**: sense modalities; puthujjana vs awakened **panel header** icons; four **elements**; **beings / deities / creator / brahmā**; four **form-sphere** types; four **formless** bases; **oneness / diversity / all**. **Nibbāna** has no icon in the source (text-only, gold), so nothing to add as a standalone icon.
- **MN 2 (`mn2.svg`)**: opening **tangle / clear**; **broken chain** (reused for fetters); **eye + vertical gates** (restraint); **bowl + robe**; **person + stress lines** (enduring); **fork + danger/safe nodes** (avoiding); **flame / thorn vine / impact star** (three unwholesome thoughts); **seven dots** (awakening factors); footer **lotus** (decorative in header, not a shipped icon); **chevron / down-arrow** connectors.
- **MN 118**: **elbow bracket** path; **number badge** recipe (see below).

## Number badges (r = 10)

### Recommended (grid recipe)

- Circle: `r="10"`, stroke ~`0.8`, opacity ~`0.7`.
- Label: `text-anchor="middle"` `dominant-baseline="central"` at **(cx, cy)**.
- **Single digits 1–9**: `font-size="11"` (Georgia bold).
- **Two digits 10–16**: `font-size="10.5"` so the pair fits without touching the ring.

This avoids per-glyph **y** nudging and tracks consistently across viewers.

### MN 118 idiosyncrasies (legacy, for matching old files)

`mn118.svg` uses **r = 11** in the main list and sets **y = cy + (2…4)** instead of `dominant-baseline`, so digits look vertically centered by hand. Examples: `cy="524"` → `y="527"` (+3); `cy="636"` → `y="638"` (+2).

**Two-digit quirks:** for **13, 14, 15** the file uses a `1` plus a second digit in `<tspan dy="-1">` to pull the second numeral slightly up for balance.

If you edit existing MN 118–style diagrams, either keep that manual style for pixel parity or normalize new work to the **dominant-baseline** recipe above.

### MN 1 eight-level section

`mn1.svg` mixes **r = 12** (levels 1–2) and **r = 10** (sub-levels 3–6) with similar manual **y** offsets — same story: optical tuning vs. central baseline.

## Elbow bracket

Source geometry is a tall path (~84 units high). A compact symbol may use `viewBox="-2 -2 26 90"` so the stroke stays inside the box. When inlining in a diagram, set **width** and **height** so **height/width ≈ 90/26** to avoid skewing.

## Scalability: many icons

**Per-file SVGs + manifest** is the supported workflow: small units, **`icons-manifest.json`** for tools, and **`/design-system`** for human browse/search.

**Practical cap:** keep any **single** reference or header SVG comfortable to edit in your viewer (often under ~1–2 MB); split or generate indices if a file grows unwieldy.

## Per-icon files + manifest (current workflow)

1. **`design-system/icons/{id}.svg`** — hand-authored or copied from a discourse header; filename stem = manifest `id`.
2. **`buildIconsManifest.ts`** — writes **`icons-manifest.json`** (edit the `icons` array when adding assets).
3. **`validateIconManifest.ts`** — ensures every manifest row points to an existing file and counts stay consistent.
4. **`generateIconsIndex.ts`** — writes **`icons-index.md`** for LLM / quick reference.
5. **`normalizeDesignSystemIcons.ts`** — optional fit to **`viewBox="0 0 24 24"`** (or `--canvas`); run per-file or **`npm run refresh:design-icons`** for all under `icons/*.svg`.

**Geometry:** If strokes clip, expand **`viewBox`** or adjust paths in the **standalone** file, then re-run normalize if you use it.

**Renames (MN 2):** `clear` → **`wise-attention`**; `tangle` → **`tangle-unwise-attention`**.

**Browser:** route **`/design-system`** (page: `src/pages/design-system/index.astro`; legacy `/design-system/icons` redirects) — Fuse search + facets; `noindex`.

**Roadmap / resume:** see **`icons-extraction-status.md`** (MN `*.svg` coverage, planned slugs, checklist).

## Discourse coverage vs. 26 header SVGs

Header illustrations live as top-level `*.svg` under `content-images/` (26 discourse graphics). The manifest’s **`sourceGraphic`** field ties an icon to one of those files.

**Currently represented in `icons-manifest.json` (sample):** `mn1.svg`, `mn2.svg`, `mn118.svg`, `an10.1.svg`, `an7.61.svg`, `sn36.6.svg`, plus shared **`ui/`** chevrons used in multiple layouts.

**Not yet decomposed into standalone icon files:** the remaining header SVGs (e.g. `mn3.svg` … `an11.2.svg` except those above). Add new rows to `buildIconsManifest.ts` and new files under `icons/` as you extract motifs—then run `validate:icons`.
