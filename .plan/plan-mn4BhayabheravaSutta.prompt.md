## Plan: SVG Diagram for MN 4 (Bhayabherava Sutta)

Create a dark-theme SVG diagram (920×~2100px) that prioritizes non-story doctrinal/training structure from MN 4. Keep visual language aligned with existing MN diagrams (mn1/mn3/mn148): deep blue gradient background, gold section labels, burgundy-vs-teal contrast for unwholesome vs purified states, serif typography, subtle glow filters, and low-opacity atmospheric shapes.

---

### Scope And Constraints

- Diagram should prioritize non-story doctrinal/training structure.
- Exclude liberation formula block.
- Exclude Jāṇussoṇi going-for-refuge block.
- Keep English text before Pali wherever both are shown.
- For doctrinal terms, show concise English rendering immediately before Pali.
- Use direct Unicode Pali diacritics (no escaping).
- Background decorative shapes must keep opacity below 0.1.

---

### Canvas

- 920 × ~2100 viewBox (matches project style)
- Reuse established defs and effects from reference SVGs:
  - bg, patternLeft, patternRight, tierGrad
  - glow1/glow2/glow3, shadowDrop, iconGlow

---

### Section Stack (Top To Bottom)

1. Title block (y ~0–110)
2. Sixteen Grounds — 4 sub-groups (y ~140–980)
   - A: 4-col Purity of Conduct
   - B: 5-col Five Hindrances
   - C: 2×2 Character Virtues
   - D: 3-col Meditative Qualities
3. Auspicious Nights strip with moon symbols (y ~1000–1110)
4. Four Postures panel with icons (y ~1130–1320)
5. Non-delusion day/night center band (y ~1330–1390)
6. Four Jhānas — nested staircase (y ~1410–1700)
7. Three True Knowledges — 3-col night watches (y ~1720–2020)
8. Closing: two benefits only (y ~2040–2140)

---

### Topic Selection Map (What To Put In The Diagram)

#### A) Sixteen Grounds (soḷasapariyāya)

Show each as defiled pattern vs purified antidote.

1) Purity of conduct quartet
- bodily conduct — kāyakammanta
- verbal conduct — vacīkammanta
- mental conduct — manokammanta
- livelihood — ājīva

2) Five hindrances pattern (explicitly called out)
- craving/lust -> freedom from craving: anabhijjhālu
- ill will -> loving-kindness: mettacitta
- dullness/drowsiness -> alertness: vigatathinamiddha
- restlessness/agitation -> settled mind: vūpasantacitta
- doubt/hesitation -> beyond doubt: tiṇṇavicikiccha

3) Character and restraint cluster
- boastful/denigrating others -> anattukkaṁsaka aparavambhī
- timid/fearful -> vigatalomahaṁsa
- seeking gains/honor/fame -> appicchata
- lazy/weak effort -> āraddhavīriya

4) Meditative quality cluster
- muddle-minded/lacking clear awareness -> upaṭṭhitassati
- distracted/wandering -> samādhisampanna
- undiscerning/muddled -> paññāsampanna

#### B) Auspicious Nights (Lunar Context)

- cātuddasī (14th), pañcadasī (15th), aṭṭhamī (8th)
- Applies in both lunar fortnights (waxing and waning)
- Add visual note: observed across both pakkhas

#### C) Four Postures Under Fear

- While walking — caṅkamantassa
- While standing — ṭhitassa
- While sitting — nisinnassa
- While lying down — nipannassa

Pattern text in each card:
- fear arises
- remains in same posture
- subdues fright and dread there itself

#### D) Non-Delusion About Day And Night

Add a compact center band between postures and jhānas.

- English line: perceives night as night, day as day - not subject to delusion
- Pali line (italic, under English): asammohadhammo satto loke uppanno ...
- Keep this section brief and distinguished (single band, not a full panel).

#### E) Four Jhānas

Each layer should include English rendering first, then Pali term.

