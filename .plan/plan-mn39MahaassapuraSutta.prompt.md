## Plan: SVG Diagram for MN 39 (Mahāassapura Sutta)

**Status — implemented.** The shipped graphic is `src/assets/content-images/mn39.svg`, built from parts in `src/assets/content-images/mn39-drafts/` via `merge-mn39.cjs` (28px gap between sections, content bounds trim per part). This document matches what is **actually in the merged file**, not aspirational layout.

The diagram uses a dark-mode SVG, Georgia serif, gold accents, and burgundy-vs-teal contrast for the hindrance panels.

---

### Final output (merged)

| Property | Value |
|----------|--------|
| File | `src/assets/content-images/mn39.svg` |
| Dimensions | **920×2901** (`viewBox="0 0 920 2901"`) |
| Background | Shared `linearGradient` `bg`: `#0b1528` → `#0e1a30` (30% stop) → `#101e36` |
| Merge | `merge-mn39.cjs`; defs IDs are prefixed per part (`c01_` … `c06_`) |

**Section Y offsets in the merged file** (from merge comments):

| Part file | y-offset | Draft `height` attr |
|-----------|----------|------------------------|
| `01-header.svg` | 0 | 150 |
| `02-training-staircase.svg` | 144 | 780 |
| `03-five-hindrances.svg` | 935 | 680 |
| `04-jhanas.svg` | 1619 | 480 |
| `05-three-knowledges.svg` | 2101 | 300 |
| `06-epithets-footer.svg` | 2415 | 486 |

---

### Discourse structure (unchanged)

MN 39 presents a progressive training guideline for bhikkhus to earn the title “ascetic.” Narrative arc:

- **Setting** — Assapura, Aṅga country (header only)
- **Training staircase** — 7 progressive steps, with refrain text beside the first connector
- **Five hindrances** — paired similes (affliction vs freedom)
- **Four jhānas** — nested rectangles + standard similes
- **Three knowledges** — three cards with large simile illustrations + small corner icons
- **Liberation + seven epithets + footer** — liberation stock phrase, then epithets, link, lotus

---

### Canvas and global style

- Font: `Georgia, 'Times New Roman', serif`
- Min body text in practice: ~10px
- English generally precedes Pali where both appear
- Pali: direct Unicode (ā, ī, ū, ñ, ṁ, ṅ, ṇ, ṭ, ḷ)
- Standard effects in drafts: `tierGrad`, `shadowDrop`, `iconGlow`; part 05/06 also use `glow1` / `glow2` / radial glows where present

---

### Parts-based build

Directory: `src/assets/content-images/mn39-drafts/`

| File | Section |
|------|---------|
| `01-header.svg` | Title, subtitle, rule, bilingual tagline, decorative ellipse |
| `02-training-staircase.svg` | 7 training steps, diagonal guide, refrain, connectors |
| `03-five-hindrances.svg` | Solitude bridge, five split-panel rows, summary bridge |
| `04-jhanas.svg` | Four nested jhāna layers + copy |
| `05-three-knowledges.svg` | Bridge lines, three knowledge cards (large simile art + small icons) |
| `06-epithets-footer.svg` | **Liberation** panel, seven epithets, footer link, lotus |

---

### Phase 1 — Header (`01-header.svg`)

- Title: `MN 39 — Mahāassapura Sutta` — 22px bold `#c8a040`, letter-spacing 3
- Subtitle: `The Greater Discourse at Assapura` — 15px italic `#708090`
- Rule: y=74, x 260–660, `#a09070` @ 0.3 opacity
- English tagline (12px italic `#90c0b0`): *“We will practice the proper path of an ascetic, so that our recognition will be true and factual”*
- Pali tagline (11px italic `#708878`, opacity 0.8): *ye dhammā samaṇakaraṇā ca brāhmaṇakaraṇā ca te dhamme samādāya vattissāma*
- Decorative ellipse: ~(280, 150), low opacity

---

### Phase 2 — Training staircase (`02-training-staircase.svg`)

**Tier label:** `TRAINING GUIDELINES · samaṇakaraṇa dhammā` — 12px bold gold @ 0.75, letter-spacing 2.5

**Refrain (beside first connector — full quotation in graphic):**

- EN: *“Do not let the goal pass you by, while there is still more to be done”*
- PL: *mā vo attho parihāyi, sati uttariṁ karaṇīye*

**Diagonal guide:** Line ~(80,55) to ~(310,700), `#4a8898`, 1.5px, opacity 0.07

**Connectors:** Cubic bezels between steps with small gold dot markers

**7 staircase cards:** Numbered circles; card sizes mostly 360×82, step 2 and 7 slightly taller where needed. Icons embedded as inline line-art (same motifs as design-system IDs below).

| Step | English | Pali | Icon ID |
|------|---------|------|---------|
| 1 | Conscience and Moral Dread | hirī + ottappa | `virtue-tablet` |
| 2 | Pure Conduct | kāya · vacī · mano samācāra | `triple-purity` |
| 3 | Pure Livelihood | parisuddho ājīvo | `bowl-robe` |
| 4 | Guarding the Sense Faculties | indriyesu guttadvāra | `eye-shield` |
| 5 | Moderation in Eating | bhojane mattaññutā | `moderation-bowl` |
| 6 | Devotion to Wakefulness | jāgariya | `wakefulness-moon` |
| 7 | Mindfulness and Clear Awareness | sati · sampajañña | `clear-awareness-fourfold` |

---

### Phase 3 — Five hindrances (`03-five-hindrances.svg`)

**Solitude bridge:** *He dwells in a secluded lodging* / *vivittaṁ senāsanaṁ bhajati*

**Tier label:** `FIVE HINDRANCES — PAÑCA NĪVARAṆĀ`

