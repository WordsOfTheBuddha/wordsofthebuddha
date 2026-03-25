## Plan: SVG Diagram for MN 119 (Kāyagatāsati Sutta — Mindfulness of the Body)

**Status:** Implemented in `src/assets/content-images/mn119.svg`. This document describes the **actual** design as shipped (not an earlier draft).

Create a dark-mode SVG diagram (**920×2420**, `viewBox="0 0 920 2420"`) visualizing the progressive training in body mindfulness from MN 119. The diagram descends through six body contemplation practices, a refrain band, four jhānas with simile icons and captions, cultivated-vs-uncultivated Māra contrast, a **skilled charioteer** simile card, ten culminating benefits (placeholder-style dashed cards for 1–8, expanded 9 and 10), and a footer. Uses established design language: deep navy background, Georgia serif, gold accents, burgundy-vs-teal contrast, glow/shadow filters, subtle lotus motif footer.

---

### Canvas & Global Style

| Item | Value |
|------|-------|
| `viewBox` / dimensions | `0 0 920 2420` (`width`/`height` 920×2420) |
| Font | Georgia, 'Times New Roman', serif |
| Background | `linearGradient` **bg** — `#0b1528` → `#0e1a30` → `#101e36` |
| Decorative ellipses | Subtle blobs at ~`(280,400)`, `(640,1300)`, `(460,2500)` (low opacity) |
| Min text size | **10px** (Pali subscripts, captions, footer link) |
| English always leads Pali | ✓ (where both appear) |
| Pali encoding | Direct Unicode (ā, ī, ū, ñ, ṁ, ṅ, ṇ, ṭ, ḷ) — never `&#x` numeric refs |

---

### `defs` Inventory (as implemented)

- **Gradients:** `bg`, `tierGrad` (gold fade for section rules), `stg1`–`stg6` (card fills for six contemplation cards), `jhana1` (outer jhāna fill), `cultL`/`cultR` (burgundy/teal for Māra contrast), `conclusionGlow` (radial behind benefit 10), `orbGlow` (4th-jhāna orb icon).
- **Filters:** `glow1` (3px blur), `glow2` (6px blur), `shadowDrop` (drop shadow on cards), `iconGlow` (2px blur).
- **Note:** Benefit cards use **dashed strokes** only — no `benefitGrad` fill in the shipped file.

---

### Section Stack (Top to Bottom)

#### Phase 1 — Title Block (y ≈ 0–130)

- **Title:** `MN 119 — KĀYAGATĀSATI SUTTA` — 22px bold, `#c8a040`, letter-spacing 3.
- **Subtitle:** `Mindfulness of the Body` — 15px italic, `#708090`.
- **Rule:** `y=74`, horizontal segment `x 260–660`, `#a09070` @ 0.3 opacity.
- **English tagline (12px italic, `#90c0b0`):**  
  *"Mindfulness of the body, when cultivated and frequently practiced, is of great fruit and great benefit"*
- **Pali tagline (11px italic, `#708878`, opacity 0.8):**  
  *kāyagatāsati bhāvitā bahulīkatā mahapphalā hoti mahānisaṁsā*

---

#### Phase 2 — Six Body Contemplation Practices (y ≈ 150–930)

Descending staircase: six cards with **+35px** x-offset per step. Cards 1–5: **380×100**, `rx=10`. Card 6 (charnel): **380×90**, `rx=10`.

**Tier label:** `BODY CONTEMPLATION PRACTICES · kāyagatāsati bhāvanā` — 12px bold gold @ 0.75 opacity, letter-spacing 2.5.

**Diagonal guide:** line from ~(80,195) to ~(350,830), `#4a8898`, 1.5px, opacity 0.07.

**Connectors:** cubic bezels between successive step midpoints (five paths).

##### Card geometry (actual positions)

| Step | `rect` origin (x, y) | Size |
|------|----------------------|------|
| 1 | (38, 197) | 380×100 |
| 2 | (73, 312) | 380×100 |
| 3 | (108, 427) | 380×100 |
| 4 | (143, 542) | 380×100 |
| 5 | (178, 657) | 380×100 |
| 6 | (213, 772) | 380×90 |

- Numbered circles: **r=10** (not 11), labels 1–6.
- Icons: right side of cards; `iconGlow`, opacity ~0.45–0.65.
- Titles: **13px bold** English; Pali **11px italic**; body **11px** `#607888` (card 6 body **10px**).

##### Card contents (actual copy)

