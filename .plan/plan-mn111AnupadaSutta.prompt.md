## Plan: SVG Diagram for MN 111 (Anupada Sutta — Sequentially)

Create a dark-mode SVG diagram visualizing MN 111 as a disciplined investigation of meditative attainments: Sāriputta enters each successive attainment, discerns the mental states present in it, sees those states arise, persist, and pass away, remains unattached to them, and knows whether there is an escape beyond. The diagram should make the repeated method visible without turning the discourse into a generic jhāna chart.

The governing idea: **attainment is not the endpoint being praised; sequential discernment within attainment is.** The visual arc moves from Sāriputta’s praised wisdom, through the repeated anupada method, through nine attainments, and ends with mastery/perfection and Sāriputta keeping the unsurpassed wheel of Dhamma rolling.

---

### Final output target

| Property | Value |
|----------|-------|
| File | `src/assets/content-images/mn111.svg` |
| Dimensions | **920 wide; height 3160** (`viewBox="0 0 920 3160"`) |
| Background | Reuse MN 26 / MN 148 `bg` gradient + subtle ambient ellipses |
| Build | Single SVG file. No merge script. |
| Text density | Medium-high, but strongly structured: short English + selective Pali anchors |
| Transform discipline | Every section, every attainment row, and every repeated factor chip gets a named `<g id transform="translate(...)">`. No exceptions. |
| Tone | Quiet, precise, contemplative; avoid hero/biography treatment |

---

### Reference files

- `src/assets/content-images/mn26.svg` — strongest reference for long vertical discourse image, gradients, section rails, footer, and disciplined transform groups.
- `.plan/plan-mn26PasarasiSutta.prompt.md` — strongest reference for planning style and doctrinal reframing.
- `src/assets/content-images/mn148.svg` — strongest reference for systematic doctrine diagrams with repeated structures and six-column/factor logic.
- `src/assets/content-images/design-system/DESIGN-LANGUAGE.md` — canonical typography, transform-first architecture, quotes, icon handling.
- `src/assets/content-images/design-system/icons/` — use existing icons where possible; do not create new icon files unless implementation truly needs them.

---

### As-built snapshot (May 2026)

- `src/assets/content-images/mn111.svg` is implemented and currently uses `viewBox="0 0 920 3160"`.
- Section stack is finalized at: `method-template y=340`, `discernment-slices y=745`, `final-verdict y=2858`, `footer y=3114`.
- Discernment slices are finalized at: `0, 238, 461, 684, 944, 1167, 1390, 1613, 1853`.
- Slice body headers (`DISTINCTIVE`, `+ THE UNIVERSAL ELEVEN`, `OBSERVED`) are horizontally centered over their respective rects.
- The cessation header no longer repeats the vessel icon in the header row; the title/subtitle are shifted left and the larger vessel remains in the body area.
- No new reusable icon files were created during implementation; existing library geometry was reused and inlined.

---

### Top-level section layout

```xml
<g id="header"              transform="translate(0, 0)">
<g id="wisdom-praise"       transform="translate(0, …)">
<g id="method-template"     transform="translate(0, …)">
<g id="discernment-slices"  transform="translate(0, …)">
  <g id="slice-1-jhana1"    transform="translate(0, …)">
  <g id="slice-2-jhana2"    transform="translate(0, …)">
  <g id="slice-3-jhana3"    transform="translate(0, …)">
  <g id="slice-4-jhana4"    transform="translate(0, …)">
  <g id="slice-5-space"     transform="translate(0, …)">
  <g id="slice-6-conscious" transform="translate(0, …)">
  <g id="slice-7-nothing"   transform="translate(0, …)">
  <g id="slice-8-neither"   transform="translate(0, …)">
  <g id="slice-9-cessation" transform="translate(0, …)">
<g id="final-verdict"       transform="translate(0, …)">
<g id="footer"              transform="translate(0, …)">
```

Final translate offsets are computed during implementation after each section’s height is known. Build each section in isolation at local `(0,0)` and stack with explicit translates.

---

### Phase 1 — Header

Reuse the MN 26/MN 148 title stack style.

- Title: `MN 111 — ANUPADA SUTTA`
- Subtitle: `Sequentially`
- Tagline English: `Sequential discernment of mental states`
- Pali anchor: `anupadadhammavipassanā`
- Secondary line, if room: `States arose known, remained known, and passed away known`
- Pali secondary: `viditā uppajjanti · viditā upaṭṭhahanti · viditā abbhatthaṁ gacchanti`

