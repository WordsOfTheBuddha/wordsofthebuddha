## Plan v2: SVG Diagram for MN 26 (Pāsarāsi Sutta — The Noble Quest)

**Status — rethink. Start a fresh build of `src/assets/content-images/mn26.svg`, reusing only the parts called out below from v1.** The previous draft had three structural problems: weak iconography on the two-quest contrast, biographical-but-low-signal teacher cards, and an awakening card that did not actually carry the discourse's key insight. The "beyond Māra" section was also re-implemented when MN 25 already has a polished, correct version that should be used verbatim.

The revision below treats MN 26 as a single doctrinal arc: *what kind of seeking actually leads to nibbāna?* — and uses the autobiographical material as evidence in that argument, not as a biography in its own right.

---

### Final output target

| Property | Value |
|----------|-------|
| File | `src/assets/content-images/mn26.svg` |
| Dimensions | **920 wide; height TBD after section heights are summed** (start at `0 0 920 2800`, adjust) |
| Background | Reuse v1 `bg` gradient + ambient ellipses |
| Build | Single SVG file. No merge script. |
| Text density | Medium. Short English + selective Pali anchors. |
| Transform discipline | Every section AND every repeated row gets a named `<g id transform="translate(...)">`. No exceptions. |

---

### Top-level section layout

```xml
<g id="header"               transform="translate(0, 0)">
<g id="two-quests"           transform="translate(0, …)">
<g id="going-forth"          transform="translate(0, …)">
<g id="two-teachers"         transform="translate(0, …)">
<g id="awakening-attainment" transform="translate(0, …)">   <!-- 1 of 2 awakening cards -->
<g id="awakening-knowledge"  transform="translate(0, …)">   <!-- 2 of 2 awakening cards -->
<g id="brahma-appeal"        transform="translate(0, …)">
<g id="beyond-mara"          transform="translate(0, …)">   <!-- verbatim from MN25 -->
<g id="footer"               transform="translate(0, …)">
```

Final translate offsets are computed during implementation after each section's height is known. Implementation rule: build each section in isolation, then stack with explicit translates — do not interleave geometry across sections.

---

### Phase 1 — Header (reuse from v1, lightly tightened)

- Title: `MN 26 — PĀSARĀSI SUTTA`
- Subtitle: `The Noble Quest`
- Tagline: *"Seeking the unborn, unsurpassed security from bondage"*
- Pali anchor: `ajātaṁ anuttaraṁ yogakkhemaṁ nibbānaṁ pariyesati`
- The two figure icons (`puthujjana-header`, `ariya-header`) **stay in the header** as a small framing motif. Keep them subtle.

Reuse from v1: yes, with minor opacity/positioning polish.

---

### Phase 2 — Two Quests (rework)

Same six-row contrast structure as v1, but **change the column-header icons**:

| Column | Icon (was) | Icon (now) |
|--------|-----------|-----------|
| Ignoble Quest · `anariyā pariyesanā` | `tangle-unwise-attention` | **`puthujjana-header`** |
| Noble Quest · `ariyā pariyesanā` | `wise-attention` | **`ariya-header`** |

These figure icons map directly to *who* is doing the seeking, which is the actual contrast MN 26 draws (a person subject to birth seeks what is also subject to birth, vs. a person who, *seeing the drawback*, seeks the unborn). The earlier "attention" icons gestured at a related but different teaching.

To strengthen the contrast beyond just relabelling icons, add a **single connecting band above the two cards** that names the hinge MN 26 uses to flip ignoble → noble:

> *Having understood the drawback (`ādīnavaṁ viditvā`), seeks the unsurpassed security from bondage.*

Visually: a thin gold dotted arc from the ignoble column header into the noble column header, passing through a small label `ādīnavaṁ viditvā`. This makes the diagram say *what changes between the two columns*, not just *that they differ*.

Six-row content (unchanged in spirit, copy-edited):

| # | Ignoble (subject to … seeks …) | Noble (sees drawback, seeks …) |
|---|-------------------------------|--------------------------------|
| 1 | birth → the born | the **unborn** · `ajātaṁ` |
| 2 | aging → what ages | the **unaging** · `ajaraṁ` |
| 3 | illness → what sickens | the **unailing** · `abyādhiṁ` |
| 4 | death → what dies | the **deathless** · `amataṁ` |
| 5 | sorrow → what brings sorrow | the **sorrowless** · `asokaṁ` |
| 6 | defilement → what is defiled | the **undefiled** · `asaṅkiliṭṭhaṁ` |