| Step | English title | Pali | Icon / notes |
|------|----------------|------|----------------|
| 1 | Mindfulness while breathing in and out | ānāpānassati bhāvanā | Breath + face profile (stroke art) |
| 2 | Postures | iriyāpatha | Four stick-figure postures in a row |
| 3 | Acting with clear awareness | sampajānakārī | **Grid of four** small activity glyphs (not a single “eye”) |
| 4 | Reviewing impurities in the body | kāye asuci paccavekkhana | Open **grain-bag** / trapezoid + scattered dots |
| 5 | Reviewing the elements in the body | kāye dhātu paccavekkhana | Earth layers + water + flame + wind strokes |
| 6 | Nine Charnel Grounds | nava sivathikā | **Skull + crossed bones** (compact); two-line gloss + quote |

##### Common refrain band

- **Placement:** `rect x="70" y="878" width="780" height="48" rx="6"` — **same width and x-alignment as the outer First Jhāna rectangle** (`70 … 850`).
- **English (11px italic, `#90a0b8`):** full refrain including *worldly thoughts abandoned* and *internally steadied, calmed, unified, and collected*.
- **Pali (10px italic, `#7888a0`):** *appamatta · ātāpī · pahitatta — gehasita sarasaṅkappā pahīyanti — ajjhattameva cittaṁ santiṭṭhati ekodi hoti samādhiyati*

---

#### Phase 3 — Four Jhānas with Similes (y ≈ 945–1440)

**Tier label:** `FOUR JHĀNAS · cattāro jhānā` — 12px bold gold @ 0.75.

**Nested rectangles (actual):**

| Layer | Position | Size | Stroke |
|-------|-----------|------|--------|
| 1st (filled) | (70, 985) | **780×430** | `#c8a040` @ 0.42, `url(#jhana1)` fill |
| 2nd | (100, 1068) | 720×332 | `#78a890` outline |
| 3rd | (130, 1170) | 660×215 | `#aab8c8` outline |
| 4th | (160, 1270) | 600×100 | `#d0d8e0` outline |

- **Titles:** 14px bold ordinal + 12px italic Pali name via `tspan`.
- **Factor lines:** English with Pali in `<tspan fill="#6888a0" font-style="italic">(…)</tspan>` — **no separate “Simile:” body line**; simile is conveyed by **icon + short italic caption** next to/below the icon (e.g. *kneading powder*, *underground spring*).

| Jhāna | Icon / caption (actual) |
|-------|-------------------------|
| 1st | Tub with bubbles — *kneading powder* (`#d8c890`) |
| 2nd | Lake + spring — *underground spring* (water fill on lake) |
| 3rd | Submerged lotus — *submerged lotus* (petals use light fills) |
| 4th | **Glowing orb** + `orbGlow` — two caption lines: *covered from head to toe* / *in a spotless white cloth* (not a full cloth figure) |

---

#### Phase 4 — Cultivated vs Uncultivated (y ≈ 1440–1780)

**Tier label:** `UNCULTIVATED (abhāvitā) vs CULTIVATED (bhāvitā)` — 12px bold gold.

**Two columns:**

- Left: `rect (60, 1486) 385×178`, `url(#cultL)`, stroke `#a08090`.
- Right: `rect (475, 1486) 385×178`, `url(#cultR)`, stroke `#60a088`.

**Column headers:** `UNCULTIVATED` / `CULTIVATED` at y≈1511; subtitles *Māra finds an opening* / *Māra finds no opening* at y≈1527.

**Layout:** Three rows; **icon left**, two lines of text (English + parenthetical gloss). Spacing tuned so subtitle→first row and bottom padding are balanced (content stepped **+8px** below original staircase text; panel height **178**).

**Cultivated row 1 (actual wording):** *Light string ball on solid heartwood — bounces off* (not “door”).

**Pali snippets** from the sutta are **not** repeated in separate lines in the SVG; explanatory English appears in parentheses instead.

---

#### Phase 4b — Skilled Charioteer (between Māra and benefits)

- **Card:** `rect (120, 1696) 680×70`, dark fill, teal stroke.
- **Title:** *The Skilled Charioteer*; body English + Pali (*yenicchakaṁ yadicchakaṁ …*).
- **Icon:** Spoked wheel left of title block.

---

#### Phase 5 — Ten Benefits (y ≈ 1790–2400)

**Tier label:** `TEN BENEFITS · dasa ānisaṁsā`.

**Benefits 1–8:** Two columns (`translate(60,…)` and `translate(480,…)`), **60px** vertical stride between rows. Each cell: **dashed** `rect` (`stroke-dasharray="2,2"`), gold number, English title, Pali line — **no separate benefit icons** in the shipped file (unlike the original icon table in older plans).

**Benefit 9:** Centered block `translate(260, 2087)`, **400×100**, dashed `#60a088`; **divine eye** icon on the RHS; title *Divine Eye* / *dibbacakkhu*; short English + Pali.

