## Plan: SVG Diagram for MN 25 (Nivāpa Sutta — Bait)

**Status — implemented.** Target file: `src/assets/content-images/mn25.svg`. Single-file build (no parts-based merge).

The diagram illustrates MN 25's deer-trapper simile: four herds with escalating strategies to escape Māra's bait, mapped 1:1 to four kinds of ascetics, culminating in jhānas, formless attainments, and cessation as "where Māra cannot go."

---

### Final output

| Property | Value |
|----------|-------|
| File | `src/assets/content-images/mn25.svg` |
| Dimensions | **920×2400** (`viewBox="0 0 920 2400"`) |
| Background | `linearGradient` `bg`: `#0b1528` → `#0e1a30` (45%) → `#101e36`; three low-opacity decorative ellipses at ~(460, 300), (460, 900), (460, 1700) |
| Build | Single file, every section + sub-group wrapped in `<g transform="translate(…)">` |

---

### Discourse structure

MN 25 uses a deer-trapper simile to explain how beings fall under Māra's control and how to escape:

- **Trapper's mechanism** — bait → infatuation → intoxication → negligence → control
- **Four herds** (mapped 1:1 to four kinds of ascetics):
  1. Rush in infatuated → trapped
  2. Abstain entirely → starve → return → trapped
  3. Make lair nearby → eat carefully → found by stake-nets → trapped
  4. Make lair beyond trapper's reach → trapper gives up → FREE
- **Simile decoded** — bait = five sense pleasures, trapper = Māra, herds = ascetics
- **Where Māra cannot go** — 4 jhānas, 4 formless bases, cessation of perception & feeling → defilements ended

---

### Section layout (transform groups)

```
<g id="header"        transform="translate(0, 0)">        0–150
<g id="mechanism"     transform="translate(0, 150)">      150–260
<g id="four-herds"    transform="translate(0, 266)">      266–1090
  <g id="herd-1"      transform="translate(0, 42)">
  <g id="herd-2"      transform="translate(0, 224)">
  <g id="herd-3"      transform="translate(0, 418)">
  <g id="herd-4"      transform="translate(0, 628)">
<g id="simile-key"    transform="translate(0, 1090)">    1090–1210
<g id="blinding-mara" transform="translate(0, 1232)">    1232–2340
  <g id="jhanas"       transform="translate(0, 68)">
  <g id="formless"     transform="translate(0, 576)">
  <g id="cessation"    transform="translate(0, 874)">
  <g id="liberation"   transform="translate(0, 948)">
<g id="footer"        transform="translate(0, 2350)">    2350–2400
```

---

### Canvas and global style

- Font: `Georgia, 'Times New Roman', serif`
- Pali: direct Unicode (ā, ī, ū, ñ, ṁ, ṅ, ṇ, ṭ, ḷ)
- Standard effects: `tierGrad`, `shadowDrop`, `iconGlow`, `glow1`, `glow2`
- Burgundy (`#a06070` / `#c07060`) for trapped outcomes (herds 1–3)
- Teal (`#60a088` / `#80c0a0`) for herd 4's freedom
- Gold (`#c8a040`) for tier labels, spines, liberation glow

---

### Phase 1 — Header (y 0–150)

`<g id="header" transform="translate(0, 0)">`

- Title: `MN 25 — NIVĀPA SUTTA` — 22px bold `#c8a040`, letter-spacing 3, x=460 `text-anchor="middle"`
- Subtitle: `Bait` — 15px italic `#90a0b8`
- Rule: y≈78, x 280–640, `#a09070` @ 0.3 opacity
- Tagline EN (12px italic `#90c0b0`): *"The fourth herd made their lair where the deer-trapper and his entourage could not go"*
- Tagline PL (11px italic `#708878`, opacity 0.8): *yattha agati nevāpikassa ca nevāpikaparisāya ca tatrāsayaṁ kappayiṁsu*
- Decorative background ellipse under taglines: ~(460, 140), low opacity

---

### Phase 2 — Trapper's Mechanism Chain (y 150–260)

`<g id="mechanism" transform="translate(0, 150)">`