Optional refinement: include MN 26's concrete examples of "what one seeks" on the ignoble side as a single muted line under the card title — *"children, spouse, servants, livestock, gold and silver — all subject to birth, aging, illness, death."* This grounds the abstract list in the discourse's own imagery and is something v1 dropped.

Reuse from v1: card geometry, row geometry, six rows of text, Pali anchors. Replace icons. Add the `ādīnavaṁ viditvā` hinge band. Add the optional "acquisitions" line.

---

### Phase 3 — Going Forth (reframe)

The v1 "Going Forth" card highlighted biographical detail (young, black hair, parents wept). That is not why this section is in the discourse. MN 26 places the going forth at the exact moment the Bodhisatta *applies the noble-quest insight to himself*. The card needs to show that move.

New framing: a single full-width card that reads as a turning point, not a biographical aside. Three short stacked rows.

1. **Realisation.** *"Why am I, being subject to birth, seeking what is also subject to birth?"* — `kiṁ nu kho ahaṁ jātidhammo samāno jātidhammaṁ pariyesāmi?`
2. **Resolve.** *"Suppose, having understood the drawback, I seek the unborn, unsurpassed security from bondage."* — `ajātaṁ anuttaraṁ yogakkhemaṁ nibbānaṁ pariyeseyyaṁ`
3. **Going forth.** *"Then, while still young, with black hair … I shaved off my hair and beard, put on the ochre robes, and went forth into homelessness."* — `agārasmā anagāriyaṁ pabbajiṁ`

Visual: three small numbered nodes inside one card, with an arrow from row 1 → row 2 → row 3. The card title is **"The Noble Search Begins"**, not "Going Forth", because the going-forth is the *result*, not the topic.

Icons:
- v1 `bowl-robe` icon stays, but **only as a small mark on row 3 (the actual going-forth)**, not as the card hero.
- No icon on rows 1 and 2 — keep them text-led so the realisation reads as words, not symbol.
- Future asset wishlist (not blocker): `perceive-drawback` (a lens revealing a flaw inside a pleasant object), `noble-quest-unborn` (open ascending path).

Reuse from v1: nothing structural. The card is rebuilt. The `bowl-robe` icon geometry is copied exactly from the icon file.

---

### Phase 4 — Two Teachers (rework with the right key takeaway)

The v1 cards listed steps "quickly learns / realises base / invited to lead". That is the *form* of the encounter, not the *teaching*. MN 26's actual point is a doctrinal verdict the Bodhisatta delivers about each attainment. The cards need to surface that verdict.

Card structure (same shape for both teachers, two rows each):

```
┌─────────────────────────────────────────┐
│  Āḷāra Kālāma             [icon]        │
│  ────────────────────────────────────   │
│  ▸ Attained the highest his teacher     │
│    knew: the Base of Nothingness        │
│    ākiñcaññāyatana                      │
│                                         │
│  ▸ Saw the limit, and departed:         │
│    "This Dhamma does not lead to        │
│     disenchantment, dispassion,         │
│     cessation, peace, direct knowledge, │
│     awakening, nibbāna —                │
│     only to reappearance in this base." │
│    nāyaṁ dhammo nibbānāya saṁvattati,   │
│    yāvadeva ākiñcaññāyatanūpapattiyā    │
└─────────────────────────────────────────┘
```

Same template for Uddaka Rāmaputta with **Base of Neither Perception nor Non-Perception** / `nevasaññānāsaññāyatana`.

This makes the takeaway explicit: *the most refined samādhi attainments available outside the Buddha's path stop at rebirth in subtle realms — they do not deliver nibbāna.* That is the doctrinally important fact MN 26 is asserting, and it is the bridge to why the awakening section that follows matters.

Icons:
- Āḷāra Kālāma: **`nothingness-base`** — keep as-is. Geometry copied exactly from `src/assets/content-images/design-system/icons/nothingness-base.svg`. (v1 was correct.)
- Uddaka Rāmaputta: **`neither-base`** — copied exactly from `src/assets/content-images/design-system/icons/neither-base.svg`. v1 used a different inline geometry that did not match the library asset; that is the icon to fix.

