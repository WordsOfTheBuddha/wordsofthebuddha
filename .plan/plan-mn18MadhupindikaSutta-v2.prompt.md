## Plan v2: SVG Diagram for MN 18 (Madhupiṇḍika Sutta — Honey Ball)

**Status — implemented.** Target file: `src/assets/content-images/mn18.svg`. Single-file build. Auto-discovered by filename — no MDX or manifest edits needed.

### What changed from v1

| v1 | v2 |
|----|----|
| 6-column × 7-row grid (42-cell table) | Two parallel single-door chains (eye + mind) + compact …pe… strip for the other four |
| No narrative frame | *(v2 draft had a Daṇḍapāṇi framing card; removed in final — diagram opens on the pivotal condition)* |
| Pivotal condition as mid-card callout | Gold gateway band separating chains from split contrast |
| Single breaking-chain panel | Full split-column contrast (sn36.6 pattern): proliferating vs. non-proliferating |
| Seven anusaya as one Pali string | Seven labeled rows with English + Pali aligned at `x=172`, each showing cessation |
| Designation (paññatti) wrongly mapped to noble disciple | Split contrast shows **proliferation divergence** — contact continues for both; proliferation overwhelms on one side only |
| Small honey ball section with honey-pure icon | Enlarged, warm amber card; new `honey-ball` icon (sphere only, no drip) |
| `tangle-unwise-attention` at convergence | New `mental-proliferation` icon (burgundy triple-conduct + tangle) |

---

### Final output target

| Property | Value |
|----------|-------|
| File | `src/assets/content-images/mn18.svg` |
| Dimensions | `viewBox="0 0 920 1820"` |
| Background | `bg` gradient: `#0b1528 → #0e1a30 → #101e36` |
| Ambient ellipses | Two decorative ellipses: burgundy-tint at upper-left (`cx=230 cy=500`), teal-tint at upper-right (`cx=690 cy=500`) — foreshadowing the split |
| Build | Single file, no merge script |
| Font | `Georgia, 'Times New Roman', serif` throughout |
| Transform discipline | Every top-level section in a named `<g id="…" transform="translate(…)">` |

---

### Reference templates

| Pattern | Source SVG |
|---------|-----------|
| Split panel: left burgundy / right teal | `sn36.6.svg` — two-dart split (left `x=40 w=408`, right `x=472 w=408`, divider at `x=460`) |
| Tier label + multiple left/right tiers | `mn113.svg` — asappurisa vs. sappurisa tiers |
| Vertical thought-chain with flows | `mn19.svg` — two kinds of thoughts cascade |
| Parallel left/right chains converging | `mn29.svg`, `mn30.svg` — paired discourse structure |
| Panel gradients + radial glow | `sn22.81.svg` — `amberGlow` for honey-ball card |
| Six-column sense-base icons, same x-positions | `mn148.svg` — used as geometry reference only |

---

### Section layout (final y-offsets)

```xml
<g id="header"           transform="translate(0, 0)">      <!-- ≈140px -->
<g id="pivot-keystone"   transform="translate(0, 148)">    <!-- ≈140px -->
<g id="chains"           transform="translate(0, 302)">    <!-- ≈520px -->
<g id="gate-band"        transform="translate(0, 836)">    <!-- ≈76px  -->
<g id="split-contrast"   transform="translate(0, 922)">    <!-- ≈326px -->
<g id="anusaya-cease"    transform="translate(0, 1262)">  <!-- ≈277px -->
<g id="honey-ball"       transform="translate(0, 1554)">   <!-- ≈208px -->
<g id="footer"           transform="translate(0, 1768)">   <!-- ≈52px  -->
```

**Note:** The v2 draft included a `framing` section (Daṇḍapāṇi encounter). It was removed in the final build; the diagram begins with header → pivotal condition → cascade.

---

### Phase 1 — Header

- Title: `MN 18 — MADHUPINDIKA SUTTA` — 22px bold `#a0b0c8`, letter-spacing 3
- Subtitle: `Honey Ball` — 15px italic `#708090`
- Rule at y≈78
- Epigraph EN (13px italic `#90a0b8`): *"I teach in such a way that one does not quarrel with anyone in this world."*
- Epigraph PL (11px italic `#7888a0`): `yathāvādī na kenaci loke viggayha tiṭṭhati`

