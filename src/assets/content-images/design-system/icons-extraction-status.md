# Design-system icons — extraction status

This file tracks **which discourse header SVGs** (`src/assets/content-images/mn*.svg`, AN/SN, etc.) have motifs represented as **standalone files** in `design-system/icons/`, and gives a **resume checklist** for the next passes. Regenerate or edit it as work proceeds.

## Conventions (current)

| Topic | Policy |
|--------|--------|
| **Source of truth** | **`design-system/icons/<id>.svg`** (flat filenames matching manifest `id`) plus **`buildIconsManifest.ts`** for metadata. There is **no** monolithic catalog SVG; new motifs are copied or drawn into `icons/` (often from a discourse header SVG) and registered in the manifest. |
| **Stroke bleed / tight geometry** | Hand-author `viewBox` so all strokes fit (including negative coordinates). Optionally run **`npm run normalize:design-icons`** on specific files or **`npm run refresh:design-icons`** to normalize **all** icons under `icons/*.svg` to a shared canvas (see `normalizeDesignSystemIcons.ts`). |
| **Manifest** | `buildIconsManifest.ts` + `npm run gen:icons-manifest`; validate with `npm run validate:icons`. |
| **Canonical slot (optional)** | `normalizeDesignSystemIcons.ts` rewrites SVGs to **`viewBox="0 0 24 24"`** (default) with uniform scale + center (**resvg** `getBBox()`). Use after adding or heavily editing standalone files when you want a shared grid size. |
| **Flat filenames** | **`icons/<id>.svg`** where `<id>` matches manifest id (e.g. `mn1-seen.svg`, `shared-postures-four.svg`). |
| **Refresh vs. single-file** | **`npm run refresh:design-icons`** runs normalize on **`icons/*.svg`**. For one-off work: `npx tsx src/utils/normalizeDesignSystemIcons.ts --files icons/foo.svg` (paths relative to `design-system/`). |

## Testing the icon browser (facets + search)