Drop the v1 "step 1 / step 2 / step 3" numbered list. Drop the dedicated "Not final: reappearance only" sub-card; merge that verdict directly into row 2 of the main card so the limitation is shown in the same breath as the attainment.

Reuse from v1: card shell (gradient, stroke, shadow filter), Pali anchors. Replace Uddaka's icon with the exact library `neither-base.svg`. Replace the steps list with the two-row attain → verdict structure.

---

### Phase 5 — Awakening (split into two cards)

Replace v1's single "Full Awakening at Uruvelā" card with two stacked cards. They sit side-by-side, mirroring the "Two Quests" pair earlier in the diagram so the reader recognises the visual rhyme: *the noble quest, completed.*

#### 5a. Awakening as attainment — **"At Uruvelā, the noble quest fulfilled"**

A six-row mini-table that mirrors the noble-quest column from Phase 2 exactly, but each row is in the past tense of attainment:

| # | Attained |
|---|----------|
| 1 | the unborn · `ajātaṁ … nibbānaṁ ajjhagamaṁ` |
| 2 | the unaging · `ajaraṁ … ajjhagamaṁ` |
| 3 | the unailing · `abyādhiṁ … ajjhagamaṁ` |
| 4 | the deathless · `amataṁ … ajjhagamaṁ` |
| 5 | the sorrowless · `asokaṁ … ajjhagamaṁ` |
| 6 | the undefiled · `asaṅkiliṭṭhaṁ … ajjhagamaṁ` |

Icon: small `liberation-sparkle` in the corner. The visual payoff is that the reader sees the *same six rows* from the top of the diagram, now resolved.

#### 5b. Awakening as knowledge — **"And he knew it was final"**

A second card carrying the *ñāṇadassana* statement. Three short lines:

> Knowledge and vision arose: · *ñāṇañca pana me dassanaṁ udapādi*
> "My liberation is unshakeable." · *akuppā me vimutti*
> "This is my final birth; now there is no renewed existence." · *ayamantimā jāti, natthi dāni punabbhavo*

Icon: `defilements-ended` (or none — likely cleaner without).

Reuse from v1: the `liberation-sparkle` icon geometry, the gold-tinted card gradient, the Pali typography style. Drop the v1 mixed card.

---

### Phase 6 — Brahmā's Appeal (keep largely as v1)

Keep the v1 `brahma-appeal` card in place and structure. It already conveys the right point. Two small refinements only:

1. Add one short line at the top stating the Buddha's initial inclination: *"My mind inclined toward being unconcerned, not toward teaching."* — `appossukkatāya cittaṁ namati, no dhammadesanāya`. Without this line the card reads as *"Brahmā encouraged him"* in isolation; with it, the card reads as *the resolution of a real hesitation*, which is what MN 26 actually shows.
2. Keep the three-lotus motif. Optionally label the three lotus heights with one-word cues drawn from the discourse: *immersed*, *at the surface*, *risen clear* — the `apparajakkha`/`mahārajakkha` faculties contrast.

Reuse from v1: the entire card, the lotus-beings group, the closing "doors to the Deathless are open" line.

---

### Phase 7 — Beyond Māra's sight (verbatim from MN 25)

Do not reauthor this section. **Copy the corresponding group from `src/assets/content-images/mn25.svg` verbatim** — full geometry, text, icon references, internal transforms, gradient IDs — and only adjust the outermost wrapping `<g transform="translate(...)">` to position it in MN 26's vertical layout. If MN 25 references gradients (`jhana1Grad`, `formless1`–`formless4`, `cessationGrad`) that aren't already in MN 26's `<defs>`, copy those defs over too, with the same IDs.

This covers:

- the four jhānas (with `jhana-first`, `jhana-second`, `jhana-third`, `jhana-fourth` icons)
- the four formless bases (with `space-base`, `consciousness-base`, `nothingness-base`, `neither-base` icons)
- cessation of perception and feeling
- the closing "beyond Māra's reach" liberation row (with `defilements-ended` icon)

