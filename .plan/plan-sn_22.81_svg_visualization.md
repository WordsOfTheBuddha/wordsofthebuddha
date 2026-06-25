## Plan: SN 22.81 SVG Visualization

**Status**: Implemented — `src/assets/content-images/sn22.81.svg`

**TL;DR**: Open with a person surrounded by five thought bubbles (personal-existence views, dogmas, doubt). A dashed thread from the highlighted eternalist bubble traces down through a six-column contact→feeling→craving grid to a saṅkhāra birth box. Close with a split panel: puthujjana grasps constructs as real (solid bubbles, taints persist and grow) vs ariyasavaka sees them as impermanent (dashed bubbles, immediate āsavā khaya).

---

### Canvas

- `viewBox="0 0 920 1320"`
- Background: `url(#bg)` + ambient teal ellipse (`cx=460 cy=1180`, opacity 0.05)

### Section layout

| # | `id` | y-offset | ~height | Notes |
|---|------|----------|---------|-------|
| 0 | `section-title` | 0 | 138 | Quote + Pali |
| 1 | `section-hero` | 138 | ~382 | Person + 5 bubbles, no tier label |
| — | *(thread)* | — | — | Dashed gold line `460,228 → 460,830` (global coords) |
| 2 | `section-chain` | 518 | ~394 | 6×3 grid + construct box |
| 3 | `section-result` | 912 | ~356 | Split panels + outcome callouts |
| — | `section-footer` | 1268 | ~52 | Source link + lotus motif |

**Not built** (dropped from early v3 drafts): separate `section-seeing` with five link chips and bracket; 3-cell contact/feeling rows; 4-node horizontal causal strip; hero gold “construct” box; liberation-sparkle on ariyasavaka figure.

---

### Section 0 — Title (`section-title`, y=0)

- **SN 22.81 — PĀLILEYYAKA SUTTA** · *At Pālileyyaka*
- Divider at y=80
- Quote (y=106): *"How should one know and see for the immediate wearing away of the taints?"*
- Pali (y=126): `kathaṁ nu kho jānato kathaṁ passato anantarā āsavānaṁ khayo hoti`

---

### Section 1 — Hero (`section-hero`, y=138)

**Figure** (puthujjana, large, `#a06070`, `iconGlow`, opacity 0.72):
- Head `cx=460 cy=248 r=17`; body to y=308; arms slightly open; legs to y=336

**5 thought bubbles** (`ellipse`, fill `#1c1520`, stroke `#7a4060` unless noted):

| # | cx,cy | rx×ry | Bold label | Pali italic |
|---|-------|-------|------------|-------------|
| 1 | 150,105 | 84×32 | Self has form | *rūpavantaṁ attānaṁ samanupassati* |
| 2 | 307,72 | 72×32 | Consciousness is self | *viññāṇaṁ attato samanupassati* |
| 3 | 460,58 | 78×32 | My self is eternal | *sassatadiṭṭhi* — **gold border** (traced thread) |
| 4 | 613,72 | 74×32 | I will simply cease | *ucchedadiṭṭhi* |
| 5 | 768,105 | 70×32 | I just don't know | *kaṅkhitā · vicikicchitā* |

**Bubble tails**: 4 circles each (`#7a4060`, decreasing r/opacity) from bubble toward head `(460,248)`.

**Caption** (y=364, section-local): *These regardings, views, as well as doubt are intentional constructs (saṅkhārā)*

**Visual thread** (global): dashed gold path from center bubble down into section-chain construct box.

---

### Section 2 — When touched (`section-chain`, y=518)

**Tier label**: **WHEN TOUCHED BY A FEELING BORN OF IGNORANCE-CONTACT** · *avijjāsamphassajena · vedayitena phuṭṭhassa*

**Outer panel**: `x=96 y=56 w=728 h=340`, `panelFill`, `shadowDrop`

**6-column × 3-row grid** (row labels right-aligned at x=82):

| Row | y | Cell size | Columns |
|-----|---|-----------|---------|
| Contact | 78 | 90×40 | 6 tone cells (pleasant / painful / dashed-no-contact / neutral / painful / pleasant) |
| Feeling | 156 | 90×40 | same pattern |
| Craving | 234 | 90×48 | same pattern, gold stroke; cell labels for taṇhā type |

- **Column 4** (`x=361`): dashed “no contact” column; vertical gold line + labels *no contact · feeling subsides · craving subsides*
- **Craving row**: bracket `x=26 w=762 h=60`; footnote `* due to ignorance`
- Craving cell labels: sense pleasures (↑ kāma-taṇhā), non-becoming (↓ vibhava-taṇhā), becoming (○ bhava-taṇhā) — repeated across columns
- Gold vertical connectors contact → feeling → craving per column