1. From the repo root: **`npm run dev`** (or `yarn dev`). This starts Astro (default **http://localhost:4321**) plus watchers.
2. Open **`/design-system`** — e.g. [http://localhost:4321/design-system](http://localhost:4321/design-system). The page uses **Fuse.js** search and facets (discourse, category, tag, theme). It is marked **`noindex`** for internal review.
3. After changing **`icons-manifest.json`** via `gen:icons-manifest`, reload the page. The route imports the manifest at build/dev time.

## Predictable layout in UI

Icons have **different intrinsic aspect ratios** (`viewBox` width/height varies). For a uniform grid:

- Put each icon in a **fixed square or fixed-height box** (e.g. `w-12 h-12` or `aspect-square`) and use **`object-contain`** (or equivalent) so the artwork scales inside without cropping.
- Do **not** assume equal padding to the artboard edge—content is centered in its own `viewBox`, not in a global pixel grid.

## MN discourse graphics — status

| File | Sutta (header) | Standalone icons in manifest | Notes |
|------|------------------|------------------------------|--------|
| `mn1.svg` | Mūlapariyāya | Yes (full MN 1 set) | — |
| `mn2.svg` | Sabbāsava | Yes (methods + contrast; no decorative lotus icon) | Renamed: `wise-attention`, `tangle-unwise-attention` |
| `mn118.svg` | Ānāpānassati | Yes | Full tetrad + badges 1–16 (`number-badge-r10`, `number-badge-02`…`16`), elbow, body/feeling, mind + mental-qualities headers, six extra bojjhaṅga glyphs (investigation through equanimity; mindfulness uses `body-observer`) |
| `mn3.svg` | Dhammadāyāda | Partial | `bowl-overflow`, `bowl-empty`; more motifs can be added later |
| `mn4.svg` | Bhayabherava | Yes | `lunar-phases`, four postures (`posture-walking`, `posture-standing`, `posture-sitting`, `posture-lying`) |
| `mn5.svg` | Anaṅgaṇa | Yes | Four bowl similes + eight unwholesome-wish / requisite icons (`bowl-stained`, `bowl-polished`, `bowl-dusty-clean`, `bowl-gleaming`, `wish-*`) |
| `mn20.svg` | Vitakkasaṇṭhāna | Yes | `shared-postures-four` + four similes (`simile-carpenter-pegs`, `carcass-necklace`, `look-away`, `subdue-figures`) | Postures strip shared with MN119. |
| `mn24.svg` | Rathavinīta | No | Planned |
| `mn29.svg` | Mahāsīropama | No | Planned |
| `mn30.svg` | Cūḷasīropama | No | Planned |
| `mn53.svg` | Sekha | Yes | Five unique motifs + egg simile + past-lives eye; sense restraint / divine eye / liberation reuse `mn2-eye-shield`, `mn119-divine-eye`, `mn2-broken-chain` (extra manifest rows) |
| `mn107.svg` | Gaṇakamoggallāna | No | Planned |
| `mn113.svg` | Sappurisa | Yes | Ten conceit-column icons (worldly status ×5 + ascetic practices ×5; header Asappurisa/Sappurisa figures reuse MN1) |
| `mn148.svg` | Chachakka | Partial | Nose + tongue internal-base icons; **kāya** uses `mn118-body-observer` (discourse also lists mn148) |
| `mn119.svg` | Kāyagatāsati | Yes | `shared-postures-four` + `clear-awareness-fourfold` + steps 1–6 + jhānas + similes + chariot + divine eye + defilements ended (see `mn119-*` in manifest) | No separate MN119 single-posture exports; MN4 still has individual posture icons. |

### Other discourses (AN / SN) — partial index

| File | Notes |
|------|--------|
| `an7.61.svg` | `an7-wide-arc` |
| `an7.65.svg` | `an7-65-tree-barren`, `an7-65-tree-flourishing` (rukkhūpama) |
| `an10.1.svg` | `an10-liberation-sparkle` |
| `an10.51.svg` | `an10-51-head-on-fire` (footer flame simile) |
| `sn36.6.svg` | `sn36-branch-split`, `sn36-6-two-darts`, `sn36-6-one-dart` |

## Planned symbol naming (MN 3+)

When adding a new discourse batch, choose stable slugs that match the filename stem:

**`icons/{id}.svg`** with the same `{id}` in `buildIconsManifest.ts` (e.g. `mn3-dyad-left.svg`).

Record the **final chosen slugs** in this table when implemented:

| Planned slug (draft) | Discourse file | Meaning / location in diagram | Status |
|------------------------|----------------|----------------------------------|--------|
| *TBD after SVG audit* | `mn3.svg` | … | not started |
| … | `mn4.svg` | … | not started |

## Resume checklist

1. Pick next header `*.svg` from the table (or a new discourse graphic).
2. **Add or copy** motifs into **`design-system/icons/<id>.svg`** (correct `viewBox`; copy from the header SVG or draw fresh).
3. Optionally **`npm run normalize:design-icons -- --files icons/<id>.svg`** (or `refresh:design-icons` after batch edits).
4. Add rows to **`buildIconsManifest.ts`** and run **`npm run gen:icons-manifest`**, **`npm run validate:icons`**, **`npm run gen:icons-index`**.
5. Update the **MN discourse graphics** table above.
6. Smoke-test in the dev server: **`/design-system`**.

## Changelog (internal)

- **2025-03-25:** Deprecated **`line-art-library.svg`** and **`extractDesignSystemIcons.ts`**. Standalone **`icons/<id>.svg`** files are the only export target; **`refresh:design-icons`** is normalize-only. See **`ICON-NOTES.md`** for implementation notes.
- **2025-03-25 (AN/SN batch):** AN 7.65 tree pair, AN 10.51 head-on-fire, SN 36.6 two-darts / one-dart icons + manifest.
- **2025-03-25 (flat + MN20/53/148):** All standalone icons under **`icons/<id>.svg`**; MN53 Sekha + MN148 nose/tongue + MN20 similes; manifest `themes` + design-system icons page theme filter; `validate:icons` checks unique manifest paths vs file count; MN53 reuses MN2/MN119 assets via `SVG_OVERRIDES` in `buildIconsManifest.ts`.
- **2025-03-25 (refinements):** MN118 number badges aligned to header SVG typography; MN119/MN20 single asset `shared/postures-four`; MN119 clear awareness as fourfold grid; MN113 ten conceit-column icons; normalize scripts include MN113 + `icons/shared`.
- **2025-03-25:** Large MN 4–5, MN 118–119 batch: postures, four bowls, eight wish/requisite motifs, MN 118 step badges 2–16 + mind/dhamma headers + six bojjhaṅga glyphs; MN 119 postures, clear-awareness eye, impurities, elements, charnel, four jhāna similes, six cultivated/uncultivated similes, chariot wheel, divine eye, defilements ended.
- **2025-03:** MN 1–2 icons regenerated with padded viewBoxes; MN 2 renames (`wise-attention`, `tangle-unwise-attention`); decorative lotus not shipped as standalone icon.