Horizontal flow diagram showing the chain of entrapment.

- Tier line + label: `THE TRAPPER'S MECHANISM · NEVĀPIKASSA UPĀYA` (12px bold gold, letter-spacing 2, ~0.75 opacity)
- 5 nodes connected by arrows, centered horizontally:

```
[Bait]  →  [Infatuation]  →  [Intoxication]  →  [Negligence]  →  [Under Control]
nivāpa     mucchitā           mada               pamāda           yathākāmakaraṇīya
```

- Each node: rounded rect (widths 120 / 130 / 130 / 130 / 190 × height 50, `rx=6`) with EN label + Pali italic below
- Arrows: horizontal lines + small triangular arrowheads
- First 4 nodes: neutral fill (`cardNeutral`); last node "Under Control": red-tinted fill (`cardTrapRed`)
- Inline bait motif beside the first node: central dot + five radiating lines (sense pleasures), not a separate named symbol ref

---

### Phase 3 — Four Herds / Four Kinds of Ascetics (y 260–1060)

`<g id="four-herds" transform="translate(0, 266)">`

- Tier line + label: `FOUR HERDS OF DEER · CATTĀRO MIGAJĀTĀ` (12px bold gold, letter-spacing ~2, ~0.75 opacity)
- Sub-label: `Four Kinds of Ascetics and Brahmins · cattāro samaṇabrāhmaṇā`

Each herd = **combined card** (left=deer simile, right=ascetic parallel) with **outcome badge**.

Card width 760, `rx=8`, `filter="url(#shadowDrop)"`. Heights: herd 1 **160**, herd 2 **172**, herd 3 **188**, herd 4 **172**. Gold vertical divider at x≈460.

**Cards 1–3**: `fill="url(#cardTrap)"` (burgundy-tinted), stroke `#a06070`
**Card 4**: `fill="url(#cardFree)"` (teal-tinted), stroke `#60a088`

#### Card 1 — First Herd: Indulgence

`<g id="herd-1" transform="translate(0, 42)">`

- **Number:** circled Arabic **1** stroke `#c07060`
- **Inline icon:** Vortex/spiral paths + accent lines (rushing in) — embedded in file (cf. `herd-rushing-in`)
- **Left — Simile:** *Ate the bait rushing in, infatuated with it* → *became intoxicated → fell into negligence → trapped*
  - PL: *anupakhajja mucchitā bhojanāni bhuñjiṁsu*
- **Right — Ascetic:** heading *First Ascetics*; *Enjoyed Māra's bait and the baits of the world*; *rushing in and infatuated → Māra did as he wished*
  - PL: *nivāpaṁ nivuttaṁ mārassa amūni ca lokāmisāni*
- **Outcome:** ✗ — EN line *Failed to get free from Māra's power and control* + PL `na parimucciṁsu mārassa iddhānubhāvā` (burgundy)

#### Card 2 — Second Herd: Extreme Abstinence

`<g id="herd-2" transform="translate(0, 224)">`

- **Number:** circled Arabic **2** stroke `#c07060`
- **Inline icon:** Bare-branch tree — embedded in file (barren-tree motif; not pulled from `tree-barren` asset)
- **Left — Simile:** *Abstained entirely from the bait — fled to the forest* → grass and water ran out → extreme emaciation → strength and energy failed → returned to the bait
  - PL: *araññāyatanāni ajjhogāhetvā … balavīriyaṁ parihāyi*
- **Right — Ascetic:** *Subsisted on austerities in the forest region* + italic list *greens · millet · bark · grass · cow dung · fallen fruits*; *Bodies emaciated → deliverance of mind lost → returned to that very bait*
  - PL: *cetovimutti parihāyi … nivāpaṁ nivuttaṁ mārassa paccāgamiṁsu*
- **Outcome:** ✗ — same EN + PL pattern as card 1

#### Card 3 — Third Herd: Mindful but Visible

`<g id="herd-3" transform="translate(0, 418)">`

