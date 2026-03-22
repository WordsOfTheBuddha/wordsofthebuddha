---
name: MN53 SVG Visualization
overview: "Implemented dark-mode SVG (920×1550) for MN53 Sekha Sutta — descending foundation steps, right-rail seven qualities panel, mn4-style nested jhānas, hen-and-egg bridge, three breakthroughs, closing verse. Conduct/vijjā via left/right micro-labels; no separate classification panel."
todos:
  - id: scaffold
    content: Create SVG scaffold with defs, background, and title block (Phase 1)
    status: completed
  - id: foundation-steps
    content: Build the four descending staircase foundation practice cards with icons, labeled CONDUCT (Phase 2)
    status: completed
  - id: seven-qualities
    content: Build the seven good qualities panel (Phase 3 — implemented as right column)
    status: completed
  - id: jhanas
    content: Build the four jhanas as nested rectangles (mn4-style), labeled CONDUCT (Phase 4)
    status: completed
  - id: egg-simile
    content: Build the egg simile central metaphor section (Phase 5)
    status: completed
  - id: breakthroughs
    content: Build the three breakthroughs panels with icons, labeled TRUE KNOWLEDGE (Phase 6)
    status: completed
  - id: conclusion-footer
    content: Build the conclusion verse and footer (Phase 7)
    status: completed
isProject: false
---

# MN 53 Sekha Sutta — SVG (final implementation spec)

This document matches **[src/assets/content-images/mn53.svg](src/assets/content-images/mn53.svg)** as implemented. Use it as the prompt/spec for maintenance or regeneration.

## Canvas & global style

| Item | Value |
|------|--------|
| `viewBox` / dimensions | `0 0 920 1550` |
| Font | Georgia / Times New Roman, serif |
| Background | `linearGradient` **bg** — `#0b1528` → `#101830` → `#121a28` |
| Decorative ellipses | Subtle teal / warm blobs at ~y 350, 1150, 1520 |
| Min body text | **10px** (breakthrough subtitles, bridge Pali, footer link **9.5px**) |

---

## `defs` inventory (as in file)

- **Gradients:** `bg`, `stg1`–`stg4` (staircase cards), `qualPanel` (seven qualities), `jhana1` (outer jhāna fill), `eggGlow`, `conclusionGlow`, `bk1`–`bk3` (breakthrough cards), `tierGrad` (horizontal rules).
- **Filters:** `glow1`, `glow2`, `shadowDrop`, `iconGlow`.

---

## Phase 1 — Header (y ≈ 0–120)

- **Title:** `MN 53 — SEKHA SUTTA` — 22px bold, `#a0b0c8`, letter-spacing 3.
- **Subtitle:** `Disciple in Training` — 15px italic, `#708090`.
- **Rule:** `y=74`, `#a09070` @ 0.3 opacity.
- **English tagline (14px italic, `#90a0b8`):**  
  `The path of a disciple in training to attain wholesomeness`
- **Pali tagline (13px italic, `#7888a0`):**  
  `Sekhā paṭipadā apuccaṇḍatā-samāpattiyā`  
  *(Differs from the stock sutta opening line; encodes the training + “wholesomeness” theme.)*

---

## Phase 2 — Foundation practices (descending staircase, y ≈ 130–580)

### Conduct label

- **Position:** `x=60`, `y=148` (not centered).
- **Text:** `CONDUCT · caraṇa` — 10px, `#c8a040` @ **0.45** opacity, letter-spacing 2.

### Continuity

- **Diagonal guide:** single line `(80,160)` → `(330,540)`, `#4a8898`, 1.5px, **opacity 0.07** (subtle; not the an10.2 dashed gradient).
- **Connectors:** cubic bezels between step bottoms and next step tops; additional paths from step 4 toward the seven-qualities panel `(530,540)` and toward the jhāna block.

### Card geometry