---

### Phase 2 — The Pivotal Condition (keystone card)

Full-width card (~860×130), gold-tinted fill (`keystoneGrad` + `#c8a040` stroke at 0.5 opacity, `shadowDrop`). This is the structural keystone — the cascade above shows the process; the split below shows what happens on either side of the gate.

- Small caps label: `THE PIVOTAL CONDITION · YATONIDĀNAṀ` — 10px gold, letter-spacing 2
- Opening line (12px italic `#b0c0d0`): *"As to the source from which perceptions and notions born of mental proliferation overwhelm a person"*
- Highlighted box (`#c8a040` fill at 0.07): *"— If nothing is found there to delight in, welcome, and fixate on —"*
- Pali of the condition (10.5px italic `#a08830`): `Ettha ce natthi abhinanditabbaṁ abhivaditabbaṁ ajjhositabbaṁ`
- Closing (11.5px italic `#90a0b0`): *just this is the end of the underlying tendencies." · esevanto rāgānusayānaṁ…*

This card is referenced visually again at Phase 4 (gate band) — the same Pali phrase appears both here and as the gate label.

---

### Phase 3 — The Six-Door Cascade

**Tier label:** `THE SIX-DOOR CASCADE · MAHĀKACCĀNA'S ELABORATION` — 10px bold gold

Two parallel vertical chains, side by side, with a narrow center column for the …pe… abbreviation.

#### Layout geometry

```
x=30..420     x=440..480    x=500..890
LEFT CHAIN    pe-column     RIGHT CHAIN
eye door      4 icons       mind door
(full)        + labels      (full)
```

#### Left chain — Eye door (header: `seen` icon, label: `EYE DOOR`)

Seven nodes connected by short downward arrows (`stroke="#405060" stroke-opacity="0.5"`):

| Node | English | Pali | Style |
|------|---------|------|-------|
| 1 | Eye + form | `cakkhu + rūpa` | gold sub-header |
| 2 | Eye-consciousness | `cakkhuviññāṇa` | neutral |
| 3 | Contact | `phassa · tiṇṇaṁ saṅgati phasso` | taller node |
| 4 | Felt experience | `vedanā` | neutral |
| 5 | Perception | `saññā` | neutral |
| 6 | Thought | `vitakka` | neutral |
| 7 | Mental proliferation | `papañceti` | burgundy tint |

Each node: rounded rect (~390px wide, ~40–46px tall), centered at x=225.

#### Center column — …pe… (x=440..480)

Four sense-base icons stacked vertically at `x=449`, one every ~57px, with English labels below each:
- `heard` — EAR
- `sense-nose` — NOSE
- `sense-tongue` — TONGUE
- `sensed` — BODY

Each icon 22×22, opacity 0.45. Vertical dashed line (`stroke="#2a3a4a" stroke-dasharray="2,4" opacity="0.45"`). Label above: `…pe…` in 12px italic `#4a6070`.

#### Right chain — Mind door (header: `cognized` icon, label: `MIND DOOR`)

Same seven-node structure, centered at x=695.

| Node | English | Pali |
|------|---------|------|
| 1 | Mind + mental object | `mano + dhamma` |
| 2 | Mind-consciousness | `manoviññāṇa` |
| 3 | Contact | `phassa · tiṇṇaṁ saṅgati phasso` |
| 4 | Felt experience | `vedanā` |
| 5 | Perception | `saññā` |
| 6 | Thought | `vitakka` |
| 7 | Mental proliferation | `papañceti` |

#### Convergence node (below both chains, centered)

Both chains converge via diagonal lines to a central node (~760px wide, ~52px):
- Fill: burgundy-tinted (`#1e0c12`, stroke `#a06070` at 0.6, `shadowDrop`)
- EN: *"Mental proliferation overwhelms a person"*
- PL: `papañcasaññāsaṅkhā samudācaranti purisaṁ`
- **`mental-proliferation` icon** at left (`x=280`, 40×40, `iconGlow`)

---

### Phase 4 — Gate Band (the pivotal condition as a visual barrier)

A horizontal gold band (~860×76), full width, sitting directly below the convergence node.

```
──────── gold keyline ────────────────────────────────────────
  — If nothing is found there to delight in, welcome, and fixate on —
  ettha ce natthi abhinanditabbaṁ abhivaditabbaṁ ajjhositabbaṁ
──────── gold keyline ────────────────────────────────────────
                              ▼
```

