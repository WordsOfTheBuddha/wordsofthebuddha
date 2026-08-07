# MN 43 Mahāvedalla Sutta — SVG (implementation spec)

This document matches **[src/assets/content-images/mn43.svg](src/assets/content-images/mn43.svg)** as implemented. Use it as the authoring/review prompt for maintenance or further edits.

Supersedes the v1 diagram (`.plan/mn43.svg.bak`), which carried narrative framing, systematic mis-alignment, and text-dense prose where structure should do the work.

---

## Canvas & global style

| Item | Value |
|------|--------|
| `viewBox` / dimensions | `0 0 920 4250` |
| Font | Georgia / Times New Roman, serif |
| Background | `linearGradient` **bg** — `#0b1528` → `#0e1a30` → `#101e36` |
| Decorative ellipses | Warm/teal blobs at ~y 140, 1400, 2560, 3900 |
| Footer | `y = 4200` — rule, link, lotus motif |

### `defs` inventory

- **Card gradients:** `cardNeutral`, `cardTrue`, `cardFalse`, `cardGold`, `cardApex`
- **Realm bar fills:** `realmKama`, `realmRupa`, `realmArupa`
- **Glows:** `lampGlow`, `libGlow`
- **Rules:** `tierGrad` (section headers)
- **Filters:** `glow1`, `glow2`, `iconGlow`, `shadowDrop`

---

## Layout system

- **Content rail:** every section card group is `translate(70, Y)` with inner width **780** and inner centre **390** (absolute centre **460**). No exceptions.
- **Two-column split:** cards `x=0 w=375` and `x=405 w=375`; gutter centre **390** (absolute **460**) — gold spine, comparison tables, lamp centrepiece.
- **Three-column row:** cards **244** wide, **24** gap, centres at local **122 / 390 / 658**.
- **Section header block:** `tierGrad` rule at local `y=0`, gold caps label at `y=24`, italic subtitle at `y=42`, first content at `y=60`.
- **Icons never share a baseline with the text they annotate** — gutter-left, centred above label stack, or in a dedicated row.
- **Transform-first:** named `<g transform="translate(…)">` built from `(0, 0)`; section Y offsets are cumulative.
- **Unicode only:** literal Pali diacritics, `“…”` / `‘…’` typographic quotes, `·` separators, `→`/`⇄` arrows. No numeric entities or backslash escapes.
- Pali verified against `src/content/pli/mn/mn43.md`.

### Substance only — no narrative framing

Dropped from v1: evening-approach opening card, “eleven lines of inquiry” meta-caption, `sādhāvuso` assent, closing “Mahākoṭṭhita was delighted” attribution. The header carries only title, subtitle, and a one-line thesis about the Q&A clarifying subtle teachings — not the frame story.

---

## Section map (Y positions)

All Y values are the root `transform` on each `<g id="section-…">` (or standalone pivot/footer).

| # | `id` | Y | Band height (approx.) |
|---|------|---|------------------------|
| — | `header` | `0` | 160 |
| 1 | `section-wisdom` | `184` | 238 |
| 2 | `section-named-by-function` | `456` | 344 |
| — | `wisdom-distinction` | `855` | 70 *(quote pivot — not a section)* |
| 3 | `section-purified-mind` | `980` | 362 |
| 4 | `section-right-view` | `1380` | 276 |
| 5 | `section-existence` | `1690` | 374 |
| 6 | `section-first-jhana` | `2102` | 290 |
| 7 | `section-five-faculties` | `2406` | 426 |
| 8 | `section-vital-formations` | `2886` | 440 |
| 9 | `section-release` | `3360` | 834 |
| — | `footer` | `4200` | 50 |

Nine teaching bands plus header/footer. The wisdom-distinction quote sits in the gap between bands 2 and 3.

---

## Band-by-band structure

### Header (`y = 0`)

- Title `MN 43 — MAHĀVEDALLA SUTTA`, subtitle, rule, two-line italic tagline (Q&A between Sāriputta and Mahākoṭṭhita clarifying subtle teachings).

### 1 · Wisdom · paññā (`y = 184`)

- **Split panel** at `translate(70, 60)`: `duppañño` (left, `cardFalse`) vs `paññavā` (right, `cardTrue`), each **375×178**.
- Gold spine at local `x = 390`; inline quartered disc on spine (not the `four-noble-truths` wheel icon).
- Four noble truths as **aligned rows** on both sides — ✕ vs ✓, English left, Pali right-aligned.

### 2 · Named by what they do (`y = 456`)