- **Number:** circled Arabic **3** stroke `#c07060`
- **Inline icon:** Shelter circle + dashed rectangular stake-net frame — embedded in file (cf. `herd-visible-lair`)
- **Left — Simile:** *Made a lair close to the bait — ate carefully,* not rushing in / not infatuated / not intoxicated; **then** trapper surrounded **bait** with **stake-nets** → found
  - PL: *āsayaṁ kappayiṁsu … daṇḍavākarāhi anuparivāresuṁ* (as drawn; sutta has fuller phrasing)
- **Right — Ascetic:** heading *Third Ascetics*; *Dwelt near the world's pleasures mindfully,* not infatuated — **but** held **speculative views:**
  - Compact 2-line précis (diagram abbreviates the full ten):
    - *"The world is eternal / not eternal / finite / infinite"*
    - *"Life force = body / ≠ body" · "Tathāgata after death: exists / does not exist"*
  - PL: *evaṁdiṭṭhikā ahesuṁ — sassato loko itipi …*
- **Outcome:** ✗ — EN *Failed to get free — the net of views kept them within Māra's domain* + PL `na parimucciṁsu mārassa iddhānubhāvā`

#### Card 4 — Fourth Herd: Beyond Reach ✓

`<g id="herd-4" transform="translate(0, 628)">`

- **Number:** circled Arabic **4** stroke `#80c0a0`
- **Inline icon:** Dashed boundary + offset shelter circle + gold accent ticks — embedded in file (cf. `herd-beyond-reach`)
- **Left — Simile:** *Made lair where the trapper cannot go* → ate carefully, not infatuated; *trapper could not find them* (italic)
  - PL line as in sutta for unreachable lair appears in header; card emphasizes *yattha agati* theme in body copy
- **Right — Ascetic:** *Dwelt where Māra and his entourage cannot go*; ate bait not rushing in; not intoxicated → not negligent → Māra gave up
  - PL: *yattha agati mārassa ca māraparisāya ca*
- **Outcome:** ✓ — EN *Got free from Māra's power and control* + PL `parimucciṁsu mārassa iddhānubhāvā` (teal + `glow1` on headline)

---

### Phase 4 — Simile Key / Decoding (y 1090–1210)

`<g id="simile-key" transform="translate(0, 1090)">`

