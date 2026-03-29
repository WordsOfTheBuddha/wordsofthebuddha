# Content images — design language (published SVGs)

Reference for new diagrams so they match **suttas-basics** discourse header illustrations. Derived from the 26 SVGs in `src/assets/content-images/`.

## Canvas and layout

| Token | Typical value | Notes |
|--------|----------------|--------|
| **Artboard width** | **920** | Every published SVG uses `viewBox="0 0 920 …"`; height varies with content. |
| **Horizontal margins** | ~40–60 px from edges | Title blocks and panels align to a soft 920-wide grid. |
| **Section rails** | `x=100` to `x=820` | Tier lines, gradients, and many dividers span this inner width. |
| **Panel corner radius** | **8** or **10** (sometimes **9** on stepped cards) | `rx` on rounded rectangles. |
| **Gold vertical spine** | `x=460` | Center axis for split panels (`stroke="#c8a040"`, low opacity). |

Heights observed: **850** (compact) through **2300** (long scroll diagrams). There is no fixed height—content drives it.

## Typography

All diagram text uses **Georgia** with **Times New Roman** fallback:

```text
font-family="Georgia,'Times New Roman',serif"
```

| Role | Approx. size | Weight / style |
|------|----------------|----------------|
| Sutta id + title | **22** | bold, letter-spacing ~2–3 |
| Subtitle / section | **14–16** | mixed; italic for Pali gloss lines |
| Section label (caps) | **12–14** | bold, gold `#c8a040` or muted slate |
| Body / list English | **12–15** | regular or bold |
| Pali | **10–13** | italic, one step more muted than English |
| Small captions | **10–11** | italic, opacity often 0.75–0.9 |

**Alignment:** Title blocks are usually `text-anchor="middle"` at `x=460`. List rows often use a **numbered circle** at a fixed `cx` and body text indented to the right.

## Color roles (semantic)

These recur across files; exact hex drifts slightly per piece.

| Role | Example hex | Usage |
|------|-------------|--------|
| **Page background (top)** | `#0b1528` → `#101e36` | Vertical `linearGradient` `id="bg"` (stops vary). |
| **Accent / structure** | `#c8a040` | Tier labels, spines, highlights, “liberation” thread. |
| **Cool ink (primary text)** | `#a0b0c8`, `#c8d8e8` | English headings on dark panels. |
| **Secondary ink** | `#708090`, `#8898b0` | Subtitles, Pali, de-emphasized lines. |
| **Harm / tension** | `#a06070`, burgundy strokes | Unwise attention, painful/samsaric motifs. |
| **Harmony / release** | `#60a088`, `#80c0a0` | Wise attention, wholesome flows. |
| **Neutral structure** | `#7888a0`, `#6888a0` | Icons, connectors, inactive modalities. |
| **Liberation glow** | `#ffd700`, `#daa520` | Radial gradients, sparkles, apex glows (often low opacity). |

**Graduated step panels:** Many AN diagrams use **`stg1`…`stg9`** (or similar): diagonal linear gradients shifting **steel blue → olive → gold** as steps approach liberation.

## Line and stroke

| Use | stroke-width | Notes |
|-----|----------------|--------|
| Hairline dividers, title rules | **0.5–0.6** | Often with `stroke-opacity` 0.25–0.45. |
| Icon outlines, connectors | **0.8–1.2** | `stroke-linecap="round"` / `stroke-linejoin="round"` on organic icons. |
| Emphasis, panel borders | **0.8–1.2** | Panel strokes use semi-transparent brand colors. |
| Sparkles / rays | **0.7–1.2** | Gold `#ffd700` family. |

Decorative **tier lines** often use `stroke="url(#tierGrad)"`: horizontal gold fade (bright in the middle, transparent at ends).

## Effects (defs)

Reused ids across files:

| id | Purpose |
|----|---------|
| **`glow1`**, **`glow2`**, **`glow3`** | Gaussian blur merge; stdDev **3**, **6**, **14** — hierarchy of halos. |
| **`iconGlow`** | Lighter blur (**stdDeviation 2**) for small line icons. |
| **`shadowDrop`** | `feDropShadow` dy=2, stdDev≈4, dark flood ~0.4–0.5 opacity. |
| **`warmHaze`** / **`fogHaze`** | Large blur (~18) for atmospheric panels. |

Icons are frequently drawn at **opacity 0.45–0.65** with **`filter="url(#iconGlow)"`**.

## Structural patterns

1. **Title stack:** Background rect → centered title → subtitle → optional decorative line (`y≈78`, width ~280–640).
2. **Tier band:** `tierGrad` line + small caps label + optional Pali line.
3. **Split panels:** Two `rect` regions (left/right) with contrasting fills (`patternLeft` / `patternRight` or `cellLeft` / `cellRight`) and a **gold vertical** between them.
4. **Numbered lists:** Circle `r≈10–11`, stroke ~0.8–1, digit centered; optional **connector path** (orthogonal + rounded “elbow”) to annotation text.
5. **Ladder / path diagrams (AN 10.x):** Stacked rounded rects with `stgN` fills, small **glow dot** beside step, optional **sparkle trail** to a **radial `libGlow`** apex.

## Icon assets (standalone files)

Line-art motifs ship as **individual SVGs** under **`design-system/icons/`** (flat names, e.g. `mn1-seen.svg`), indexed by **`icons-manifest.json`**. For **badge geometry**, **elbow bracket** placement, **MN 118 / MN 1** manual y-offset habits, and **scalability** notes, see **`ICON-NOTES.md`**.

Discourse **header** illustrations remain separate top-level **`*.svg`** files (e.g. `mn118.svg`); copy or adapt paths from those into new `icons/<id>.svg` files when adding motifs.

## Searchable icon library (per-file SVGs + manifest)

For **LLM-friendly lookup** and maintenance, canonical assets live under **`design-system/icons/`** as **flat** files named by manifest id (e.g. `icons/mn1-seen.svg`). See `icons-manifest.json` and the design-system icons page for discourse, category, tags, and optional **themes**.

| Artifact | Purpose |
|----------|---------|
| **`icons-manifest.json`** | Machine-readable index: `id`, `title`, `description`, `discourse`, `sourceGraphic` (header SVG basename), `category`, `tags`, `svg` path |
| **`icons-index.md`** | Flat table (run `npm run gen:icons-index`) for paste-into-chat search |
| **`/design-system`** | Browser UI: search (Fuse.js) + facets (discourse, category, tag); `noindex` (legacy **`/design-system/icons`** redirects here) |

**Scripts** (see root `package.json`): `gen:icons-manifest` (writes manifest from `buildIconsManifest.ts`), `validate:icons`, `gen:icons-index`, `normalize:design-icons` / `refresh:design-icons` (optional fit to a shared canvas via `normalizeDesignSystemIcons.ts`).

**Schema:** `icons-manifest.schema.json` describes the manifest shape for validators and editors.

**Layout:** Icons have **different aspect ratios**; embed them in a **fixed-size box** with `object-fit: contain` (or equivalent) so strokes are never cropped. See **`icons-extraction-status.md`** for policy, per–discourse status, and **how to run `/design-system`** in dev.

## Source files analyzed

26 SVGs: `mn1`, `mn2`, `mn3`, `mn4`, `mn5`, `mn20`, `mn24`, `mn29`, `mn30`, `mn53`, `mn107`, `mn113`, `mn118`, `mn148`, `sn36.6`, `an5.26`, `an7.61`, `an7.65`, `an10.1`, `an10.2`, `an10.51`, `an10.61`, `an10.61-vijjavimutti`, `an10.76`, `an11.1`, `an11.2`.