Visual notes:
- Text-only header. No large portrait of Sāriputta.
- Subtle `discernment-lens` icon may sit as a faint corner mark if needed, but the header should stay quieter than the attainment ladder.
- Ambient ellipse behind the lower tagline, very low opacity gold/teal.

---

### Phase 2 — Wisdom Praise

Purpose: show why Sāriputta is the exemplar without letting the diagram become biographical.

Use a full-width card (`x=70`, `width=780`, `height≈150`, `rx=8`) with a centered title and seven small wisdom badges.

Section title:

`SĀRIPUTTA’S WISDOM · SĀRIPUTTASSA PAÑÑĀ`

Opening line:

> “For half a month, Sāriputta cultivated insight through sequential discernment of mental states.”

Pali:

`aḍḍhamāsaṁ anupadadhammavipassanaṁ vipassati`

Wisdom badges, arranged in one compact row or two rows if text needs space:

| English | Pali |
|---------|------|
| wise | paṇḍita |
| great wisdom | mahāpañña |
| widespread wisdom | puthupañña |
| joyful wisdom | hāsapañña |
| swift wisdom | javanapañña |
| piercing wisdom | tikkhapañña |
| penetrative wisdom | nibbedhikapañña |

Visual notes:
- Badges should be low, restrained, not celebratory medals.
- Use `discernment-lens` or `divine-eye`-like linework sparingly; this section’s real function is to introduce the method in Phase 3.

---

### Phase 3 — Method Key: The Discernment Template

This phase is the conceptual hinge. **Instead of a generic five-node refrain loop, render the actual visual template that each attainment will reuse.** The reader should leave this section understanding the *shape* of every row that follows: what counts as a distinctive factor, what counts as a universal state, and how arising → persisting → passing is rendered.

Inspiration: the inline structural diagrams in `src/pages/posts/fire.mdx` — fire triangle, photon/wavelength/amplitude. They are not chip rows; they are *labeled structural figures* that name the parts of one event so later instances become legible.

Use a single wide template card (`x=70`, `width=780`, `height≈340`) titled:

`THE ANUPADA TEMPLATE · WHAT SĀRIPUTTA DISCERNED IN EACH ATTAINMENT`

The card contains three labeled regions, drawn once and explained once:

#### Region A — The distinctive constellation (left, ~200 wide)

A small cluster of 4–5 unlabeled chips arranged as a constellation, with a caption:

> *Distinctive factors* — what makes this attainment what it is.
> Pali: *visesabhūtā dhammā* (paraphrase; not in text)

A faint ghost label like `vitakka · vicāra · pīti · sukha · cittekaggatā` shown beneath in italic at low opacity, captioned `(example: first jhāna)`.

#### Region B — The universal grid (centre, ~360 wide)

The most important figure in the whole diagram. An 11-cell grid (single row, or 2 rows of 6+5) showing the eleven states that Sāriputta found *in every attainment from the first jhāna through the base of nothingness*:

`contact · feeling · perception · intention · mind · desire · resolution · energy · mindfulness · equanimity · attention`

`phassa · vedanā · saññā · cetanā · citta · chanda · adhimokkho · vīriya · sati · upekkhā · manasikāra`

Each cell is a small muted chip with the English label above and the Pali below in italic. A bracket above the grid reads:

`THESE ELEVEN ARE PRESENT IN EVERY ATTAINMENT — AND EACH ONE IS DISCERNED`

This is MN 111's central surprise: even in the formless attainments, even in nothingness, these same eleven mind-factors are operating — and Sāriputta saw each of them arise, persist, and pass. **In every per-attainment slice below, this 11-cell grid is shown again, never collapsed.** Repetition is the point.

#### Region C — The observation rail (right, ~180 wide)

A small vertical timestrip rendering the three-moment observation:

```
●  arose known          viditā uppajjanti
│
●  remained known       viditā upaṭṭhahanti
│
○  passed away known    viditā abbhatthaṁ gacchanti
```

Use `impermanence-dissolve` icon at the bottom node. A short caption beneath:

> Each chip in the grid above is *individually* watched through this three-moment cycle.
> Pali: *anupadavavatthitā honti*

#### Footer band of the template