**Craving → construct merge**: dotted paths from active craving cells converge at `(460,296)` then down to construct box.

**Construct box** (`x=140 y=312 w=640 h=74`, gold border, `#1c1a14`):
1. *When an uninstructed ordinary person is touched, craving arises · an intentional construct is born from that craving*
2. *phuṭṭhassa assutavato puthujjanassa uppannā taṇhā; tatojo so saṅkhāro*
3. **It is impermanent · conditioned · dependently arisen**
4. *anicca · saṅkhata · paṭiccasamuppanna*

*(Impermanence insight lives here — no separate “knowing and seeing” chip section.)*

---

### Section 3 — The difference (`section-result`, y=912)

**Tier label**: **THE DIFFERENCE IS IN KNOWING AND SEEING**
**Sub**: *the arising of construct as dependently arisen from ignorance-contact*

Center divider line `x=460` (opacity 0.12).

#### Left panel — puthujjana (`patternLeft`, `x=40 w=408 h=200`, burgundy border)

- 3 **solid** mini-bubbles: *Self has form* · *My self is eternal* · *I will simply cease*
- Figure `cx=244 cy=162 r=13`, arms slightly raised
- Mechanism (y=244): **Sees an essence in the construct born of ignorance-contact**
- Pali (y=260): *samanupassanā · diṭṭhi · kaṅkhā*

**Outcome callout** (`x=40 y=284 w=408 h=48`, burgundy stroke):
- Icon: `icon-bowl-overflow` (design-system) at left (`x=52`)
- **taints persist and grow**
- *āsavā · dhuvaṃ · vaḍḍhanti*

#### Right panel — ariyasavaka (`patternRight`, `x=472 w=408 h=200`, teal border)

- `libGlow` ellipse behind figure
- 3 **dashed** mini-bubbles (same labels, faded teal)
- Figure `cx=676 cy=162 r=13`, arms lower/settled
- Mechanism (y=244): **By seeing the construct as impermanent · conditioned · dependently arisen**
- Pali (y=260): *anicca · saṅkhata · paṭiccasamuppanna*

**Outcome callout** (`x=472 y=284 w=408 h=48`, teal stroke):
- Icon: `icon-defilements-ended` at right (`x=832`)
- **immediate wearing away of taints** (`glow1`)
- *anantarā āsavānaṁ khayo hoti*

---

### Section 4 — Footer (`section-footer`, y=1268)

- Divider + link `wordsofthebuddha.org/sn22.81`
- Lotus motif (scaled 0.25, opacity 0.18)

---

### Defs (in use)

| id | type | use |
|----|------|-----|
| `bg`, `tierGrad`, `panelFill` | linearGradient | background, tier lines, main panel |
| `patternLeft`, `patternRight` | linearGradient | split panels |
| `pleasantFill`, `painfulFill`, `neutralFill` | linearGradient | grid cells |
| `libGlow` | radialGradient | ariyasavaka halo |
| `shadowDrop`, `glow1`, `iconGlow` | filter | panels, outcome text, figures/icons |
| `arrowGold` | marker | defined (grid uses plain lines) |
| `icon-bowl-overflow` | symbol | left outcome callout |
| `icon-defilements-ended` | symbol | right outcome callout |
| `icon-liberation-sparkle` | symbol | embedded but unused in layout |

Also defined but unused in markup: `reframeFill`, `sankharaFill`.

---

### Relevant files

- `src/assets/content-images/sn22.81.svg` — this visualization
- `src/assets/content-images/sn22.81.v1.svg` — earlier draft
- `src/assets/content-images/design-system/icons/bowl-overflow.svg` — left callout icon source
- `src/assets/content-images/design-system/icons/defilements-ended.svg` — right callout icon source
- `src/content/en/sn/sn22.81.mdx` — discourse text

---

### Verification

1. Center eternalist bubble dashed thread reads clearly into construct box
2. Column 4 “no contact” column and craving-type labels legible at ~460px width
3. Split panel: solid vs dashed bubbles immediately distinguishable; matched outcome callouts below each panel
4. `/sn22.81` auto-discovers image via slug in `contentImage.ts`

---

### Design decisions (implemented)

- **Cold open** — no tier label on hero; person + bubbles first
- **Five bubbles** — body-self variant, consciousness-self, eternalism, annihilationism, doubt (not full 20-fold taxonomy)
- **Six-column grid** — sn36.10-inspired but expanded; one “no contact” column shows subsiding of feeling/craving
- **Single chain section** — birth of saṅkhāra + anicca/saṅkhata/paṭiccasamuppanna in one panel (no separate chip row)
- **Split outcome callouts** — symmetric rectangles under each panel with design-system icons (overflow bowl ↔ defilements ended)
- **Bubble continuity** — mini-bubbles in result section echo hero labels (solid = grasped, dashed = seen through)