- Two gold horizontal rules (`#c8a040`, opacity 0.4), one above and one below the text
- Inner rect (`#181408` fill) behind text
- English (11px italic `#a0b0c8`) above Pali (11px italic gold) — order reversed from v2 draft
- Below the band: chevron `▼` (muted `#405060`, centered)

---

### Phase 5 — Split Contrast

Full-width two-panel split, following the `sn36.6.svg` pattern:
- Left panel: `x=40 width=408 rx=8`, fill `url(#patternLeft)`, stroke `#5a3848`
- Right panel: `x=472 width=408 rx=8`, fill `url(#patternRight)`, stroke `#2a5868`
- Gold divider at `x=460`
- Tier label: `THE DIVERGENCE · TWO RESPONSES TO THE SAME PROCESS`

**Doctrinal accuracy (final):** Both panels share contact through thought. The divergence is whether **mental proliferation** takes hold — not whether contact exists. MN 18 does not name `assutavā puthujjano` / `sutavā ariyasāvako`; these headers are pedagogical shorthand for the delight/fixation contrast (`abhinanditabbaṁ… ajjhositabbaṁ`). Mahākaccāna's separate `phassapaññatti` analysis (when sense bases are absent vs. present) is **not** illustrated here — it concerns logical designation, not the noble disciple lacking contact while alive.

#### Left panel — Uninstructed ordinary person

Header (10.5px bold letter-spacing 1.5 `#a08090`): `UNINSTRUCTED ORDINARY PERSON`
Subtitle (9.5px italic `#706070`): `assutavā puthujjano`

Icon: `tangle-unwise-attention` (`i-tangle`) at left edge, 28×28, opacity 0.55

Three beats:

1. *delights in · welcomes · fixates on* — `abhinandati · abhivadati · ajjhosāya tiṭṭhati`
2. Middle box (56px tall):
   - *contact → feeling → perception → thought*
   - **→ mental proliferation overwhelms** (bold)
   - `papañceti · papañcasaññāsaṅkhā samudācaranti`
3. Result box:
   - *underlying tendencies reinforced* — `anusayā anuseṭi`
   - *quarrels, disputes, slander, lies arise*

#### Right panel — Disciple of the Noble Ones

Header (10.5px bold letter-spacing 1.5 `#6898a0`): `DISCIPLE OF THE NOBLE ONES`
Subtitle (9.5px italic `#487888`): `sutavā ariyasāvako`

Icon: `wise-attention` (`i-wise`) at left edge, 28×28, opacity 0.65

Three beats:

1. *does not delight in · does not welcome · does not fixate on* — `nābhinandati · nābhivadati · nājjhosāya tiṭṭhati`
2. Middle box (56px tall):
   - *contact → feeling → perception → thought* (contact still occurs)
   - **proliferation does not arise** (bold teal)
   - `ettha ce natthi abhinanditabbaṁ… ajjhositabbaṁ` (Buddha's pivot formula)
3. Result box with `liberation-sparkle` (`i-sparkle`) icon:
   - *underlying tendencies do not arise* — `anusayā nānuseṭi`

---

### Phase 6 — Seven Anusaya Cease

**Tier label:** `SEVEN UNDERLYING TENDENCIES · SATTĀNUSAYĀ` — 10px bold gold

Intro line: *"When there is nothing to fixate on, all seven cease without remainder:"*

Seven rows in a compact list, each row ~26px tall, `translate(100, …)`:

| # | English | Pali (`x=172`) | Note |
|---|---------|----------------|------|
| 1 | desire | `rāgānusaya` | ceases ✓ |
| 2 | aversion | `paṭighānusaya` | ceases ✓ |
| 3 | views | `diṭṭhānusaya` | ceases ✓ |
| 4 | doubt | `vicikicchānusaya` | ceases ✓ |
| 5 | conceit | `mānanusaya` | ceases ✓ |
| 6 | passion for existence | `bhavarāgānusaya` | ceases ✓ |
| 7 | ignorance | `avijjānusaya` | ceases ✓ |

Each row: numbered circle (r=10) at left, English (11.5px bold `#80b8a8`), Pali (10.5px italic `#507868` — **all aligned at x=172**), teal "ceases ✓" at right (`x=640` text-anchor end).

Below the seven rows, a closing line in italics:
*"…along with taking up sticks, disputes, arguments, accusations, slander, and lies —"*
— `etthete pāpakā akusalā dhammā aparisesā nirujjhanti`

---

### Phase 7 — The Honey Ball

**Tier label:** `THE HONEY BALL · MADHUPIṆḌIKĀ` — 10px bold gold

Full-width card (~860×205), warm amber-tinted fill (`#1a1406` + `#c8a040` stroke at 0.4 opacity, `shadowDrop`).

- `amberGlow` radial ellipse behind icon (`cx=460 cy=75 rx=120 ry=90`)
- **Honey-ball icon** centered and large (80×80 at `x=420 y=40`, `glow1` filter) — see icon spec below
- Simile text (12.5px italic `#c8d8e8`):
  *"Just as a man exhausted by hunger comes across a honey ball. Wherever he tastes it, he gets a delicious, unadulterated flavor."*
- Outcome (12px bold italic `#c8a040`):
  *"Similarly, investigating this Dhamma with wisdom, one would find joyful satisfaction and gain mental clarity."*
- Naming line (10.5px italic `#a08838`):
  *Thus this Dhamma discourse is called "The Honey Ball" — madhupiṇḍikā*

---

### Phase 8 — Footer

- Rule `x=300` to `x=620`, `#304058` at 0.3
- Clickable link: `wordsofthebuddha.org/mn18` → `https://wordsofthebuddha.org/mn18` (`target="_blank"`)
- Lotus motif: `translate(460, 40) scale(0.25)` — four petal paths + center circle

---

### New icon: `honey-ball`

**ID:** `honey-ball`
**File:** `design-system/icons/honey-ball.svg`

**Why a new icon:** `honey-pure` shows a honey *drop* falling into a vessel — it represents the *quality* of honey. The MN 18 simile describes a honey *ball* — a rounded mass one can taste from any direction. The shape communicates inexhaustible sweetness; a drop does not.

**Final geometry (24×24 viewBox) — sphere only, no drip:**
```svg
<circle cx="12" cy="10" r="7.5" fill="#c88200" fill-opacity="0.55"
  stroke="#c88200" stroke-width="1.1"/>
<path d="M 9 7 Q 10.5 5.5, 13 7" stroke="#ffe8a0" stroke-width="0.65"
  fill="none" stroke-linecap="round" opacity="0.75"/>
<path d="M 8 9 Q 9.5 8, 11 9" stroke="#ffe8a0" stroke-width="0.45"
  fill="none" stroke-linecap="round" opacity="0.5"/>
```

**Manifest entry:**
```typescript
{
  id: "honey-ball",
  title: "Honey ball",
  description: "Compact sphere — madhupiṇḍika simile; the Dhamma is sweet wherever tasted",
  discourse: "mn18",
  tags: ["line-art", "gold", "simile"],
  labels: ["simile", "well-being"],
  valence: "+ve",
}
```

---

### New icon: `mental-proliferation`

**ID:** `mental-proliferation`
**File:** `design-system/icons/mental-proliferation.svg`
**Inline symbol:** `i-proliferation`

**Why a new icon:** Proliferation in MN 18 is not mere tangling (`tangle-unwise-attention`) — it is the triple-conduct triangle (body · speech · mind) overtaken by a central tangle, in burgundy (`#a06070`). Based on `triple-purity.svg` with frayed mind radiance, curved inter-vertex links, and a scaled tangle path at center.

**Manifest entry:**
```typescript
{
  id: "mental-proliferation",
  title: "Mental proliferation",
  description: "Triple conduct triangle with central tangle — papañcasaññāsaṅkhā overwhelm",
  discourse: "mn18",
  tags: ["burgundy", "line-art", "conduct"],
  themes: ["harm", "wisdom"],
}
```

---

### Icons used (inline symbols from `design-system/icons/<id>.svg`)

| Icon ID | Symbol | Role |
|---------|--------|------|
| `seen` | `i-seen` | Eye-door chain header |
| `cognized` | `i-cognized` | Mind-door chain header |
| `heard` | `i-heard` | …pe… strip: ear door |
| `sense-nose` | `i-sense-nose` | …pe… strip: nose door |
| `sense-tongue` | `i-sense-tongue` | …pe… strip: tongue door |
| `sensed` | `i-sensed` | …pe… strip: body door |
| `mental-proliferation` | `i-proliferation` | Convergence node (40×40) |
| `tangle-unwise-attention` | `i-tangle` | Left split panel header |
| `wise-attention` | `i-wise` | Right split panel header |
| `liberation-sparkle` | `i-sparkle` | Right split panel result box |
| `honey-ball` | `i-honey-ball` | Honey-ball simile card |

---

### `buildIconsManifest.ts` updates

Add `"mn18"` to the `discourse` array of each icon below:

| Entry ID | Action |
|----------|--------|
| `seen` | append `"mn18"` |
| `heard` | append `"mn18"` |
| `sense-nose` | append `"mn18"` |
| `sense-tongue` | append `"mn18"` |
| `sensed` | append `"mn18"` |
| `cognized` | append `"mn18"` |
| `tangle-unwise-attention` | append `"mn18"` |
| `wise-attention` | append `"mn18"` |
| `liberation-sparkle` | append `"mn18"` |

Add new entry blocks for `honey-ball` and `mental-proliferation` (see specs above).

After all changes: `npm run gen:icons-manifest`

---

### Defs inventory

In-file gradients and filters:
`bg`, `patternLeft`, `patternRight`, `tierGrad`, `keystoneGrad`, `amberGlow`, `shadowDrop`, `glow1`, `iconGlow`

---

### Decisions

- **Two chains (eye + mind) side by side, not six columns.** The eye door represents the physical senses; the mind door represents the conceptual plane. Showing both explicitly is doctrinally honest (the discourse abbreviates ears/nose/tongue/body but gives eye and mind fully).

- **…pe… for ear/nose/tongue/body as a compact center strip** with English labels (EAR, NOSE, TONGUE, BODY) under each icon.

- **No framing card.** The Daṇḍapāṇi encounter was dropped to keep the diagram focused on Mahākaccāna's elaboration of the pivotal condition.

- **Gate band replaces a separate "breaking the chain" panel.** The split contrast immediately below shows what happens on either side of the gate.

- **Split contrast: proliferation divergence, not contact absence.** Both sides show contact → feeling → perception → thought. The left continues to proliferation overwhelm; the right stops before proliferation when nothing is delighted in, welcomed, or fixated on. This matches MN 18's Buddha-summary pivot — not Mahākaccāna's separate `phassapaññatti` logical-analysis passage.

- **Person-type headers are pedagogical shorthand.** MN 18 states the condition impersonally (`ettha ce natthi abhinanditabbaṁ…`); the puthujjana/ariyasāvaka labels map the contrast onto familiar Nikāya categories without being verbatim from this sutta.

- **`mental-proliferation` icon at convergence.** Replaces `tangle-unwise-attention` there — proliferation is conduct-triangle + tangle, not tangle alone.

- **Honey-ball icon: sphere without drip.** Final icon is a clean ball with shine arcs only.

- **Pali column alignment in anusaya section.** All seven Pali labels at `x=172` so `bhavarāgānusaya` aligns with the shorter compounds.

- **sn36.6 panel geometry used verbatim** for the split contrast (`x=40 w=408` / `x=472 w=408`).

---

### Verification

1. Two parallel chains visible at 100% zoom; `seen` and `cognized` icons distinguish eye vs. mind doors
2. `…pe…` strip shows all four abbreviated sense icons with EAR/NOSE/TONGUE/BODY labels
3. Gate band visible as a distinct horizontal element between chains and split contrast
4. Left/right split contrast uses the sn36.6 panel geometry exactly
5. **Both split panels show contact through thought; only the left shows proliferation overwhelming**
6. Right panel cites `ettha ce natthi abhinanditabbaṁ… ajjhositabbaṁ` — not `phassapaññattiṁ na paññāpessati`
7. `mental-proliferation` icon at convergence node (40×40)
8. All seven anusaya listed individually; Pali labels aligned at `x=172`
9. Honey-ball icon at 80×80 in simile card; sphere only (no drip); `amberGlow` behind it
10. All Pali in direct Unicode (no `&#257;`-style escaping)
11. `npm run gen:icons-manifest` completes without errors
12. Footer link resolves to `https://wordsofthebuddha.org/mn18`