- **Three cards** (`244` each): viññāṇa · vedanā · saññā — icon, verb → name → objects.
- **Valence-tinted circles** in viññāṇa and vedanā cards (shared treatment):
  - pleasant · sukha — fill `#60a088` @ 0.14, stroke `#60a088`
  - painful · dukkha — fill `#a06070` @ 0.14, stroke `#a06070`
  - neither · adukkhamasukha — fill none, stroke `#8898b0`
- **Perception card:** four colour dots (nīla · pīta · lohita · odāta) via `perception-colors` motif.
- **Association strip** at `translate(70, 286)`: centred **780×58** card — `yaṁ vedeti taṁ sañjānāti…`

### Wisdom distinction pivot (`y = 855`)

- **Quote-only** — not a card. Horizontal rules, centred italic English + Pali:
  - *Wisdom is to be cultivated, and consciousness is to be completely comprehended*
  - `paññā bhāvetabbā, viññāṇaṁ pariññeyyaṁ`
- Bridges band 2 (association) and band 3 (purified mind-consciousness).

### 3 · Purified mind-consciousness (`y = 980`)

- **Formless bases row** — single **780×150** card; three columns at local **130 / 390 / 650**: space · consciousness · nothingness (`space-base`, `consciousness-base`, `nothingness-base` motifs). `neither-base` excluded — sutta names only three here.
- **Eye-of-wisdom card** at `translate(70, 226)` — **780×136**: `knowledge-vision` icon left-aligned beside quote; rule; **three purpose pills** (`abhiññatthā` · `pariññatthā` · `pahānatthā`).

### 4 · Right view · sammādiṭṭhi (`y = 1380`)

- **Three aligned flow cards** at `translate(70, 60)`, shared top edge, **118** tall:
  1. **Conditions** `250×118` — `heard` (parato ghoso) + `wise-attention` (yoniso manasikāro)
  2. **Right view node** `200×118` — `cardGold`, inline gold cross sparkle
  3. **Fruits** `250×118` — `defilements-ended` icon left of two fruit lines; release of mind · cetovimutti; liberation by wisdom · paññāvimutti
- Gold arrows between cards; down-arrow to supports rail.
- **Five supports rail** at `translate(70, 200)` — numbered **1–5**: sīla · suta · sākacchā · samatha · vipassanā.

### 5 · Existence · bhava (`y = 1690`)

- **Three realm bars** in one **780×154** card — full-rail rows (icon · English · gloss · Pali), solid → dashed treatment for formless.
- **Renewed existence pair** at `translate(70, 232)`: occurs (`cardFalse`, `herd-rushing-in`) vs ceases (`cardTrue`, `broken-chain`); three aligned ingredient rows each side.

### 6 · First jhāna (`y = 2102`)

- Single **780×230** card, vertical rule at `x = 390`.
- `jhana-first` simile icon + opening quote across top.
- **Left:** five given up — hindrance icons (`flame-thought`, `thorn-vine`, `hindrance-dullness`, `simile-slavery`, `simile-dangerous-path`).
- **Right:** five present — gold dot bullets (vitakka · vicāra · pīti · sukha · cittekaggatā).

### 7 · The five faculties (`y = 2406`)

- **Faculty fan** in **780×192** card — five organs converging on mind:
  - eye → **`seen`** (gold lens arcs)
  - ear → **`heard`**
  - nose → **`sense-nose`**
  - tongue → **`sense-tongue`**
  - body → **`body-observer`**
- Dashed fan lines into **`cognized`** mind recourse pill (`mano paṭisaraṇaṁ`).
- **Do not use** `sense-eye` / `sense-ear` / `sense-body` / `sense-mind` — those were considered and rejected; the existing sense-family icons above read correctly at this scale.
- **Lamp simile card** at `translate(70, 268)` — **780×158**: `oil-lamp-flame-radiance` centrepiece; bidirectional cycle arrows; vitality (ābhā) left, body heat (acci) right; Pali caption below.

### 8 · Vital formations (`y = 2886`)

- **Top pair** at `translate(70, 60)`: “not things that can be felt” vs “when three things leave” (vitality · heat · consciousness pills).
- **Death vs cessation table** at `translate(70, 200)` — **780×240**:
  - Three shared rows (constructs ended and settled).
  - Three diverging rows in tinted sub-cards (vitality · heat · faculties).
  - Footer: *alike in their constructs; unalike in vitality, heat, and faculties*.

### 9 · Release of the mind (`y = 3360`)