- **Width/height:** `360×82`, `rx=10`.
- **Positions:** `x` = 38, 78, 118, 158 (`+40` per step); `y` = 168, 278, 388, 498.
- **Numbered circles:** left side of each card, radius 11, labels 1–4.
- **Copy:** centered block per card — English title **15px bold**, Pali **13px italic**, gloss **11px** `#607888`.

### Step icons (implemented)

| Step | English | Pali | Icon |
|------|---------|------|------|
| 1 | Accomplishment in Virtue | sīlasampanno | **Precepts tablet** with lines + check mark (right side of card) |
| 2 | Guarding the Sense Doors | indriyesu guttadvāro | **Eye** + vertical “shield” lines (not a literal gate) |
| 3 | Moderation in Eating | bhojane mattaññū | **Bowl** (mn5-style rim + body + fill line) |
| 4 | Devotion to Wakefulness | jāgariyaṁ anuyutto | **Crescent** + three tick marks (three watches) |

---

## Phase 3 — Seven good qualities (implemented as **Step 5** right panel)

- **Not** a full-width 4+3 grid: a **single column** panel on the **right**, `x=530`, `y=320`, **350×260**, `qualPanel` fill, `rx=8`.
- **Bridge:** circle **“5”** at panel left (`554,346`) — ties visually to the staircase as “fifth” stage alongside steps 1–4.
- **Header:** centered in panel — `SEVEN GOOD QUALITIES` (11px bold gold) + `satta saddhammā` (10px italic, lower opacity).
- **List:** seven lines, **12px** English with parenthetical gloss where helpful + **11px italic** Pali in `tspan`:
  1. Confidence (Faith) · saddhā  
  2. Sense of right and wrong · hirī  
  3. Fear of wrongdoing · ottappa  
  4. Learned · bahussuta  
  5. Energy · āraddhavīriya  
  6. Mindfulness · sati  
  7. Wisdom · paññā  

---

## Phase 4 — Four jhānas — nested rectangles (y ≈ 600–970)

- **Tier rule:** `y=600`, `tierGrad`.
- **Title:** centered — `FOUR JHĀNAS · CATTĀRO JHĀNĀ` (12px bold gold).
- **Conduct tag:** **right-aligned** `x=830`, `y=619` — `CONDUCT · caraṇa` at **9px**, opacity **0.35** (mirrors breakthroughs section).
- **Layout:** [mn4.svg](src/assets/content-images/mn4.svg)-style nesting:
  - Outer: `70,634` — **780×336**, fill `jhana1`, stroke gold `#c8a040` @ 0.42.
  - Insets ~30px per side per level; inner strokes `#78a890` → `#aab8c8` → `#d0d8e0`.
- **Content:** full **mn4-style** phrasing — English lines with Pali in **parenthetical** `tspan` (`#486068`, 10px italic), including compounds like *vivicceva kāmehi*, *vitakkavicārānaṁ vūpasamā*, *pītiyā ca virāgā*, *upekkhāsatipārisuddhi*, etc. (more than one line per jhāna where needed).

---

## Phase 5 — Hen & egg simile (y ≈ 985–1120)

- **Glow:** `eggGlow` ellipse behind panel.
- **Panel:** `100,990` — **720×134**, dark fill, gold stroke.
- **Egg graphic:** left of center `translate(345,1020)` — ellipse + crack strokes.
- **Title:** `THE HEN & THE EGG` — `x=490` (offset from pure center due to egg art).
- **Quote:** two lines, 11px italic — hen incubates / chicks break through safely.
- **Bridge:** bold gold line + Pali **10px** italic:  
  `bhabbo abhinibbhidāya · bhabbo sambodhāya · anuttarassa yogakkhemassa adhigamāya`

---

## Phase 6 — Three breakthroughs (y ≈ 1130–1320)