- Tier line + label: `THE MEANING · ATTHO`
- Wide card (~760×90, `cardNeutral` fill) with **two columns × two rows** (Bait / Trapper's entourage on row 1; Deer-trapper / Herds on row 2):

| Simile term | = | Meaning | Pali |
|-------------|---|---------|------|
| Bait (nivāpa) | = | Five cords of sensual pleasure | pañcannaṁ kāmaguṇānaṁ |
| Deer-trapper (nevāpika) | = | Māra the Evil One | māra pāpimant |
| Trapper's entourage (nevāpikaparisā) | = | Māra's assembly | māraparisā |
| Herds of deer (migajātā) | = | Ascetics and brahmins | samaṇabrāhmaṇā |

---

### Phase 5 — Blinding Māra / Where Māra Cannot Go (y 1232–2340)

`<g id="blinding-mara" transform="translate(0, 1232)">`

- Tier line + label: `WHERE MĀRA CANNOT GO · AGATI MĀRASSA`
- Refrain (italic, smaller): *"has blinded Māra, gone beyond the Evil One's sight, becoming invisible to him"*
- PL: *andhamakāsi māraṁ, apadaṁ vadhitvā māracakkhuṁ adassanaṁ gato pāpimato*

#### 5a — Four Jhānas: Nested Rectangles (MN 39 layout; MN 25 text & similes)

`<g id="jhanas" transform="translate(0, 68)">`

Nested rectangles (inset ~30px per level, only outermost filled). **Corner art is MN 25's bath/water/lotus/cloth similes**, drawn inline — not the small `jhana-first`…`jhana-fourth` icons from the design-system manifest.

| Jhāna | x | y | width | height | rx | stroke | Corner note |
|-------|---|---|-------|--------|----|--------|-------------|
| 1st (outer) | 70 | 0 | 780 | **490** | 8 | `#c8a040` @ ~0.42 | *kneading powder* caption |
| 2nd | 100 | 92 | 720 | **383** | 8 | `#78a890` @ ~0.55 | *underground spring* |
| 3rd | 130 | 202 | 660 | **258** | 8 | `#aab8c8` @ ~0.55 | *submerged lotus* |
| 4th (inner) | 160 | 312 | 600 | **133** | 8 | `#d0d8e0` @ ~0.65 | *covered… white cloth* (two-line caption) |

Copy follows MN 25's extended formulas (e.g. first jhāna: savitakka/savicāra, vivekaja/pītisukha; fourth: sukha/dukkha abandonment, adukkhamasukha, etc.).

#### 5b — Four Formless Attainments (outside jhāna nesting)

`<g id="formless" transform="translate(0, 576)">`

Subtle separator line at top of block. Four stacked cards with **stepped** horizontal inset (x = 100 / 110 / 120 / 130, widths 720 / 700 / 680 / 660), height **58**, `rx=7`, graduated fills (`formless1`–`formless4`). Full Pali quote lines in italic under each title.

| # | Attainment | Icon (embedded) |
|---|-----------|-----------------|
| 5 | Base of Boundless Space | `space-base` pattern |
| 6 | Base of Boundless Consciousness | `consciousness-base` pattern |
| 7 | Base of Nothingness | `nothingness-base` pattern |
| 8 | Base of Neither Perception Nor Non-Perception | `neither-base` pattern |

Card anatomy: number circle at left (5→8), EN title, Pali italic, icon at right edge (~0.55 opacity).

Graduated fills (diagonal linearGradients continuing warmth progression):
- `formless1`: `#1a2838` → `#14202e`
- `formless2`: `#1e2c34` → `#18242a`
- `formless3`: `#222e2c` → `#1c2624`
- `formless4`: `#28302a` → `#222822`

#### 5c — Cessation of Perception & Feeling

`<g id="cessation" transform="translate(0, 874)">`

- **Card #9:** 640×56, x≈140, `rx=8`, fill `url(#cessationGrad)`, gold stroke @ ~0.5
- Number circle: **9**
- EN: *Cessation of Perception and What Is Felt*
- PL: *saññāvedayitanirodhaṁ upasampajja viharati*
- Icon: **inline** small figure/vessel motif (ellipse + dashed “absent” lines) — not `defilements-ended`

#### 5d — Liberation (below cessation card)

`<g id="liberation" transform="translate(0, 948)">`

- Elliptical `libGlow` behind content
- Rect ~620×100, same warm gradient family as cessation, gold-tint stroke
- Line 1–2: *Having seen with wisdom…* / *paññāya cassa disvā āsavā parikkhīṇā honti*
- Divider, then bold closing: *He has crossed over entanglement in the world* / *tiṇṇo loke visattikan*
- Twin-orb / defilements-ended **style** icon at right (inline paths, paired ellipses)

---

### Phase 6 — Footer (y 2350–2400)

`<g id="footer" transform="translate(0, 2350)">`

- Rule: x 300–620, `#304058` @ 0.3
- Clickable link: `wordsofthebuddha.org/mn25` → `https://wordsofthebuddha.org/mn25`
- Lotus motif: `translate(460, 36) scale(0.25)` (same petal paths as mn5-style footer)

---

### Defs block

**Gradients:**
- `bg` — vertical background gradient
- `tierGrad` — horizontal gold line (fade at edges)
- `cardTrap` — diagonal, dark-burgundy tinted (`#201420` → `#181018`)
- `cardTrapRed` — diagonal red-tint for mechanism's final node (`#2a1418` → `#1e0e14`)
- `cardFree` — diagonal, dark-teal tinted (`#162836` → `#101e2c`)
- `cardNeutral` — diagonal, neutral slate (`#182234` → `#121a2a`)
- `cessationGrad` — warm olive (`#2e3020` → `#282818`) for cessation + liberation cards
- `jhana1Grad` — diagonal, deep navy (`#182234` → `#141e2c`)
- `formless1`–`formless4` — graduated diagonal fills
- `conclusionGlow` — radial, gold, low opacity
- `libGlow` — radial, gold `#ffd700` for liberation apex

**Filters:**
- `glow1` (stdDev 3), `glow2` (stdDev 6) — hierarchy of halos
- `iconGlow` (stdDev 2) — for small icons
- `shadowDrop` — `feDropShadow` dy=2, stdDev=4, flood #000 @ 0.4

---

### Design-system icons

#### Embedded / manifest-style artwork (as in file)

| Phase | Art | Role |
|-------|-----|------|
| 5b | `space-base`, `consciousness-base`, `nothingness-base`, `neither-base` | Formless row icons (paths embedded with transforms) |
| 5d | Twin-orb motif | Liberation block (same visual language as `defilements-ended`) |

#### Drawn inline in `mn25.svg` (not manifest IDs)

| Area | Content |
|------|---------|
| Mechanism | Five-line bait radiants beside first node |
| Herds 1–4 | Rushing spiral, barren tree, stake-net lair, beyond-reach boundary |
| 5a Jhānas | Bath/kneading, spring, submerged lotus, cloth/orb simile illustrations + captions |
| 5c Cessation | Small vessel / “absent activity” glyph |

Optional later extraction to named icons (`herd-rushing-in`, `herd-beyond-reach`, etc.) remains compatible with the drawn shapes.

---

### Key text excerpts

**Header tagline:** *"The fourth herd made their lair where the deer-trapper and his entourage could not go"*

**Mechanism chain:** Bait → Infatuation → Intoxication → Negligence → Under Control

**Herd 4 (diagram):** emphasizes unreachable lair, careful eating, and Māra giving up; does **not** quote the long *ajjhupekkhiṁsu* passage on-canvas (that line remains valid sutta context).

**Blinding Māra refrain:** *"has blinded Māra, gone beyond the Evil One's sight, becoming invisible to him"* / *andhamakāsi māraṁ, apadaṁ vadhitvā māracakkhuṁ adassanaṁ gato pāpimato*

**Liberation block:** *Having seen with wisdom…* / *paññāya cassa disvā āsavā parikkhīṇā honti*; then *"He has crossed over entanglement in the world"* / *tiṇṇo loke visattikan*

---

### Decisions

- **Single file** over parts-based merge
- **Combined herd+ascetic cards** — each row shows deer simile alongside decoded ascetic meaning
- **Jhānas 1–4: MN 39-style nested rectangles** (inset ~30px per level, only outermost filled); **MN 25 simile illustrations** at corners instead of stock `jhana-*` manifest icons
- **Formless 1–4: separate stacked cards outside jhāna nesting** with stepped widths and full Pali lines
- **Cessation** is a compact card; **liberation** is a separate group below with `libGlow`, wisdom line, then world-crossing closing
- **Herd + mechanism motifs** drawn inline; optional extraction to named icons afterward
- **Herd 3's "stake-nets" visually parallel speculative views** — views keep them within Māra's discoverable domain
- MN 25's jhāna block pairs **full formula text** with **inline simile vignettes** (kneading powder, spring, lotus, cloth) — unifying thread remains the refrain *"has blinded Māra"*

---

### Source files

- `src/assets/content-images/mn25.svg` — target output
- `src/assets/content-images/mn5.svg` — reference: card layouts, flow arrows, footer
- `src/assets/content-images/mn39.svg` — reference: jhāna nested rectangles
- `src/assets/content-images/an10.1.svg` — reference: stgN graduated fills
- `src/assets/content-images/design-system/icons-manifest.json` — icon registry
- `src/assets/content-images/design-system/DESIGN-LANGUAGE.md` — style rules
- `src/content/en/mn/mn25.mdx` — English translation source
- `src/content/pli/mn/mn25.md` — Pali source

---

### Verification checklist

- [ ] All text readable at 100% zoom, no overlapping sections
- [ ] Each section's `translate()` moves all children as a unit
- [ ] Existing icons render correctly when embedded
- [ ] Pali diacritics render correctly (ā, ī, ū, ñ, ṁ, ṅ, ṇ, ṭ, ḷ)
- [ ] viewBox height **2400** matches actual content bottom edge
- [ ] Footer link resolves to `https://wordsofthebuddha.org/mn25`
- [ ] After icon extraction: `npm run validate:icons` passes