- first jhāna: reflection and examination; born of seclusion; uplifting joy and pleasure — savitakka savicāra vivekaja pītisukha
- second jhāna: internal tranquility; unification of mind; born of collectedness; uplifting joy and pleasure — sampasādana ekodibhāva samādhija pītisukha
- third jhāna: equanimous, mindful and clearly aware; bodily ease — upekkhaka sata sampajāno sukha
- fourth jhāna: beyond pleasure and pain; purification of mindfulness through equanimity — adukkhamasukha upekkhāsatipārisuddhi

#### F) Three True Knowledges (Night Watches)

- First watch: recollection of past lives — pubbenivāsānussatiñāṇa
- Middle watch: knowledge of death and rebirth according to kamma — cutūpapātañāṇa, yathākammūpaga, dibbacakkhu
- Last watch: knowledge of destruction of taints — āsavakkhayañāṇa

Keep the repeated refrain as a slim footer band:
- ignorance dispelled, true knowledge arose; darkness dispelled, clarity arose
- avijjā vihatā vijjā uppannā; tamo vihato āloko uppanno

#### G) Closing (Doctrinal Only)

- pleasant abiding here-and-now — diṭṭhadhammasukhavihāra
- compassion for future generations — anukampā

---

### Updated ASCII Visual Layout