Implementation rule: **no edits to the inner content** of this band. Only adjust the outer translate. If something looks misaligned in MN 26's context, fix it by adjusting the *outer* translate or by repositioning the section above/below it — never by editing the copied content.

Reuse from v1: nothing. Discard v1's reimplementation of this band.

---

### Phase 8 — Footer (reuse from v1)

`wordsofthebuddha.org/mn26` link, lotus motif. Unchanged.

---

### What to reuse from v1, what to discard

**Reuse:**
- `<defs>` block (gradients, filters)
- Header section (Phase 1)
- Two-quests card geometry and six-row layout (Phase 2) — replace icons, add the `ādīnavaṁ viditvā` hinge band, optionally add the "acquisitions" line
- The `bowl-robe` icon geometry (used differently, as a small mark in Phase 3)
- The Brahmā appeal card and its lotus-beings group (Phase 6)
- The footer (Phase 8)

**Discard / replace:**
- v1 "Going Forth" card → rebuilt as Phase 3 "The Noble Search Begins"
- v1 teacher cards' step lists and "Not final" sub-card → rebuilt as Phase 4's two-row attain → verdict cards
- v1 single "Full Awakening at Uruvelā" card → split into Phases 5a + 5b
- v1 entire "Beyond Māra's sight" reimplementation → replaced by verbatim copy from MN 25 (Phase 7)

---

### Existing icon IDs used in implementation

When reused, each source icon's internal geometry is copied exactly from `src/assets/content-images/design-system/icons/<id>.svg`. Only an outer wrapper transform/opacity/filter is added.

- `puthujjana-header` (header + two-quests ignoble column header)
- `ariya-header` (header + two-quests noble column header)
- `bowl-robe` (Phase 3, small mark on the going-forth row)
- `nothingness-base` (Phase 4 Āḷāra; Phase 7 formless row 7)
- `neither-base` (Phase 4 Uddaka; Phase 7 formless row 8) — **must match library geometry exactly**
- `liberation-sparkle` (Phase 5a corner mark)
- `defilements-ended` (Phase 7 liberation row)
- `jhana-first`, `jhana-second`, `jhana-third`, `jhana-fourth` (Phase 7, copied via MN 25)
- `space-base`, `consciousness-base` (Phase 7, copied via MN 25)

Removed from the v1 list: `tangle-unwise-attention`, `wise-attention` (replaced by figure icons in Phase 2).

---

### New line-art icons to consider later (not blockers)

| Suggested ID | Need | Spec |
|--------------|------|------|
| `noble-search-begins` | Phase 3 hero | Figure pausing at threshold, small lens overlaid on the household side |
| `perceive-drawback` | Phase 2 hinge band | Lens revealing a crack inside a pleasant object |
| `quest-fulfilled` | Phase 5a corner | Six small dots (one per "a-" attainment) resolving into a single point |
| `brahma-appeal-lotus` | Phase 6 | Three lotus levels with beings at different faculties |

---

### Verification checklist

- All sections and all repeating rows are wrapped in named transform groups.
- The two-quest icons are `puthujjana-header` and `ariya-header` (not the attention icons).
- The going-forth card leads with the *realisation*, not the biography.
- Each teacher card surfaces the doctrinal verdict (`nāyaṁ dhammo nibbānāya saṁvattati …`), not the encounter steps.
- The `neither-base` icon's inline geometry matches the library SVG byte-for-byte.
- The awakening side is two cards: six-row attainment table + ñāṇadassana statement.
- The Brahmā card opens with the "inclined toward being unconcerned" line.
- The "beyond Māra" band is a verbatim copy of the MN 25 group; no inner edits.
- On-canvas text is traceable to MN 26 EN/Pali source.
- No visible overlap or clipping at the final viewBox.
- Typography, palette, tier dividers, card radii, glows, and footer match the existing discourse-image family.

---

### v2.1 amendments (post-implementation edits applied to the final SVG)

These are differences between the v2 plan above and the shipped `mn26.svg`. Future plans for related discourses should treat these as the canonical decisions.

#### Phase 1 — Header
- The two figure icons (`puthujjana-header` / `ariya-header`) were **removed** from the header. They are present only in the two-quests column headers (Phase 2). The header is text-only.