- **Tier rule:** `y=1136`.
- **Title:** `THREE BREAKTHROUGHS · TISSO ABHINIBBHIDĀ` (12px bold gold).
- **Vijjā tag:** **right** `x=830` — `TRUE KNOWLEDGE · vijjā` (9px, opacity 0.35).
- **Cards:** three **260×130** rounded rects — fills `bk1`, `bk2`, `bk3`; positions `x=50`, `330`, `610`, `y=1174`.
- **Ordinals:** “1st / 2nd / 3rd breakthrough” with **superscript** `st`/`nd`/`rd` via `tspan` + `dy`.
- **Icons:** (1) backward arrow + eye — past; (2) eye + radiants — divine eye; (3) **broken chain links** (not lotus).
- **Titles:** Past Lives / Divine Eye / **Liberation of Mind** (short title; full Pali still `cetovimutti paññāvimutti` on second line).
- **No** separate small egg glyphs per card in this version — emphasis on line-art eyes + chain.

---

## Phase 7 — Conclusion & footer (y ≈ 1340–1550)

- **Conclusion panel:** `80,1355` — **760×120**, `conclusionGlow` ellipse behind, gold stroke.
- **Verse (English):** 14px bold `#c8a040`, quoted:  
  “One accomplished in true knowledge and conduct / is considered the best among gods and humans.”  
  *(Wording “is considered” vs “is best” — intentional copy in file.)*
- **Pali:** single line 11px italic `#907840`:  
  `vijjācaraṇasampanno · so seṭṭho devamānuse`
- **No** separate Brahmā Sanaṅkumāra attribution line in this SVG.
- **Footer:** rule `y=1490`; link **9.5px** `#485840` → `wordsofthebuddha.org/mn53` (with `<a target="_blank" rel="noopener noreferrer">`).
- **Lotus motif:** `translate(460, 1530) scale(0.25)` — matches other discourse SVGs.

---

## Line-art icons (final)

| Location | Description |
|----------|-------------|
| Step 1 | Rounded tablet + horizontal rules + check mark |
| Step 2 | Almond eye + side verticals (guarded seeing) |
| Step 3 | Bowl + mid fill line |
| Step 4 | Moon shape + three outward ticks |
| Egg panel | Large ellipse + crack segments |
| Breakthrough 1 | Eye + backward hook arrow |
| Breakthrough 2 | Eye + pupil + radial rays |
| Breakthrough 3 | Two elliptical chain links + break gap |

---

## Color notes (implementation)

- Staircase: **stg1–stg4** blue→blue-green stops (see file).
- Qualities panel: **qualPanel** `#1a2828` → `#162224`.
- Jhāna nesting: gold outer, green/gray inner strokes; innermost lightest.
- Breakthroughs: cool slate → green tint → warm **bk3** gold-brown.

---

## Output file

[src/assets/content-images/mn53.svg](src/assets/content-images/mn53.svg)

---

## Deviations from earlier draft plan (intentional)

1. **Header Pali** uses training/wholesomeness phrasing (`Sekhā paṭipadā…`) rather than `sekho pāṭipado — apuccaṇḍatāya samāpanno`.
2. **Seven qualities** are a **right-hand column** aligned with the staircase vertically, with a **“5”** bridge circle — not a full-width 4+3 grid.
3. **Staircase cards** are **360px** wide with **40px** horizontal step — not 280px an10.2 boxes.
4. **Icons** for steps 1–2 are **tablet + check** and **eye+shield**, not scroll-only and gate-only.
5. **Jhāna** section uses **mn4-level** detail and **right-aligned** `CONDUCT · caraṇa`.
6. **Breakthrough** tier title **`TISSO ABHINIBBHIDĀ`**; third card title shortened to **Liberation of Mind**.
7. **Conclusion** omits Brahmā attribution; English verse uses **“is considered the best”**.
8. **Canvas height** **1550** (not 1500) to fit lotus + breathing room.

---

## Verification checklist

1. Open SVG in browser — `viewBox` 920×1550; no clipping at bottom.
2. All Pali uses **Unicode** in source (no mojibake).
3. Font sizes ≥ **10px** for main instructional text; footer link **9.5px** (acceptable footer pattern per reference SVGs).
4. Compare header/footer rhythm to [mn107.svg](src/assets/content-images/mn107.svg) / [mn29.svg](src/assets/content-images/mn29.svg) — title stack, rule, link + lotus.