A single horizontal strip beneath the three regions carrying the unattachment + escape clause, since these don't change per attainment:

`unattracted · unrepelled · disengaged · freed · disentangled · → escape beyond exists`

Pali italic: `anupāyo · anapāyo · anissito · vippamutto · visaṁyutto · atthi uttari nissaraṇaṁ`

Important semantic note for later phases:
- For attainments 1–8, the escape clause reads `atthi uttari nissaraṇaṁ`.
- After cessation, it inverts to `natthi uttari nissaraṇaṁ` — and is rendered as completion, not loss.

---

### Phase 4 — Nine Discernment Slices

This is the main body. **It is not a jhāna ladder.** Each attainment is a *discernment slice* that re-runs the template from Phase 3 with its own distinctive constellation. The repetition of the 11-cell universal grid in every slice is the visual argument of the whole diagram.

Slice anatomy (shared by all nine):

```text
┌─────────────────────────────────────────────────────────────────────┐
│ [n]  Attainment title · Pali                            [escape ▸] │
│      entry phrase (small)                                           │
│                                                                     │
│  ┌── Distinctive ──┐   ┌──────── Universal 11 ────────┐   ┌─ Obs ─┐│
│  │  ○  vitakka     │   │ ph  vd  sñ  ct  ci  ch       │   │  ↑    ││
│  │  ○  vicāra      │   │ ad  vī  st  up  ma           │   │  ●    ││
│  │  ○  pīti        │   │ (each cell: small chip)      │   │  ↓    ││
│  │  ○  sukha       │   │                              │   │       ││
│  │  ○  cittekaggatā│   │                              │   │       ││
│  └─────────────────┘   └──────────────────────────────┘   └───────┘│
└─────────────────────────────────────────────────────────────────────┘
```

Width: full inner band (`x=70`, `width=780`). Height: **≈210** for slices 1–7, **≈200** for slice 8 (no internal factor list), **≈240** for slice 9 (cessation).

Visual rules:

- The universal 11-grid keeps the same column positions in every slice; the eye should learn it after slice 1 and confirm it through slices 2–7.
- The distinctive constellation is the only region whose contents change between slices. Its tier color (`jhana1Grad`…`cessationGrad`) supplies the only color shift between slices.
- The observation rail's three glyphs (rise / hold / dissolve) are identical in every slice — this is the same observation being run again and again.
- The escape badge sits at the top-right of every slice, muted teal/gold for slices 1–8, and a calm gold "complete" badge for slice 9.
- A thin tier-color spine on the left edge links the slice to its tier (warm for jhānas, cooler for formless, gold for cessation).

#### Slice 8 variation — Neither perception nor non-perception

This slice deliberately omits the universal 11-grid and the distinctive constellation. In its place, draw a single horizontal **"emergence" arrow** ending in a `meditation-seat` glyph, with the line:

`Emerged mindful · contemplated states past, ceased, changed`

Pali: `sato vuṭṭhahati · atītā niruddhā vipariṇatā`

This visual asymmetry is doctrinally honest: MN 111 does not list factors *within* this attainment; only *after emergence* does Sāriputta apply the anupada observation to what had passed. The observation rail is preserved on the right; the escape badge still reads `atthi uttari nissaraṇaṁ`.

#### Slice 9 variation — Cessation

This slice replaces the universal grid with a single centered statement panel reading:

`Having seen with wisdom, the taints were completely exhausted`

Pali: `paññāya cassa disvā āsavā parikkhīṇā honti`

Behind the panel, a soft `libGlow` radial. Beneath it, a smaller line:

`Emerged mindful · contemplated states past, ceased, changed`
Pali: `sato vuṭṭhahitvā · atītā niruddhā vipariṇatā`

The escape badge inverts to `natthi uttari nissaraṇaṁ · NO ESCAPE BEYOND` rendered as the final calm gold completion tag.

---

#### Distinctive constellations per slice

Slice 1–7 supply the chips for the *distinctive* region only. The universal grid and observation rail are identical and are not re-listed below.

---

### Phase 4a — Four Jhāna slices

Tier color progression: warmer at jhāna 1 (`jhana1Grad`), cooling toward jhāna 4. Distinctive constellations only — universal grid + observation rail are reused unchanged.

#### Slice 1 — First Jhāna · paṭhama jhāna