- **Top pair** at `translate(70, 60)`:
  - Left: neither-painful-nor-pleasant release → fourth jhāna (`jhana-fourth` orb motif).
  - Right: **signless release** — **two-column centred block** (bold labels at `x ≈ 78`: to attain / to persist / to emerge; descriptions at `x = 145`).
- **Four releases row** at `translate(70, 232)` — **780×160**: `four-immeasurables` · `nothingness-base` · `emptiness-void` · `signless-stillness`; each visually distinct (petals · dashed ring · solid ring + dotted core · struck-through diamond).
- **Correspondence card** at `translate(70, 412)` — rāga-dosa-moha → boundless / nothingness / signless release (arrow rows).
- **Apex** at `translate(0, 614)`: abandoned triad (`greed`, `thorn-vine`/aversion, `delusion`) feeding `akuppā cetovimutti` card; **`liberation-sparkle` mirrored at ±228** from centre so the title sits on the true midline.

---

## Icons

### Reused (append `"mn43"` to `discourse` in `buildIconsManifest.ts`)

`seen`, `heard`, `body-observer`, `cognized`, `sense-nose`, `sense-tongue`, `feeling-droplet`, `perception-colors`, `space-base`, `consciousness-base`, `nothingness-base`, `knowledge-vision`, `wise-attention`, `defilements-ended`, `herd-rushing-in`, `broken-chain`, `jhana-first`, `jhana-fourth`, `flame-thought`, `thorn-vine`, `hindrance-dullness`, `simile-slavery`, `simile-dangerous-path`, `emptiness-void`, `nothingness-base`, `greed`, `delusion`, `liberation-sparkle`, `four-noble-truths` *(band topic; spine uses inline disc, not the wheel icon)*, `cessation-vessel` *(death/cessation band)*.

`liberation-sparkle` is mirrored at the apex (±228 from card centre) so `akuppā cetovimutti` stays centred.

### MN 43–only icon files (`design-system/icons/`)

| id | Motif | Used in |
|----|-------|---------|
| `oil-lamp-flame-radiance` | Lamp bowl, wick flame, radiance halo | Band 7 centrepiece |
| `perception-colors` | Four dots — nīla · pīta · lohita · odāta | Band 2 saññā card |
| `three-realms-existence` | Three stacked bands, solid → dashed | Band 5 *(library composite; diagram uses per-realm inline bars)* |
| `four-immeasurables` | Four-petal radiating disc | Band 9 releases row |
| `signless-stillness` | Ring with inner sign struck through | Band 9 releases row |

Four release icons must read at a glance: `four-immeasurables` petals, `nothingness-base` dashed ring, `emptiness-void` solid ring + faint dotted core, `signless-stillness` struck-through diamond. A plain unmarked ring duplicates `emptiness-void` and was rejected.

**Not added:** `sense-eye` / `sense-ear` / `sense-body` / `sense-mind` (use existing sense icons above); “senseless log” (one-off inline only).

### Manifest maintenance

1. New icons live under `src/assets/content-images/design-system/icons/`.
2. Edit `src/utils/buildIconsManifest.ts`: five MN43-only entries; append `"mn43"` to reused entries listed above.
3. Regenerate: `npm run gen:icons-manifest` → `npm run validate:icons` → `npm run gen:icons-index`.

`validate:icons` checks that every `discourse` slug references an existing MDX file and that icon SVG files exist on disk.

---

## Verification

1. **Render headless:**  
   `node scripts/render-content-image.mjs src/assets/content-images/mn43.svg .plan/render`  
   Produces PNG slices and reports any `<text>` node outside the 4…916 horizontal rail.
2. **Inspect band by band** for overlapping strokes, clipped text, off-centre icons.
3. **No escapes:** `rg '&#|\\\\u' src/assets/content-images/mn43.svg` returns nothing.
4. **Pali grep:** every Pali string against `src/content/pli/mn/mn43.md`. Quoted phrases verbatim; standalone glosses may use stems (`rāga`, `sīla`), but nominatives from the sutta are used where supplied (`parato ghoso`, `yoniso manasikāro`, `pamāṇakaraṇo` / `kiñcano` / `nimittakaraṇo`).
5. **Icons:** `npm run validate:icons` passes.
6. **Collision regression:** pairwise bounding-box check over `<text>` nodes — no overlaps (guards against v1 drift/collision failures).

---

## Scope boundaries

- No content changes to `mn43.mdx` or Pali `mn43.md` unless correcting quote marks found during diagram work.
- `mn148.svg` is read-only reference material (nose/tongue icon origin).
- `neither-base` stays excluded from band 3 — text names only three formless bases.