```text
┌──────────────────────────────────────────────────────────────────────┐
│                    MN 4 — BHAYABHERAVA SUTTA                         │
│                         Fright and Dread                              │
│                       bhayabherava sutta                              │
├──────────────────────────────────────────────────────────────────────┤
│                 SIXTEEN GROUNDS · soḷasapariyāya                     │
│                                                                      │
│  A) PURITY OF CONDUCT (4 columns, equal width)                      │
│  ┌──────────────┐┌──────────────┐┌──────────────┐┌──────────────┐    │
│  │ defiled      ││ defiled      ││ defiled      ││ defiled      │    │
│  │ bodily       ││ verbal       ││ mental       ││ livelihood   │    │
│  ├──────────────┤├──────────────┤├──────────────┤├──────────────┤    │
│  │ purified     ││ purified     ││ purified     ││ purified     │    │
│  │ kāyakammanta ││ vacīkammanta ││ manokammanta ││ ājīva        │    │
│  └──────────────┘└──────────────┘└──────────────┘└──────────────┘    │
│                                                                      │
│  B) FIVE HINDRANCES (5 columns, equal width)                         │
│  ┌───────────┐┌───────────┐┌───────────┐┌───────────┐┌───────────┐    │
│  │ craving   ││ ill will  ││ dullness  ││ restless  ││ doubt     │    │
│  │ lust      ││           ││ drowsiness││ agitation ││ hesitation│    │
│  ├───────────┤├───────────┤├───────────┤├───────────┤├───────────┤    │
│  │ freedom   ││ loving-   ││ alertness ││ settled   ││ beyond    │    │
│  │ from      ││ kindness  ││           ││ mind      ││ doubt     │    │
│  │ anabhijjhā││ mettacitta││ vigatathina││ vūpasanta ││ tiṇṇavici │    │
│  └───────────┘└───────────┘└───────────┘└───────────┘└───────────┘    │
│                                                                      │
│  C) CHARACTER VIRTUES (2×2 symmetric)                                │
│  ┌────────────────────────────┐  ┌────────────────────────────┐       │
│  │ boastful/denigrating       │  │ timid/fearful              │       │
│  ├────────────────────────────┤  ├────────────────────────────┤       │
│  │ anattukkaṁsaka aparavambhī │  │ vigatalomahaṁsa            │       │
│  └────────────────────────────┘  └────────────────────────────┘       │
│  ┌────────────────────────────┐  ┌────────────────────────────┐       │
│  │ gains/honor/fame seeking   │  │ lazy/weak effort           │       │
│  ├────────────────────────────┤  ├────────────────────────────┤       │
│  │ appicchata                 │  │ āraddhavīriya              │       │
│  └────────────────────────────┘  └────────────────────────────┘       │
│                                                                      │
│  D) MEDITATIVE QUALITIES (3 columns, equal width)                    │
│  ┌────────────────────┐┌────────────────────┐┌────────────────────┐   │
│  │ muddle-minded      ││ distracted         ││ undiscerning       │   │
│  │ unclear awareness  ││ wandering mind     ││ muddled            │   │
│  ├────────────────────┤├────────────────────┤├────────────────────┤   │
│  │ upaṭṭhitassati     ││ samādhisampanna    ││ paññāsampanna      │   │
│  └────────────────────┘└────────────────────┘└────────────────────┘   │
├──────────────────────────────────────────────────────────────────────┤
│      AUSPICIOUS NIGHTS (both lunar fortnights / pakkha)              │
│      ◐ waxing context   ○ full moon   ◑ waning context   ● new moon  │
│      cātuddasī · pañcadasī · aṭṭhamī                                  │
├──────────────────────────────────────────────────────────────────────┤
│         FACING FRIGHT AND DREAD IN FOUR POSTURES                      │
│      ┌──────────────────────────────────────────────────────────┐      │
│      │ When fright and dread comes…                            │      │
│      └──────────────────────────────────────────────────────────┘      │
│                                                                      │
│  ┌─────────────────────────────┐  ┌─────────────────────────────┐     │
│  │ While walking               │  │ While standing              │     │
│  │ caṅkamantassa               │  │ ṭhitassa                    │     │
│  │ icon: walker                │  │ icon: standing figure       │     │
│  │ - fear arises               │  │ - fear arises               │     │
│  │ - remains walking           │  │ - remains standing          │     │
│  │ - subdues it there          │  │ - subdues it there          │     │
│  └─────────────────────────────┘  └─────────────────────────────┘     │
│                                                                      │
│  ┌─────────────────────────────┐  ┌─────────────────────────────┐     │
│  │ While sitting               │  │ While lying down            │     │
│  │ nisinnassa                  │  │ nipannassa                  │     │
│  │ icon: seated figure         │  │ icon: reclining figure      │     │
│  │ - fear arises               │  │ - fear arises               │     │
│  │ - remains sitting           │  │ - remains lying down        │     │
│  │ - subdues it there          │  │ - subdues it there          │     │
│  └─────────────────────────────┘  └─────────────────────────────┘     │
├──────────────────────────────────────────────────────────────────────┤
│            NON-DELUSION ABOUT DAY AND NIGHT                         │
│  perceives night as night, day as day - not subject to delusion     │
│  rattiṁyeva samānaṁ rattīti sañjānāmi, divāyeva samānaṁ divāti sañjānāmi - asammohadhammo │
│  (compact center band between postures and jhānas)                  │
├──────────────────────────────────────────────────────────────────────┤
│ ═══ FOUR JHĀNAS · cattāro jhānā ═══════════════════════════════      │
│ ┌──────────────────────────────────────────────────────────────────┐  │
│ │  1st Jhāna · paṭhama jhāna                    [gold border]     │  │
│ │  reflection · examination · born of seclusion                   │  │
│ │  uplifting joy and pleasure — pītisukha                         │  │
│ │  savitakka · savicāra · vivekaja                                │  │
│ │  ┌────────────────────────────────────────────────────────────┐ │  │
│ │  │  2nd Jhāna · dutiya jhāna               [gold-teal border] │ │  │
│ │  │  internal tranquility · unified · born of collectedness    │ │  │
│ │  │  uplifting joy and pleasure — pītisukha                    │ │  │
│ │  │  sampasādana · ekodibhāva · samādhija                      │ │  │
│ │  │  ┌──────────────────────────────────────────────────────┐  │ │  │
│ │  │  │  3rd Jhāna · tatiya jhāna            [silver border] │  │ │  │
│ │  │  │  equanimous · mindful and clearly aware              │  │ │  │
│ │  │  │  pleasure in body — sukha kāyena                     │  │ │  │
│ │  │  │  upekkhaka · sata · sampajāno                        │  │ │  │
│ │  │  │  ┌────────────────────────────────────────────────┐  │  │ │  │
│ │  │  │  │  4th Jhāna · catuttha jhāna   [white/grey bdr] │  │  │ │  │
│ │  │  │  │  beyond pleasure and pain                       │  │  │ │  │
│ │  │  │  │  purification of mindfulness through equanimity │  │  │ │  │
│ │  │  │  │  adukkhamasukha · upekkhāsatipārisuddhi         │  │  │ │  │
│ │  │  │  └────────────────────────────────────────────────┘  │  │ │  │
│ │  │  └──────────────────────────────────────────────────────┘  │ │  │
│ │  └────────────────────────────────────────────────────────────┘ │  │
│ └──────────────────────────────────────────────────────────────────┘  │
│     each layer inset ≈30px L/R and ≈8px bottom from outer layer      │
├──────────────────────────────────────────────────────────────────────┤
│             THREE TRUE KNOWLEDGES (3 night watches)                   │
│  ┌────────────────────┐┌────────────────────┐┌────────────────────┐   │
│  │ First watch        ││ Middle watch       ││ Last watch         │   │
│  │ past lives         ││ death-rebirth      ││ destruction of     │   │
│  │ pubbenivāsānussati ││ cutūpapāta         ││ taints             │   │
│  │                    ││ yathākammūpaga     ││ āsavakkhaya        │   │
│  └────────────────────┘└────────────────────┘└────────────────────┘   │
├──────────────────────────────────────────────────────────────────────┤
│  CLOSING (doctrinal only)                                              │
│  - pleasant abiding here-and-now — diṭṭhadhammasukhavihāra            │
│  - compassion for future generations — anukampā                        │
└──────────────────────────────────────────────────────────────────────┘
```