Entry: `secluded from sensual pleasures and unwholesome states`
Pali: `vivicceva kāmehi · vivicca akusalehi dhammehi`

Distinctive constellation (5 chips):

| English | Pali |
|---|---|
| reflection | vitakka |
| examination | vicāra |
| uplifting joy | pīti |
| pleasure | sukha |
| unification of mind | cittekaggatā |

Tier icon (small, top-left of slice): `jhana-first`.

#### Slice 2 — Second Jhāna · dutiya jhāna

Entry: `with the settling of reflection and examination`
Pali: `vitakkavicārānaṁ vūpasamā`

Distinctive constellation (4 chips): `internal tranquility · uplifting joy · pleasure · unification of mind`
Pali: `ajjhattaṁ sampasāda · pīti · sukha · cittekaggatā`

Tier icon: `jhana-second`.

#### Slice 3 — Third Jhāna · tatiya jhāna

Entry: `with fading of desire for uplifting joy`
Pali: `pītiyā ca virāgā`

Distinctive constellation (4 chips): `pleasure · mindfulness · clear awareness · unification of mind`
Pali: `sukha · sati · sampajañña · cittekaggatā`

Tier icon: `jhana-third`.

#### Slice 4 — Fourth Jhāna · catuttha jhāna

Entry: `with abandoning pleasure and pain, and settling of mental pleasure and displeasure`
Pali: `sukhassa ca pahānā · dukkhassa ca pahānā · somanassadomanassānaṁ atthaṅgamā`

Distinctive constellation (5 chips): `equanimity · neither-painful-nor-pleasant feeling · absence of enjoyment due to tranquility · purity of mindfulness · unification of mind`
Pali: `upekkhā · adukkhamasukhā vedanā · anābhoga · satipārisuddhi · cittekaggatā`

Tier icon: `jhana-fourth`.

---

### Phase 4b — Four formless slices

Tier color: cool teal/blue progression. Distinctive constellation always 2 chips (perception + cittekaggatā) — making the universal grid feel even more striking by contrast: only 2 distinctive states, but still all 11 universal states are present and discerned.

#### Slice 5 — Base of Boundless Space · ākāsānañcāyatana

Entry: `with complete surpassing of perceptions of form`
Pali: `sabbaso rūpasaññānaṁ samatikkamā`
Perception anchor (small, italic above constellation): `“space is boundless” · ananto ākāso`

Distinctive constellation (2 chips): `perception of boundless space · unification of mind`
Pali: `ākāsānañcāyatanasaññā · cittekaggatā`

Tier icon: `space-base`.

#### Slice 6 — Base of Boundless Consciousness · viññāṇañcāyatana

Perception anchor: `“consciousness is boundless” · anantaṁ viññāṇaṁ`

Distinctive constellation (2 chips): `perception of boundless consciousness · unification of mind`
Pali: `viññāṇañcāyatanasaññā · cittekaggatā`

Tier icon: `consciousness-base`.

#### Slice 7 — Base of Nothingness · ākiñcaññāyatana

Perception anchor: `“there is nothing” · natthi kiñcī`

Distinctive constellation (2 chips): `perception of nothingness · unification of mind`
Pali: `ākiñcaññāyatanasaññā · cittekaggatā`

Tier icon: `nothingness-base`.

#### Slice 8 — Base of Neither Perception nor Non-Perception · nevasaññānāsaññāyatana

Per the variation rule above: omit constellation and universal grid; render only an emergence arrow + line.

English: `Emerged mindful · contemplated states past, ceased, changed`
Pali: `sato vuṭṭhahati · atītā niruddhā vipariṇatā`

Tier icon: `neither-base`. Observation rail and escape badge preserved.

---

### Phase 4c — Cessation slice (Slice 9)

Per the variation rule above. Title: `9 · Cessation of Perception and What Is Felt · saññāvedayitanirodha`.

Entry: `with the complete surpassing of the base of neither perception nor non-perception`
Pali: `sabbaso nevasaññānāsaññāyatanaṁ samatikkamma`

Central statement panel (replaces both the constellation and the universal grid; spans full slice width):

`Having seen with wisdom, the taints were completely exhausted`
Pali: `paññāya cassa disvā āsavā parikkhīṇā honti`

Beneath the panel, smaller line:

`Emerged mindful · contemplated states past, ceased, changed`
Pali: `sato vuṭṭhahitvā · atītā niruddhā vipariṇatā`