#### Phase 2 — Two Quests: hinge band
- The hinge band label was changed to **"SEEING THE DRAWBACK"** (present participle, more active than the original "SEES THE DRAWBACK").
- Two small **directional chevron arrows** were added on the arc, one on each side, pointing toward the noble column, using `<path d="M -4 -4 L 0 0 L 4 -4">` with a `rotate()` transform. This reinforces the arc's direction of travel (ignoble → noble).
- The hinge rectangle was expanded to `200 × 42` to accommodate two text lines with comfortable padding; both lines sit visibly inside the box.

#### Phase 2 — Two Quests: column cards
- Column header icons are wrapped in a sub-group `<g id="quest-ignoble-header" transform="translate(80, 0)">` so the icon and the text block share a single translate and can be repositioned together.
- Card height increased to **340** (from 332) to give the sixth row a little breathing room.

#### Phase 3 — Noble Search Begins
- The `bowl-robe` icon was placed on **row 1 (Realization)**, not row 3 (Going forth) as originally planned. The reasoning: the going-forth is the downstream consequence; the bowl-and-robe already encodes the outcome visually, and placing it at the first row signals that what follows is the monk's path from the start.
- The down-arrow connectors between rows are clean **vertical lines + chevrons** (`<line>` + `<path>`) centered on `x=46` (the circle column), not the `+`-shaped cross-connectors specified. This gives a cleaner reading direction.
- The card height is **260** (fits three rows with the revised connector placement).

#### Phase 4 — Two Teachers
- Section title changed to **"TWO TEACHERS · ATTAINMENT AND SUBSEQUENT DEPARTURE"** (more descriptive than "ATTAIN, THEN DEPART").
- All text within teacher cards uses **`text-anchor="middle"` at `x=190`** (card half-width), not left-aligned at `x=22`. This centers content within each 380-wide card, which reads better for the two-line verdict block.
- Card height reduced to **242** (was 290) — no wasted space below the verdict block.
- Āḷāra icon: `translate(316, 10) scale(2.0)` with inner `scale(1.45655) translate(-10,-10)`.
- Uddaka icon: **standardized to exact library `neither-base.svg` geometry** — uses the same `scale(1.45655) translate(-10,-10)` inner wrapper as the nothingness-base pattern, with two concentric `r=7` circles (one solid at `stroke-width="0.5" opacity="0.5"`, one dashed `stroke-width="0.3" stroke-dasharray="1,3"`). Outer: `translate(316, 10) scale(2)`.

#### Phase 5 — Awakening (knowledge card)
- Replaced `filter="url(#glow1)"` on the key statements with **left accent bars** (thin vertical `<rect>` elements, `width=3.5`, gold for "unshakeable liberation", soft blue for "final birth"). Rationale: glow filters do not survive thermal-print or high-contrast export; accent bars convey emphasis stably.
- Text colors and sizes adjusted slightly: `#e0d8b0` / `font-size="12.6"` for the liberation line, `#d8e4f0` / `font-size="12.4"` for the final-birth couplet.

#### Phase 6 — Brahmā's Appeal: lotus illustration
- The lotus motif was redesigned with a **real water body**: a tinted fill rectangle, two wavy surface `<path>` lines, three subtle ripple marks. The three lotuses are positioned *relative to the water surface* — submerged (closed bud below the line), at the surface (touching the wave), risen clear (well above). This is textually grounded in MN 26 §21 (`udakaṁ accuggamma ṭhitāni anupalittāni udakena`).
- The lotus group was shifted up to `translate(420, 110)` inside the card so it occupies the space beside the Brahmā text rather than below it.
- The card height was reduced to **230** (was 260) and the "Doors to the Deathless are open" line moved to `y=216`, stripping the glow filter.

#### No new library icons
No new icons were added to the icon library for this diagram. The lotus illustration in Phase 6 is inline diagram geometry (not a reusable icon). Future wishlist items (`brahma-appeal-lotus`, `noble-search-begins`, etc.) remain as listed above.

#### Unicode quotes convention (now in DESIGN-LANGUAGE.md)
All quoted speech inside `<text>` elements uses **Unicode curly/typographic quotes** (`"…"`), not ASCII straight quotes. This applies to English and transliterated Pali. See `DESIGN-LANGUAGE.md § Quoted text in SVG elements`.