**Layout:** Five rows (~80px panels + spacing); left `hindL` / right `hindR` split at x=460; gold divider.

**Summary bridge (footer of section):** English line + Pali list + closing line on freedom (as in file), including *yathā iṇaṁ · … · yathā kantāraddhānamaggaṁ* and the “when abandoned” line.

| Row | Hindrance | Left icon | Right icon |
|-----|-----------|-----------|------------|
| 1 | Craving (abhijjhā) | `simile-debt` | `simile-debt-free` |
| 2 | Ill will (byāpāda) | `simile-disease` | `simile-healthy` |
| 3 | Dullness + drowsiness (thīnamiddha) | `simile-prison` | `simile-released` |
| 4 | Restlessness + worry (uddhaccakukkucca) | `simile-slavery` | `simile-freedom` |
| 5 | Doubt (vicikicchā) | `simile-dangerous-path` | `simile-safe-arrival` |

---

### Phase 4 — Four jhānas (`04-jhanas.svg`)

**Tier label:** `FOUR JHĀNAS · CATTĀRO JHĀNĀ`

**Nested rects:** Outer ~780×416 (filled `jhana1` stroke gold); inner frames stepped down (sizes as in file).

**Corner icons:** `jhana-first` … `jhana-fourth` (embedded inline, matching design-system assets).

---

### Phase 5 — Three knowledges (`05-three-knowledges.svg`)

**Bridge:** Mind collected / purified lines (EN + long Pali *samāhite citte…*)

**Tier label:** `THREE KNOWLEDGES · TISSO VIJJĀ`

**Three cards (260×196):** Each card has a **large inline simile illustration** and a **small corner icon**:

| Card | Knowledge | Large simile (inline art) | Small corner icon ID |
|------|-----------|---------------------------|----------------------|
| 1 | Past lives (pubbenivāsānussatiñāṇa) | Villages + traveler + road | `past-lives-eye` |
| 2 | Divine eye (cutūpapātañāṇa) | Two houses + observer | **Inline `divine-eye` motif** (same graphic as `icons/divine-eye.svg` / manifest `breakthrough-divine-eye`) |
| 3 | Ending of taints (āsavakkhayañāṇa) | Mountain lake + visible bottom | **`defilements-ended`** (twin orbs — *not* `broken-chain`) |

**Note:** The **lake** and **village / two-houses** narratives also exist as standalone normalized assets `simile-mountain-lake`, `simile-villages-traveler`, `simile-two-houses` in `design-system/icons/` for reuse and manifest entries.

**Liberation stock phrase** does **not** live in part 05 in the final build; it opens part 06 (see below).

---

### Phase 6 — Liberation, epithets, footer (`06-epithets-footer.svg`)

**Liberation block (top of part 06):**

- Radial/rect glow, title **Liberation**
- Italic line: mind liberated from the three taints (sensual desire, becoming, ignorance)
- Bold stock phrase: *“Birth is ended…”* + Pali *khīṇā jāti…*

**Seven epithets — actual layout:** Centered **single-line** rows at x=460 using `tspan` (English title · Pali · gloss · Pali phrase), not a four-column table. Intro line: *When harmful, unwholesome states are abandoned, one is called:*

Rows: Ascetic (samaṇa), Brahmin (brāhmaṇa), Bathed One (nhātaka), Knower of the Vedas (vedagū), Well-Learned (sottiyo), Noble One (ariyo), Arahant (arahaṃ).

**Footer:**

- Rule x 300–620, `#304058` @ 0.3
- Link (clickable): `wordsofthebuddha.org/mn39` → `https://wordsofthebuddha.org/mn39`
- Lotus motif: `translate(460, 464) scale(0.25)`

---

### Design-system icons (by ID)

**Training staircase**

| Icon ID | Role |
|---------|------|
| `virtue-tablet` | Step 1 |
| `triple-purity` | Step 2 (kāya / vacī / mano) |
| `bowl-robe` | Step 3 |
| `eye-shield` | Step 4 |
| `moderation-bowl` | Step 5 |
| `wakefulness-moon` | Step 6 |
| `clear-awareness-fourfold` | Step 7 |

**Five hindrances (paired similes)**

| Icon ID | Role |
|---------|------|
| `simile-debt` / `simile-debt-free` | Craving |
| `simile-disease` / `simile-healthy` | Ill will |
| `simile-prison` / `simile-released` | Dullness & drowsiness |
| `simile-slavery` / `simile-freedom` | Restlessness & worry |
| `simile-dangerous-path` / `simile-safe-arrival` | Doubt |

**Jhānas:** `jhana-first` … `jhana-fourth`

**Three knowledges**

| Role | Icon / asset |
|------|----------------|
| Corner icon card 1 | `past-lives-eye` |
| Corner icon card 2 | `divine-eye` (manifest entry `breakthrough-divine-eye` points at same file) |
| Corner icon card 3 | `defilements-ended` |
| Optional standalone simile line-arts (also in manifest) | `simile-villages-traveler`, `simile-two-houses`, `simile-mountain-lake` |

---

### Key text excerpts (as used)

**Header tagline:** (see Phase 1)

**Training refrain:** *“Do not let the goal pass you by…”* / *mā vo attho parihāyi, sati uttariṁ karaṇīye*

**Hindrance summary:** (full block in `03-five-hindrances.svg` bottom)

**Liberation:** *“Birth is ended, the spiritual life has been lived, what was to be done has been done.”* / *khīṇā jāti, vusitaṁ brahmacariyaṁ, kataṁ karaṇīyaṁ, nāparaṁ itthattāyā*

**Closing epithet sentence (sutta):** *samaṇo itipi brāhmaṇo itipi…* — paraphrased across the seven rows in part 06.