---

### Symmetry And Geometry Rules

- Keep whole layout center-aligned to x=460.
- Section label bars should have equal left-right margins.
- Group A: 4 equal cards in one row.
- Group B: 5 equal cards in one row.
- Group C: true 2×2 with matching card widths and row heights.
- Group D: 3 equal cards in one row.
- Four postures: strict 2×2, equal card sizes and equal gutters.
- Three knowledges: 3 equal columns with same header/body/footer proportions.
- Nested Jhānas: constant inward inset per layer for a regular staircase rhythm.
- Use one consistent card corner radius per section family.

---

### Text Alignment Rules (Vertical Padding)

All text within rectangular cards must maintain consistent vertical padding from the card top and from any divider line within the card.

**Split cards (defiled/purified halves):**
- Defiled half: first text baseline ≥ 22px below card top
- Purified half: first text baseline ≥ 20px below divider line
- Gap between English label and Pali gloss: 14px
- Minimum bottom margin (baseline to card bottom): ≥ 10px

**Single-content cards (postures, knowledges):**
- First text baseline ≥ 22px below card top
- Minimum bottom margin: ≥ 14px

**Card overlay layers (cardLeft/cardRight in C section):**
- cardRight overlay must start at or very near the divider line position
- No dead-space gap between divider and cardRight overlay

---

### Jhāna Text Formatting Rule

Each jhāna layer uses a consistent inline formatting pattern:
- **Title**: "Ordinal Name Jhāna · " followed by `<tspan font-size="11" font-style="italic">pali name</tspan>`
- **Factor lines**: English description followed by Pali in parentheses using `<tspan fill="#486068" font-size="10" font-style="italic">(paliTerm)</tspan>`
- Example: `Accompanied by reflection <tspan fill="#486068" font-size="10" font-style="italic">(savitakka)</tspan>`

---

### Pali Text Encoding Rule

- All Pali diacritics must use direct Unicode characters (ā, ī, ū, ñ, ṁ, ṅ, ṇ, ṭ, ḷ, Ā, Ḷ, etc.)
- Never use XML numeric character references (e.g. `&#x101;`) for Pali text
- Special XML characters (&amp; &lt; &gt;) still require standard XML escaping