Escape badge inverts: `natthi uttari nissaraṇaṁ · NO ESCAPE BEYOND` — calm gold completion tag, not a warning.

Icons: `cessation-vessel` left, `defilements-ended` or `liberation-sparkle` on the exhaustion line. Soft `libGlow` radial behind the central panel.

---

### Phase 5 — Final Verdict: Mastery, Dhamma Heir, Wheel Kept Rolling

Use a three-part concluding band (`x=70`, `width=780`, `height≈260`) with three cards or columns. This section prevents the diagram from ending only in an abstract attainment list; it returns to the Buddha’s praise of Sāriputta.

Section title:

`THE BUDDHA’S VERDICT · SAMMĀ VADEYYA`

#### Card 1 — Mastery and Perfection

English:

`mastery and perfection in noble virtue, collectedness, wisdom, and liberation`

Pali:

`vasippatto pāramippatto ariyasmiṁ sīla · samādhi · paññā · vimutti`

Visual: four small vertical tablets or four linked chips.

Icon candidates: `virtue-tablet`, `bojjhanga-collectedness`, `discernment-lens`, `liberation-sparkle`.

#### Card 2 — Born From the Dhamma

English:

`legitimate son, born from the mouth, born from the Dhamma, inheritor of the Dhamma`

Pali:

`oraso mukhato jāto · dhammajo · dhammanimmito · dhammadāyādo`

Visual: quiet lineage/card motif; do not use biological imagery.

Icon candidates: `chariot-wheel` or a simple book/tablet line drawing.

#### Card 3 — Wheel Kept Rolling

English:

`The unsurpassed wheel of the Dhamma set rolling by the Tathāgata is kept rolling rightly by Sāriputta.`

Pali:

`anuttaraṁ dhammacakkaṁ … sammadeva anuppavattetī`

Icon: `chariot-wheel`, with a subtle gold rotation arc.

This final card can receive the strongest gold accent of the diagram, but keep it modest; the doctrinal climax already happened at cessation.

---

### Defs to reuse / add

Reuse from MN 26 and MN 148:

- `bg`
- `tierGrad`
- `cardNeutral`
- `knowledgeGrad` or equivalent blue-grey insight card fill
- `jhana1Grad`, `formless1`–`formless4`, `cessationGrad` if adapting MN 26/MN 25 attainment colors
- `libGlow`
- `glow1`, `glow2`, `iconGlow`, `shadowDrop`

Add only if needed:

- `methodGrad` — subdued blue-grey for the method card
- `factorChipGrad` — small chip fill for distinctive factors
- `commonChipGrad` — smaller muted chip fill for common states
- `completeGrad` — calm gold/olive fill for the final “no escape beyond” badge

Avoid adding a large palette. MN 111 should read mostly as navy / slate / gold, with teal for “escape beyond” and quiet gold for completion.

---

### Icon inventory

Use existing library icon geometry where available. When inlining, copy the internal geometry from `src/assets/content-images/design-system/icons/<id>.svg` exactly and wrap only with an outer transform/opacity/filter.

Implemented icon set (mapped to manifest ids):

- `discernment-lens` — method key and framing accents
- `impermanence-dissolve` (inlined as `icon-impermanence`) — observed rail dissolve marker
- `meditation-seat` — slice 8 emergence marker
- `jhana-first`, `jhana-second`, `jhana-third`, `jhana-fourth` (inlined as `icon-jhana1..4`) — slices 1–4 headers
- `space-base`, `consciousness-base`, `nothingness-base`, `neither-base` — slices 5–8 headers
- `cessation-vessel` — slice 9 body icon
- `defilements-ended` and `liberation-sparkle` — slice 9 completion semantics
- `virtue-tablet`, `bojjhanga-collectedness` (inlined as a local `icon-collectedness` symbol), `chariot-wheel` — final verdict band

No new reusable icon files are currently required.

---

### Copy and quote conventions

- English leads; Pali follows in smaller italic text.
- Use direct Unicode Pali (`ā`, `ī`, `ñ`, `ṁ`, etc.).
- Use Unicode curly/typographic quotes inside `<text>` elements.
- Keep quoted phrases short enough for SVG text; no automatic wrapping.
- Avoid abbreviating doctrinally important Pali in the first occurrence. Later repeated occurrences may use ellipses.

Key repeated quotations:

| English | Pali |
|---------|------|
| states were sequentially discerned | tyāssa dhammā anupadavavatthitā honti |
| arose known, remained known, passed away known | viditā uppajjanti · viditā upaṭṭhahanti · viditā abbhatthaṁ gacchanti |
| not having been, they come into being; having been, they vanish | ahutvā sambhonti · hutvā paṭiventi |
| unattracted, unrepelled, freed, disentangled | anupāyo · anapāyo · vippamutto · visaṁyutto |
| there is escape beyond | atthi uttari nissaraṇaṁ |
| there is no escape beyond | natthi uttari nissaraṇaṁ |

---

### What to reuse, what to avoid

Reuse:

- MN 26 long-scroll scaffold, footer, background, gradients, and quiet section rails.
- MN 148’s systematic repeated-row discipline and compact doctrine-table logic.
- MN 25/MN 26 formless-base and cessation color/icon vocabulary.
- Design-system icon geometry for compact line icons.

Avoid:

- Do **not** copy MN 25/MN 26 “Where Māra Cannot Go” section verbatim. MN 111 has the same meditative range, but a different doctrinal point.
- Do **not** use the MN 119 jhāna simile presentation; MN 111 does not give the similes here.
- Do **not** make Sāriputta a portrait/hero visual. The praise is for wisdom functioning through insight.
- Do **not** collapse the universal 11-state grid after the first slice. Its repetition in every slice 1–7 is the whole point of the diagram.
- Do **not** make “no escape beyond” look like failure. In MN 111 it is completion.

---

### Proposed vertical sizing

As-built `viewBox` height: **3160**. Slices remain large by design so the universal grid can repeat legibly.

| Section | Approx height |
|---------|---------------|
| Header | 160 |
| Wisdom praise | 160 |
| Method template (Phase 3) | 360 |
| Discernment slices (Phase 4) | 7 × 210 + 1 × 200 + 1 × 240 = 1910 |
| Final verdict | 260 |
| Footer + gaps | 100 |

If the universal 11-grid feels cramped at 360 wide, lay it out as 2 rows × 6 + 5 rather than a single row of 11. Never shrink chip text below 10px.

---

### Verification checklist

- Output file is `src/assets/content-images/mn111.svg`.
- SVG has `role="img"`, `<title>`, and `<desc>`.
- Every section and every slice is wrapped in a named transform group.
- The diagram's central visual argument is the **per-slice repetition of the universal 11-state grid alongside the distinctive constellation** — not a generic jhāna ladder.
- Phase 3 renders the discernment template (distinctive constellation + universal 11-grid + observation rail) as a labeled structural figure, fire.mdx style — not a five-node refrain loop.
- The eleven universal states (`phassa · vedanā · saññā · cetanā · citta · chanda · adhimokkho · vīriya · sati · upekkhā · manasikāra`) appear as a visible chip grid in slices 1–7.
- The arising → persisting → passing observation rail (`viditā uppajjanti · upaṭṭhahanti · abbhatthaṁ gacchanti`) is rendered visually (rise/hold/dissolve glyphs), not just textually, in every slice 1–7.
- Slice 1 shows five distinctive factors: `vitakka`, `vicāra`, `pīti`, `sukha`, `cittekaggatā`.
- Slices 2, 3, 4 show MN 111's specific distinctive factors — not the generic jhāna formula.
- Slices 5, 6, 7 each show 2 distinctive factors plus the full universal grid (the contrast is the point).
- Slice 8 (neither perception nor non-perception) deliberately omits the constellation and grid, replacing them with an emergence arrow and the contemplated-after-emergence line.
- Slice 9 (cessation) replaces the grid with the `paññāya cassa disvā āsavā parikkhīṇā honti` statement panel and a `libGlow` radial.
- Slices 1–8 carry `atthi uttari nissaraṇaṁ`; slice 9 carries `natthi uttari nissaraṇaṁ` rendered as calm gold completion, not as warning.
- Final verdict includes mastery/perfection in virtue/collectedness/wisdom/liberation, Dhamma-heir language, and the wheel kept rolling.
- Existing icon geometry is copied exactly when inlined; new per-mental-state glyphs (if added) live as new files under `design-system/icons/`.
- No visible overlap or clipping at the final viewBox.
- Typography, palette, card radii, glows, and footer match the existing discourse-image family.
