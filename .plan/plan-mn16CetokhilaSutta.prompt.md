## Plan: SVG Diagram for MN 16 (Cetokhila Sutta — Barriers of the Mind)

**Status — finalized.** The shipped graphic is `src/assets/content-images/mn16.svg` (mirrored to `public/content-images/mn16.svg`). Built as a single transform-first SVG following DESIGN-LANGUAGE.md and the MN26/MN39/SN22.81 visual family. No new design-system icons were created; all motifs reuse existing assets.

---

### Final output

| Property | Value |
|----------|-------|
| File | `src/assets/content-images/mn16.svg` |
| Dimensions | **920×2125** (`viewBox="0 0 920 2125"`) |
| Background | `bg` gradient `#0b1528` → `#0e1a30` → `#101e36` + ambient ellipses |
| Build | Single SVG file. No merge script. |
| Text density | Medium: short English + selective Pali anchors |
| Transform discipline | Every section and every repeated row in a named `<g transform="translate(...)">` |

---

### Section Y offsets

| Section id | y-offset | Role |
|------------|----------|------|
| `header` | 0 | Title + guiding question + Pali tagline |
| `five-barriers` | 148 | Crown thought-bubbles → debt figure → incline caption → ABANDONED clearance band |
| `five-shackles` | 764 | Same bubble pattern → shackled figure → SEVERED clearance band |
| `growth-possible` | 1400 | Tree + growth message |
| `fifteen-factors` | 1522 | Four iddhipāda cards + factor 15 + endowed line |
| `hen-egg` | 1840 | Hen-and-egg simile + “So too…” meaning |
| `footer` | 2078 | URL + lotus |

Uniform ~24px gaps between major sections.

---

### Discourse structure

MN 16’s hinge: without abandoning the five *cetokhilā* and severing the five *cetasovinibandhā*, growth in Dhamma-Vinaya is impossible; with them cleared, plus the fifteen factors, breakthrough is inevitable — capped by the hen-and-egg simile.

**Layout decision (final):** Barriers and shackles as **SN22.81-style thought-bubble crowns** (3 top + 2 shoulder bubbles) over a stick-figure, then a single teal **clearance band** (status + incline refrain + metaphor icon). Chip ribbons were tried and removed — the bubbles already name the five items, so a second catalog felt redundant.

---

### Phase 1 — Header

- Title: `MN 16 — CETOKHILA SUTTA` — 22px bold `#c8a040`
- Guiding question framing (not a separate thesis-bridge card)
- Tagline EN/PL on growth in Dhamma and Vinaya

---

### Phase 2 — Five barriers (`pañca cetokhilā`)

**Tier:** `FIVE BARRIERS OF THE MIND · PAÑCA CETOKHILĀ`

Crown thought bubbles (doubt about Teacher / Dhamma / Saṅgha / training / angry toward companions).

| Element | Content |
|---------|---------|
| Center figure | `simile-debt` — burdened under doubt |
| Caption | Mind does not incline … · Barriers not abandoned · `appahīnā` |
| Clearance band | Large `simile-debt-free` icon (left) + vertically centered copy: **ABANDONED · PAHĪNĀ** / “Mind inclines — confidence clears the barriers” / incline Pali |

No chip ribbon under the band.

---

### Phase 3 — Five shackles (`pañca cetasovinibandhā`)

Same crown geometry. Bubbles: pleasures / body / forms / ease / god-aim.

| Element | Content |
|---------|---------|
| Center figure | Inline shackled stick figure (wrists) |
| Caption | Mind does not incline … · Shackles not severed · `asamucchinnā` |
| Clearance band | Large `simile-freedom` icon (left) + vertically centered copy: **SEVERED · SUSAMUCCHINNĀ** / “Mind inclines — freedom clears the shackles” / incline Pali |

No chip ribbon under the band.

**Clearance-band design note:** Abandoned / severed are carried by (1) the status word itself, (2) the metaphor icon (debt-free / freedom), and (3) the incline refrain. That triad is enough; re-listing the five as pills competed with the bubbles.

---

### Phase 4 — Growth possible

Teal/gold band with `tree-flourishing` icon:

- EN: When barriers are abandoned and shackles severed, growth in this teaching and training is possible
- PL: `pañca cetokhilā pahīnā · pañca cetasovinibandhā susamucchinnā · ṭhānametaṁ vijjati`

---

### Phase 5 — Fifteen factors

**Tier:** `FIFTEEN FACTORS · USSOḶHIPANNARASAṄGA`

Four equal cards (iddhipāda) + full-width fifth (ussoḷhī). Motif: `iddhipada-four`.

| # | English | Pali |
|---|---------|------|
| 11 | Aspiration | `chanda` |
| 12 | Determination | `vīriya` |
| 13 | Mind | `citta` |
| 14 | Investigation | `vīmaṁsā` |
| 15 | Active Involvement | `ussoḷhīyeva pañcamī` |

Closing inside section: Endowed with fifteen factors · `ussoḷhipannarasaṅgasamannāgato`

---

### Phase 6 — Hen and egg

Adapted from MN53 egg block + `hen-egg-simile` icon geometry:

- Title: `THE HEN AND THE EGG`
- EN quote + bridge capabilities line + Pali
- Closing meaning: *“So too, a bhikkhu endowed with these fifteen factors…”*

---

### Phase 7 — Footer

- Link: `wordsofthebuddha.org/mn16` → `https://wordsofthebuddha.org/mn16`
- Faint lotus motif

---

### Defs

`bg`, `tierGrad`, `cardIgnoble`, `cardNoble`, `growthGrad`, `factorGrad`, `libGlow`, `eggGlow`, `glow1`, `iconGlow`, `shadowDrop`

---

### Design-system icons embedded (reused; no new icons)

| Icon ID | Role in MN 16 |
|---------|---------------|
| `simile-debt` | Barriers center figure |
| `simile-debt-free` | Abandoned clearance band |
| `simile-freedom` | Severed clearance band |
| `tree-flourishing` | Growth-possible band |
| `iddhipada-four` | Fifteen-factors motif |
| `hen-egg-simile` | Closing simile |

Manifest: add `mn16` to each icon’s `discourse` array in `src/utils/buildIconsManifest.ts`, then regenerate `icons-manifest.json`.

---

### Verification checklist

- [x] All sections and repeating rows wrapped in named transform groups
- [x] On-canvas English/Pali traceable to `src/content/en/mn/mn16.mdx` and `src/content/pli/mn/mn16.md`
- [x] Unicode diacritics and curly quotes; no escaped Pali entities
- [x] Harm/harmony color split consistent with MN26/MN39
- [x] Chip ribbons removed from clearance bands; bubbles carry the five names
- [x] Footer link resolves; diagram appears for discourse id `mn16` via content-image convention
- [x] Reused icons registered with `mn16` in icons manifest