---

### Posture Card Design

- Card height: 92px (compact single-line content)
- Icon: line-art stick figure at left, centered vertically (opacity 0.55 + iconGlow)
- Walking: stride pose with forward arm/leg
- Standing: upright, arms relaxed at sides
- Sitting: cross-legged meditation posture with base
- Lying: horizontal body, head slightly raised
- Text: Title (12px bold) + Pali (10px italic) + single flowing content line (11px)
- Content format: "Fear arises — remains [posture] — subdues it there"

---

### Typography And Readability Spec

- Title: 22px bold Georgia #c8a040
- Subtitle English: 15px Georgia #90a0b8
- Subtitle Pali: 13px italic Georgia #607080
- Section label: 12px bold, letter-spacing: 2, #c8a040, opacity 0.7
- Sub-group label: 11.5px bold #a0a8b8
- Cell English primary: 13px bold
- Cell Pali gloss: 11px italic
- Body note text: 12px
- Minor label/caption: 10–11px italic

Readability defaults:
- Prefer 13px minimum for card body text where space allows.
- Keep line length short in narrow cards (2–3 lines max before wrap).
- Maintain high contrast for English primary labels.
- Keep Pali secondary labels slightly dimmer but still legible.

---

### Color And Opacity Rules

- Unwholesome/defiled side: warm burgundy family
- Purified/skillful side: cool teal family
- Section emphasis: gold accents (#c8a040 family)
- Background decorative shapes: opacity < 0.1
- Divider and guide lines: subtle opacity (0.12–0.35)

---

### Icon Guidance

Use simple line icons matching existing project style:
- Moon row: circle/half-circle symbols and minimal line accents
- Posture icons: walker, standing figure, seated figure, reclining figure
- Apply iconGlow subtly; avoid dense detail and avoid visual noise

---

### Key Pali Terms To Include (Unicode)

- bhayabherava, soḷasapariyāya
- kāyakammanta, vacīkammanta, manokammanta, ājīva
- anabhijjhālu, mettacitta, vigatathinamiddha, vūpasantacitta, tiṇṇavicikiccha
- anattukkaṁsaka aparavambhī, vigatalomahaṁsa, appicchata, āraddhavīriya
- upaṭṭhitassati, samādhisampanna, paññāsampanna
- pañca nīvaraṇā
- paṭhama/dutiya/tatiya/catuttha jhāna
- savitakka savicāra vivekaja pītisukha
- pubbenivāsānussati, cutūpapāta, āsavakkhaya
- avijjā vihatā vijjā uppannā

---

### Implementation Checklist

1. Create new SVG scaffold and defs in src/assets/content-images/mn4.svg
2. Build section bars and spacing grid
3. Implement Sixteen Grounds groups A–D with split-card logic
4. Add auspicious nights strip with moon symbols and pakkha note
5. Add four-posture 2×2 cards with icons and repeated pattern text
6. Build nested four-jhāna block using term-rendering rule
7. Build three-knowledges columns with repeated refrain footer
8. Add doctrinal closing with two-benefits only
9. Verify diacritics rendering and opacity constraints
10. Cross-check English-first ordering wherever Pali appears

---

### Feasibility And Build Strategy

- Feasibility: high. All required sections fit within a ~2140px canvas while preserving readability.
- Recommended execution: build in one go within one SVG file, but in phased blocks (top-to-bottom) with visual checkpoints.
- Icon handling: keep icons in the same file for now to preserve sizing/alignment consistency; no need to split as a separate task unless icon reuse across multiple suttas is planned.
- Practical split during implementation (single pass):
  1) defs + title + section rails
  2) sixteen grounds groups A-D
  3) nights + postures + non-delusion band
  4) nested jhānas + three knowledges + closing
  5) final pass for spacing, label consistency, and contrast
