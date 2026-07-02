## Plan: SVG Diagram for MN 140 (Dhātuvibhaṅga Sutta — Exposition on the Elements)

**Status — planning.** Target file is `src/assets/content-images/mn140.svg`, built as a single SVG (no merge script). This document specifies the complete layout, section content, icon assignments, and `buildIconsManifest.ts` updates.

The diagram visualizes MN 140's doctrinal arc: a person is analytically deconstructed into six elements + six contact fields + eighteen explorations + four foundations → each seen as "not mine, not I, not my self" → consciousness is purified → equanimity refined like gold → the formless bases are recognized as conditioned (saṅkhata) and bypassed → liberation through non-fabrication.

---

### Final output target

| Property | Value |
|----------|-------|
| File | `src/assets/content-images/mn140.svg` |
| Dimensions | `viewBox="0 0 920 3100"` (height finalized after section heights are summed) |
| Background | Reuse `bg` gradient: `#0b1528` → `#0e1a30` → `#101e36` |
| Build | Single SVG, no merge script. Sections built top-to-bottom with named `<g id transform="translate(...)">` |
| Text density | Medium-high. Short English + selective Pali anchors. All Pali direct Unicode, no escaping. |
| Font | `Georgia, 'Times New Roman', serif` throughout |

---

### Top-level section layout

```xml
<g id="header"               transform="translate(0, 0)">       <!-- ≈150px -->
<g id="setting"              transform="translate(0, …)">       <!-- ≈180px -->
<g id="central-formula"      transform="translate(0, …)">       <!-- ≈160px -->
<g id="six-elements"         transform="translate(0, …)">       <!-- ≈530px -->
<g id="six-contact-fields"   transform="translate(0, …)">       <!-- ≈280px -->
<g id="eighteen-explorations" transform="translate(0, …)">      <!-- ≈300px -->
<g id="four-foundations"     transform="translate(0, …)">       <!-- ≈340px -->
<g id="consciousness-fire"   transform="translate(0, …)">       <!-- ≈280px -->
<g id="goldsmith-formless"   transform="translate(0, …)">       <!-- ≈420px -->
<g id="nibbana-footer"       transform="translate(0, …)">       <!-- ≈220px -->
```

Final Y-offsets computed during implementation after each section's height is known. Total ≈ 2860px content + 30px gaps between each of 9 sections = ~3130px. Round viewBox height to **3100** and adjust on final render.

---

### Phase 1 — Header

- Title: `MN 140 — DHĀTUVIBHAṄGA SUTTA` — 22px bold `#c8a040`, letter-spacing 3
- Subtitle: `Exposition on the Elements` — 15px italic `#708090`
- Rule at y≈78, x 260–660, `#a09070` opacity 0.3
- English tagline (12px italic `#90c0b0`): *"A person consists of six elements, six contact fields, eighteen explorations, established in four ways"*
- Pali tagline (11px italic `#708878`, opacity 0.8): `cha dhāturo ayaṁ puriso, cha phassāyatano, aṭṭhārasa manopavicāro, caturādhiṭṭhāno`
- Decorative ambient ellipse, low opacity

---

### Phase 2 — Setting (Narrative Card)

Single full-width card (~860×140), `rx=8`, soft fill. Purpose: frame the discourse as a live, unplanned teaching.

Three rows:
1. **Going forth in faith** — *"Pukkusāti, a householder's son, went forth from home based on faith in the Blessed One"* — `bhagavantaṁ uddissa saddhāya agārasmā anagāriyaṁ pabbajito`
2. **Incognito meeting** — *"The Blessed One, unrecognized, entered the potter's workshop at Rājagaha and sat in meditation beside him"*
3. **The question** — *"For whom have you gone forth? Who is your teacher? Whose Dhamma do you approve of?"*

Icon: `meditation-seat` — placed at right edge of card, representing the seated Pukkusāti (and the unknown teacher beside him).

No elaborate card — just three short lines establishing context. This card should feel like a footnote, not a chapter.