**Benefit 10:** Full-width panel `rect (80, 2215) 760×140`, gold stroke, `glow2`; **radial `conclusionGlow` ellipse** behind. Title *Ending of Mental Defilements* / *āsavakkhaya*; quoted English liberation lines; Pali with `cetovimuttiṁ paññāvimuttiṁ` highlighted in `#b0a870` tspans. Icon: **broken chain** (two elliptical links + gap) on RHS with `glow1`.

---

#### Phase 6 — Footer (y ≈ 2370–2420)

- **Rule:** subtle line `x 300–620`, `y=2370`, `#304058` @ 0.3.
- **Link:** `https://wordsofthebuddha.org/mn119` — 10px `#485840`, `<a target="_blank" rel="noopener noreferrer">`.
- **Lotus motif:** `translate(460, 2402) scale(0.25)` — four petal paths + circle; stroke `#8a9ab0` @ 0.18 (minimal, not gold-heavy).

---

### Line-Art Icons (Implemented Highlights)

Icons are mostly stroke-based; jhāna 2–3 use some light fills. Key IDs for reference:

| Location | Description |
|----------|-------------|
| Steps 1–2, 4–5 | As in plan spirit; step 3 is **fourfold activity** grid |
| Step 6 | Skull + bones |
| Jhāna 1–4 | Tub, lake, lotus, **orb** |
| Māra rows | Rock/clay, lamp, empty jar / string+block, wet log, lidded jar |
| Charioteer | Spoked wheel |
| Benefit 9 | Ornate eye |
| Benefit 10 | Broken chain links |

---

### Color Notes (unchanged in spirit)

Gold `#c8a040`, primary text `#c8d8e8`, secondary `#8898b0`, burgundy panel `cultL`, teal `cultR`, accents `#80c0a0` / `#a08090`, gloss `#607888`, navy `bg` gradient.

---

### Typography Spec (aligned to file)

| Role | Size | Notes |
|------|------|--------|
| Main title | 22px | bold gold |
| Tagline EN | 12px | italic (not 14px) |
| Tagline Pali | 11px | italic |
| Card English title | 13px | bold |
| Jhāna Pali in tspan | ~10–11px | italic `#6888a0` |
| Refrain | 11px / 10px | EN / Pali |
| Footer link | 10px | — |

---

### Symmetry and Geometry Rules (actual)

- Center axis **x = 460** for centered text and full-width elements.
- Refrain band **must** match First Jhāna outer frame: **x=70, width=780**.
- Staircase: +35px x per step; card width **380**; step 6 height **90**.
- Jhāna nesting: ~30px inset per level; outer height **430** (tall enough for nested 2nd–4th content).
- Māra panels: **385×178** each; gap between columns 30px (60+385=445, 475−445=30).

---

### Jhāna Text Formatting (actual)

- **Title:** `"Ordinal Jhāna"` + `tspan` for Pali name.
- **Factors:** English + parenthetical Pali in `#6888a0` italic tspans.
- **Simile:** Italic **captions** near icons (not a duplicate “Simile:” paragraph in body text).

---

### Pali Text Encoding Rule

- Direct Unicode for Pali; standard XML escaping for `&`, `<`, `>` only where needed.

---

### Output File

`src/assets/content-images/mn119.svg`

---

### Reference Files

- `src/assets/content-images/mn2.svg`, `mn4.svg`, `mn53.svg`, `mn118.svg`, `mn148.svg` — vocabulary and patterns.
- `src/content/en/mn/mn119.mdx`, `src/content/pli/mn/mn119.md` — source text.

---

### Decisions (as implemented)

1. **Canvas 920×2420** — accommodates staircase, tall jhāna stack, Māra, charioteer, benefits, footer.
2. **Charnel grounds:** Compact card **with** skull/bones icon and quote line.
3. **Refrain band** width locked to **First Jhāna** outer rect for visual alignment.
4. **Māra section:** English glosses in parentheses; column copy uses **solid heartwood** wording; panel height **178** with tuned vertical rhythm.
5. **Skilled charioteer** card inserted between Māra and ten benefits.
6. **Benefits 1–8:** Dashed placeholder cards **without** per-benefit pictorial icons in SVG.
7. **Benefit 9–10:** Expanded; 10 uses **Ending of Mental Defilements** framing, glow ellipse, broken-chain icon.
8. **4th jhāna simile:** **Orb + cloth captions** rather than full draped figure.
9. **`benefitGrad`** not used; **`orbGlow`** added for 4th-jhāna orb.

---

### Build / Maintenance Steps (historical)

Phases correspond to sections in the SVG: scaffold → title → six cards + refrain → four jhānas → Māra → charioteer → benefits → footer. When editing, preserve refrain/jhāna horizontal alignment and Māra panel dimensions unless intentionally redesigning.