---

### Phase 3 — Central Formula Band

Gold-tinted horizontal band across full 920 width (~140px). This is the teaching summary — the formula that the entire discourse unpacks.

- Heading: `THE TEACHING IN BRIEF` — 11px small caps gold
- Central statement: *"Where conceptual proliferations do not flow → the sage is said to be at peace"*
- Pali: `yattha ṭhitaṁ maññassavā nappavattanti — muni santoti vuccati`
- Below: four equal segments (~200px wide each) as a visual summary strip:

| Segment | Label | Pali |
|---------|-------|------|
| 1 | Six Elements | `cha dhātuyo` |
| 2 | Six Contact Fields | `cha phassāyatanā` |
| 3 | Eighteen Explorations | `aṭṭhārasa manopavicārā` |
| 4 | Four Foundations | `caturādhiṭṭhānā` |

Visual: four small colored boxes with gold dividers between them, labeled top (number) and bottom (Pali). Resembles a compact summary bar — the "map key" the reader refers back to.

Four imperatives listed below the segments (one per segment, in the discourse's own order):
`paññaṁ nappamajjeyya · saccamanurakkheyya · cāgamanubrūheyya · santimeva so sikkheyyā`

---

### Phase 4 — Six Elements

**Tier label:** `SIX ELEMENTS · CHA DHĀTUYO` — 12px bold gold, tier line

This is the doctrinal core. Six rows, each ~75px tall. Each row = icon + element name (EN + Pali) + short inner-form example + the "not mine" refrain.

**Not-mine formula** — appears as italic gold text at the end of every row (rows 1–5):
> `taṁ netaṁ mama, nesohamasmi, na meso attā`

This is a meditation instruction the reader is meant to absorb through visual repetition. Do not collapse it into a shared footer; the repetition is doctrinally intentional.

| Row | Element | Pali | Inner examples (abbreviated) | Icon |
|-----|---------|------|------------------------------|------|
| 1 | Earth | `pathavīdhātu` | hair, nails, teeth, skin, flesh, bones | `earth` |
| 2 | Water | `āpodhātu` | bile, phlegm, blood, sweat, fat, tears, lymph, urine | `water` |
| 3 | Fire | `tejodhātu` | warming, aging, consuming food, digesting | `fire` |
| 4 | Wind | `vāyodhātu` | upward winds, downward winds, belly winds, in-breath and out-breath | `air` |
| 5 | Space | `ākāsadhātu` | ear canals, nostrils, mouth, digestive tract | `space-base` |
| 6 | Consciousness | `viññāṇadhātu` | *(treated separately — pointer → Phase 8)* | `consciousness-base` |

**Row 6 (Consciousness):** Unlike rows 1–5, consciousness is not dismissed with "not mine" in this section. Show the name and icon, with a visual dashed arrow pointing downward labeled *"treated in detail below"*. The "not mine" refrain does **not** appear on row 6.

**Inner/outer distinction:** Each row shows the subtle note `ajjhattika · bāhirā` (inner · outer) in small muted text. The key teaching: internal element = external element in nature; both seen with wisdom as "not mine."

**Row background fill:** subtle dark fill (`#0e1e38`) with a left-edge color accent per element family — ochre (earth), blue (water), ember/orange (fire), sage (wind), pale indigo (space), gold (consciousness).

---

### Phase 5 — Six Contact Fields

**Tier label:** `SIX FIELDS OF CONTACT · CHA PHASSĀYATANĀ`

Six compact cards in a **2-row × 3-column grid** (~260×80 each), with Pali label under the English name:

| Card | English | Pali | Icon |
|------|---------|------|------|
| 1 | Eye contact field | `cakkhusamphassāyatana` | `seen` |
| 2 | Ear contact field | `sotasamphassāyatana` | `heard` |
| 3 | Nose contact field | `ghānasamphassāyatana` | `sense-nose` |
| 4 | Tongue contact field | `jivhāsamphassāyatana` | `sense-tongue` |
| 5 | Body contact field | `kāyasamphassāyatana` | `sensed` |
| 6 | Mind contact field | `manosamphassāyatana` | `cognized` |

Cards: uniform neutral fill (`#0e1a30` + `#304060` border stroke), no color coding. This section is brief — the sense fields are the *medium* through which explorations arise, not the focus themselves.

---

### Phase 6 — Eighteen Mental Explorations

**Tier label:** `EIGHTEEN EXPLORATIONS · AṬṬHĀRASA MANOPAVICĀRĀ`

A **3-column × 6-row table** with column headers:

| | Joy · *somanassa* (×6) | Grief · *domanassa* (×6) | Equanimity · *upekkhā* (×6) |
|--|----------------------|--------------------------|------------------------------|
| Eye | sees form → joy | sees form → grief | sees form → equanimity |
| Ear | hears sound → joy | … | … |
| Nose | smells → joy | … | … |
| Tongue | tastes → joy | … | … |
| Body | touches → joy | … | … |
| Mind | cognizes idea → joy | … | … |

**Column header styling:**
- Joy (somanassa): gold `#c8a040` header, warm fill
- Grief (domanassa): burgundy `#a06070` header, cooler fill
- Equanimity (upekkhā): slate `#7888a0` header, neutral fill

Row labels (Eye, Ear, etc.) on left in small text; cell content is minimal — feeling-tone label per cell. Small badge `6 + 6 + 6 = 18` in the top-right corner of the section. No icons inside table cells — color coding + text carries the structure.

---

### Phase 7 — Four Foundations

**Tier label:** `FOUR FOUNDATIONS · CATURĀDHIṬṬHĀNA`

Four equal cards in a **2×2 grid** (~400×130 each), each showing: foundation name (EN + Pali), the imperative from the discourse, and icon:

| Card | Foundation | Pali | Imperative | Icon |
|------|-----------|------|-----------|------|
| 1 | Wisdom | `paññā` | *"Don't neglect wisdom"* · `paññaṁ nappamajjeyya` | `discernment-lens` |
| 2 | Truth | `sacca` | *"Guard truth"* · `saccamanurakkheyya` | `knowledge-vision` |
| 3 | Relinquishment | `cāga` | *"Cultivate relinquishment"* · `cāgamanubrūheyya` | `non-belonging-scatter` |
| 4 | Peace | `upasama` | *"Train for peace"* · `santimeva so sikkheyyā` | `cessation-vessel` |

**Note on `non-belonging-scatter`:** This icon's description is "unconnected dot with dispersed lines — netaṁ mama," making it a near-perfect semantic match for cāga (relinquishment / "not mine").

Card styling: gold border (`#c8a040` at 0.3 opacity), dark fill, icon at left edge (~40px box), text to the right.

---

### Phase 8 — Consciousness Element & Feeling (The Pivot)

**Tier label:** `CONSCIOUSNESS ELEMENT · VIÑÑĀṆADHĀTU`

This section closes the six-elements analysis (row 6 from Phase 4) and introduces the consciousness + feeling + contact relationship.

**Left panel (~420px wide):** Consciousness knows feeling

- Title: *"Pure, radiant consciousness"*
- Three feeling rows:
  1. Pleasant contact → pleasant feeling: `sukhavedaniyaṁ phassaṁ → sukhā vedanā`
  2. Painful contact → painful feeling: `dukkhavedaniyaṁ phassaṁ → dukkhā vedanā`
  3. Neutral contact → neutral feeling: `adukkhamasukhavedaniyaṁ phassaṁ → adukkhamasukhā vedanā`
- Each row: small arrow `→` between contact and feeling
- The wise practitioner's response: `sā aniccā · anajjhositā · anabhinanditā` — *"it is impermanent, not clung to, not delighted in"*

**Right panel (~420px wide):** The fire-sticks simile

- Title: *"Just as fire arises from friction…"*
- Top: `friction-sticks-heat` icon — two sticks rubbed → heat arises → feeling arises from contact
- Bottom: `sticks-separated-heat` icon — sticks separated → heat ceases → feeling ceases when contact ceases
- Pali anchor: `dvinnaṁ kaṭṭhānaṁ saṅghaṭṭā samodhānā usmā jāyati · tesaṁyeva nānābhāvā vinikkhepā sā nirujjhati sā vūpasammati`
- Closing note: *"In the same way, feeling arises dependent on contact and ceases when contact ceases"*

Gold vertical divider at x=460 between the two panels.

---

### Phase 9 — The Goldsmith Simile + Formless Bases

**Tier label:** `THE GOLDSMITH · SUVAṆṆAKĀRŪPAMĀ`

This is the doctrinal turning point. The mind is like refined gold — pure, radiant, malleable, luminous. The practitioner *could* direct it to the formless attainments. But the wise practitioner sees those as fabricated (`saṅkhataṁ`) and does not go there.

**Top card — The Goldsmith (~140px):**
- Full-width card, warm gold-tinted fill (`#1a1808` + gold stroke)
- Title: *"Remaining equanimity: pure, refined, radiant, malleable, luminous"*
- Pali: `upekkhāyeva avasissati parisuddhā pariyodātā mudu ca kammaññā ca pabhassarā ca`
- Simile line: *"Like gold worked by a skilled goldsmith — purified in the forge, freed of dross, fit to be worked into any ornament"* · `suvaṇṇakāro vā suvaṇṇakārantevāsī vā`
- Icon: `bowl-gleaming` at left edge (purified, luminous vessel — closest available icon for the refined/gleaming quality of worked gold)
- If `goldsmith-crucible` is created (see new icons section), use it here instead

**Middle band — The Fork (~40px):**
- A dotted gold arc splitting into two paths: left (dashed) = "could be directed to formless" → right (solid gold) = "chooses not to"
- Left path label: `saṅkhataṁ` — *"fabricated/conditioned"* — muted gray italic
- Right path label: `neva taṁ abhisaṅkharoti` — *"does not fabricate"* — gold, emphasized

**Bottom grid — Four Formless Bases (~200px, 2×2):**
- Each card: formless base icon + name (EN + Pali) + brief gloss
- All four overlaid with a muted `saṅkhataṁ` watermark label (gray italic, low opacity)
- Connecting dashed arc from goldsmith card into this grid shows the *potential* path the practitioner bypasses

| Card | Base | Pali | Icon |
|------|------|------|------|
| 1 | Boundless space | `ākāsānañcāyatana` | `space-base` |
| 2 | Boundless consciousness | `viññāṇañcāyatana` | `consciousness-base` |
| 3 | Nothingness | `ākiñcaññāyatana` | `nothingness-base` |
| 4 | Neither perception nor non-perception | `nevasaññānāsaññāyatana` | `neither-base` |

Below all four cards, centered: `saṅkhatametaṁ` — *"This is fabricated"* — muted, italic. This is the exact word the discourse uses to dismiss all four attainments.

---

### Phase 10 — Nibbāna + Footer

**Liberation card (~140px):** Gold radial glow. Three stacked lines:

1. *"Not fabricating, not intending becoming or un-becoming"* — `neva taṁ abhisaṅkharoti, na abhisañcetayati bhavāya vā vibhavāya vā`
2. *"Not clinging, not trembling; individually fully quenched"* — `na kiñci loke upādiyati, anupādiyaṁ na paritassati, paccattaṁyeva parinibbāyati`
3. Bold: *"Birth is ended, the spiritual life has been lived, what was to be done has been done, there is no more of this"* — `khīṇā jāti, vusitaṁ brahmacariyaṁ, kataṁ karaṇīyaṁ, nāparaṁ itthattāyā`

Icons: `liberation-sparkle` at upper left, `defilements-ended` at right.

**Footer:** `wordsofthebuddha.org/mn140` → `https://wordsofthebuddha.org/mn140`, lotus motif centered.

---

### Design-system icons used (all reused from existing library)

**Six Elements:**

| Icon ID | Element |
|---------|---------|
| `earth` | pathavīdhātu |
| `water` | āpodhātu |
| `fire` | tejodhātu |
| `air` | vāyodhātu |
| `space-base` | ākāsadhātu (repurposed from formless base icon — visual kinship intentional) |
| `consciousness-base` | viññāṇadhātu (repurposed; formal treatment deferred to Phase 8) |

**Six Contact Fields:**

| Icon ID | Field |
|---------|-------|
| `seen` | cakkhusamphassāyatana |
| `heard` | sotasamphassāyatana |
| `sense-nose` | ghānasamphassāyatana |
| `sense-tongue` | jivhāsamphassāyatana |
| `sensed` | kāyasamphassāyatana |
| `cognized` | manosamphassāyatana |

**Four Foundations:**

| Icon ID | Foundation |
|---------|-----------|
| `discernment-lens` | paññā |
| `knowledge-vision` | sacca |
| `non-belonging-scatter` | cāga ("not mine" — near-exact semantic match) |
| `cessation-vessel` | upasama |

**Consciousness & Feeling:**

| Icon ID | Role |
|---------|------|
| `friction-sticks-heat` | fire-sticks simile: contact → feeling arises |
| `sticks-separated-heat` | fire-sticks simile: contact ceases → feeling ceases |

**Goldsmith + Formless:**

| Icon ID | Role |
|---------|------|
| `bowl-gleaming` | purified, luminous equanimity metaphor (goldsmith simile) |
| `space-base` | ākāsānañcāyatana |
| `consciousness-base` | viññāṇañcāyatana |
| `nothingness-base` | ākiñcaññāyatana |
| `neither-base` | nevasaññānāsaññāyatana |

**Nibbāna:**

| Icon ID | Role |
|---------|------|
| `liberation-sparkle` | liberation sparkle |
| `defilements-ended` | āsavakkhaya, cetovimutti |

**Setting:**

| Icon ID | Role |
|---------|------|
| `meditation-seat` | Pukkusāti seated in the potter's workshop |

---

### New icon proposed (optional, recommended)

**`goldsmith-crucible`**

- **Description:** Small crucible over a stylized flame with a molten-gold drip — suvaṇṇakāra simile; represents purified equanimity as worked, refined gold
- **Labels:** `elements`, `simile`, `formless`
- **Discourse:** `"mn140"`
- **Valence:** `"+ve"`
- **Geometry guidance:** 80×80 on shared canvas; line-art, strokes in `#c8a040`/`#daa520` — a simple crucible silhouette on a small triangular flame, with a single drop descending. Stroke-width 1.2, `stroke-linecap="round"`.

If not created, `bowl-gleaming` is the fallback and the goldsmith simile is conveyed primarily through text. This is acceptable — the doctrinal content lives in the words, not the icon.

---

### `buildIconsManifest.ts` discourse updates

Add `"mn140"` to the `discourse` array of each entry below. Where the current value is a plain string, convert to an array first.

| Entry ID | Current discourse | Action |
|----------|------------------|--------|
| `earth` | `["mn1", "mn77"]` | append `"mn140"` |
| `water` | `["mn1", "mn77"]` | append `"mn140"` |
| `fire` | `["mn1", "mn77"]` | append `"mn140"` |
| `air` | `["mn1", "mn77"]` | append `"mn140"` |
| `space-base` | `["mn1", "mn9", "mn25", "mn6", "mn111", "mn77"]` | append `"mn140"` |
| `consciousness-base` | `["mn1", "mn25", "mn6", "mn111", "mn77"]` | append `"mn140"` |
| `nothingness-base` | `["mn1", "mn106", "mn25", "mn6", "mn111", "mn77"]` | append `"mn140"` |
| `neither-base` | `["mn1", "mn106", "mn25", "mn6", "mn111", "mn77"]` | append `"mn140"` |
| `seen` | `["mn1", "mn47", "mn148", "mn10"]` | append `"mn140"` |
| `heard` | `["mn1", "mn47", "mn148", "mn10", "mn95"]` | append `"mn140"` |
| `sensed` | `["mn1", "mn148"]` | append `"mn140"` |
| `cognized` | `["mn1", "mn9", "mn148", "mn10"]` | append `"mn140"` |
| `sense-nose` | `["mn148", "mn10"]` | append `"mn140"` |
| `sense-tongue` | `["mn148", "mn10"]` | append `"mn140"` |
| `friction-sticks-heat` | `["sn36.10", "mn9"]` | append `"mn140"` |
| `sticks-separated-heat` | `"sn36.10"` | convert to `["sn36.10", "mn140"]` |
| `bowl-gleaming` | `"mn5"` | convert to `["mn5", "mn140"]` |
| `meditation-seat` | `["mn6", "mn111"]` | append `"mn140"` |
| `discernment-lens` | `["mn6", "mn9", "mn111", "mn77", "mn95"]` | append `"mn140"` |
| `knowledge-vision` | `["mn77", "mn95"]` | append `"mn140"` |
| `non-belonging-scatter` | `"mn106"` | convert to `["mn106", "mn140"]` |
| `cessation-vessel` | `["mn25", "mn111", "mn77"]` | append `"mn140"` |
| `liberation-sparkle` | `["an10.1", "mn9", "mn111"]` | append `"mn140"` |
| `defilements-ended` | `["mn39", "mn119", "mn25", "mn6", "mn111", "mn77"]` | append `"mn140"` |

If `goldsmith-crucible` is created, add a new entry block in the source. After all changes, regenerate: `npx tsx src/utils/buildIconsManifest.ts`.

---

### Decisions

- **Single file, no merge script.** Follows the mn26 precedent; simplifies implementation for a discourse of this length.
- **Consciousness (row 6 in Phase 4) is held open.** Unlike elements 1–5, consciousness is not dismissed with "not mine" in the elements section. It is a pointer to Phase 8 where the feeling/contact mechanism is explained. This matches MN 140's actual structure — the discourse elaborates consciousness at length separately.
- **No jhāna band.** MN 140 does not teach the jhānas. The formless section is reached directly through refined equanimity (`upekkhā`), not via jhāna progression. Adding a jhāna band would misrepresent the discourse.
- **Setting card included but minimal.** Brief (~180px) — frames the discourse as a live teaching to a faith-practitioner, distinguishing it from a formal training manual.
- **18 explorations as a color table.** A 3-column × 6-row color-coded table is cleaner than 18 individual cards. Color carries the joy/grief/equanimity structure; no icons in cells.
- **`saṅkhataṁ` overlay on formless bases.** All four formless cards get a muted `saṅkhataṁ` watermark. The dashed arc from the goldsmith card visually shows the potential path; the label explains why it is not taken.
- **`non-belonging-scatter` for cāga.** The icon's own description references `netaṁ mama` — the central "not mine" formula of MN 140. This semantic match should be acknowledged in the card label.

---

### Verification

1. Open `mn140.svg` in a browser and confirm all 10 sections render without overflow at 920px width
2. Verify all Pali text renders as direct Unicode — no HTML entity escaping (`ā` not `&#257;`); spot-check: `ā`, `ī`, `ū`, `ñ`, `ṁ`, `ṭ`, `ṇ`, `ḷ`
3. Confirm the "not mine" formula `taṁ netaṁ mama, nesohamasmi, na meso attā` appears on exactly rows 1–5 of Phase 4, and is absent from row 6
4. Confirm `saṅkhataṁ` label is visible on all four formless base cards in Phase 9
5. Run `npx tsx src/utils/buildIconsManifest.ts` — should complete without errors and report the updated icon count
6. Check `mn140` appears in the discourse array for all 24 icons listed in the manifest update table above
7. Verify the footer link `wordsofthebuddha.org/mn140` is a clickable `<a>` element pointing to `https://wordsofthebuddha.org/mn140`
