## Plan: SVG Diagram for MN 1 (Mūlapariyāya Sutta)

Create a dark-mode SVG diagram (920×~1600px) visualizing the core teaching of MN 1: how conceiving (*maññanā*) operates on 24 phenomena across 8 levels of understanding. Uses the established mn113/mn2 split-panel template, matching the project's consistent dark-blue background, Georgia serif font, gold accents, and burgundy-vs-teal contrast.

---

### Visual Outline (ASCII)

```
┌──────────────────────────────────────────────────────┐
│              MN 1 — MŪLAPARIYĀYA SUTTA               │  Title
│                 Root Of All Things                    │  (y: 0–130)
│      "sabbadhammamūlapariyāyaṁ vo desessāmi"         │
├──────────────────────────────────────────────────────┤
│     WORKED EXAMPLE: SENSE EXPERIENCE                 │  Core Formula
│     diṭṭha · suta · muta · viññāta                  │  (y: 140–480)
│  ┌── PUTHUJJANA ─────────┐ ┌── AWAKENED ──────────┐  │
│  │ sañjānāti  (perceives) │ │ abhijānāti (knows)   │  │  burgundy / teal
│  │      ↓                 │ │      ↓               │  │
│  │ maññati   (conceives)  │ │ na maññati           │  │
│  │  · X maññati       "as"│ │  · X na maññati      │  │
│  │  · X-smiṁ maññati "in"│ │  · X-smiṁ na maññati │  │
│  │  · X-to maññati "from"│ │  · X-to na maññati   │  │
│  │  · X me ti maññati  " │ │  · X me ti na maññati│  │
│  │      ↓        mine"   │ │      ↓               │  │
│  │ abhinandati (delights) │ │ nābhinandati         │  │
│  │ ──────────────────     │ │ ──────────────────   │  │
│  │ apariññātaṁ tassā      │ │ pariññātaṁ tassā     │  │
│  │ "not fully understood" │ │ "fully understood"   │  │
│  └────────────────────────┘ └──────────────────────┘  │
├──────────────────────────────────────────────────────┤
│       ─── APPLIED ACROSS 20 MORE PHENOMENA ───       │  Grid
│                                                      │  (y: 490–920)
│  FOUR ELEMENTS    │ pathavī   āpo    tejo    vāyo    │
│  BEINGS & COSMO   │ bhūtā    devā   pajāpati brahmā  │
│  JHĀNA REALMS     │ ābhassarā subhakiṇhā vehap. abb.│
│  FORMLESS BASES   │ ākāsānañc. viññāṇañc.   (2×2)   │
│                   │ ākiñcaññ.  nevasaññān.            │
│  ABSTRACT         │ ekatta  nānatta  sabba  nibbāna✦ │
├──────────────────────────────────────────────────────┤
│            ─── EIGHT LEVELS ───                      │  Progression
│                                                      │  (y: 930–1480)
│  ① Puthujjana ▸ sañjānāti → maññati → abhinandati   │  (burgundy)
│                  apariññātaṁ tassā                   │
│  ② Sekha      ▸ abhijānāti → mā maññi → mābhinandi  │  (transitional)
│                  pariññeyyaṁ tassā                   │
│  ③–⑥ Arahant  ▸ abhijānāti → na maññati → nābhinand.│  (teal, 2×2)
│     ③ pariññātaṁ   ④ khayā rāgassa                  │
│     ⑤ khayā dosassa ⑥ khayā mohassa                  │
│  ⑦–⑧ Tathāgata ▸ (same verbs)                       │  (gold glow)
│     ⑦ pariññātantaṁ tathāgatassa                    │
│     ⑧ nandī dukkhassa mūlaṁ                         │
├──────────────────────────────────────────────────────┤
│                ✦ CONCLUSION ✦                        │  Gold glow
│          nandī dukkhassa mūlaṁ                       │  (y: 1490–1600)
│      "delight is the root of suffering"              │
│    Na te bhikkhū bhagavato bhāsitaṁ abhinandun ti   │
└──────────────────────────────────────────────────────┘
```

---

### Steps

**Phase 1: SVG Scaffold (step 1–3)**
1. Create `src/assets/content-images/mn1.svg` with `viewBox="0 0 920 1600"`
2. Copy standard `<defs>` from mn113.svg (bg gradient, patternLeft/Right, tierGrad, glow1/2/3, shadowDrop, iconGlow)
3. Add a gold `conclusionGlow` radialGradient for the final section

**Phase 2: Title Block (steps 4–8, y: 0–130)**
4. `MN 1 — MŪLAPARIYĀYA SUTTA` — 22px bold, #a0b0c8
5. `Root Of All Things` — 15px italic, #708090
6. Decorative separator line
7. Pali: `sabbadhammamūlapariyāyaṁ vo desessāmi` — 13px italic, #7888a0
8. English: *"I will teach you a discourse on the root of all things"* — 14px italic, #90a0b8

**Phase 3: Core Formula — Worked Example (steps 9–12, y: 140–480)**

Use the **sense experience** group (`diṭṭha · suta · muta · viññāta`) as the concrete worked example. Show the full conceiving pattern with real Pali, then contrast puthujjana vs. awakened side by side.

9. **Example header** — small label bar: `WORKED EXAMPLE: THE SEEN, THE HEARD, THE SENSED, THE COGNIZED` with Pali `diṭṭha · suta · muta · viññāta` beneath. Gold accent, centered.

10. **Left / burgundy** — `PUTHUJJANA` header, attachment-tendril icon.
    - Verb chain with full Pali example (using `diṭṭha`):
      - `diṭṭhaṁ diṭṭhato sañjānāti` → *perceives the seen as the seen*
      - ↓
      - **5 modes of maññanā** (the heart of the sutta):
        - `diṭṭhaṁ maññati` → conceives [himself as] the seen
        - `diṭṭhasmiṁ maññati` → conceives [himself] in the seen
        - `diṭṭhato maññati` → conceives [himself apart] from the seen
        - `diṭṭhaṁ me ti maññati` → conceives the seen to be "mine"
      - ↓
      - `diṭṭhaṁ abhinandati` → *delights in the seen*
    - Separator line
    - Reason: `apariññātaṁ tassā` → *"not fully understood"*

11. **Right / teal** — `AWAKENED` header, clear-sight icon.
    - Verb chain with full Pali example (using `diṭṭha`):
      - `diṭṭhaṁ diṭṭhato abhijānāti` → *directly knows the seen as the seen*
      - ↓
      - **5 negated modes** (mirroring the left):
        - `diṭṭhaṁ na maññati` → does not conceive [as] the seen
        - `diṭṭhasmiṁ na maññati` → does not conceive in the seen
        - `diṭṭhato na maññati` → does not conceive from the seen
        - `diṭṭhaṁ me ti na maññati` → does not conceive "mine"
      - ↓
      - `diṭṭhaṁ nābhinandati` → *does not delight in the seen*
    - Separator line
    - Reason: `pariññātaṁ tassā` → *"fully understood"*

12. Central gold divider line between panels

**Phase 4: Remaining 20 Phenomena Grid (steps 13–18, y: 490–920)**

Since diṭṭha/suta/muta/viññāta are already shown as the worked example above, the grid displays the **remaining 20 phenomena** the same pattern applies to. A bridging label emphasizes this: *"The same pattern of conceiving applies across all phenomena…"*

5 category rows, each with a gold tier label + 4 items (icon + Pali 12px italic + English 14px bold):

| Row | Category Label (gold) | Pali | Items |
|-----|----------------------|------|-------|
| 1 | FOUR ELEMENTS / `cattāro mahābhūtā` | pathavī, āpo, tejo, vāyo | earth, water, fire, air |
| 2 | BEINGS & COSMOLOGICAL / `bhūtā devā` | bhūtā, devā, pajāpati, brahmā | beings, deities, creator god, Brahmā |
| 3 | JHĀNA REALMS / `jhāna-bhūmi devā` | ābhassarā, subhakiṇhā, vehapphalā, abhibhū | Streaming Radiance, Refulgent Glory, Great Fruit, Overlord |
| 4 | FORMLESS BASES / `arūpa-āyatanā` **(2×2 sub-grid)** | ākāsānañcāyatana, viññāṇañcāyatana, ākiñcaññāyatana, nevasaññānāsaññāyatana | boundless space, boundless consciousness, nothingness, neither-perception-nor-non-perception |
| 5 | ABSTRACT / `paññatti` | ekatta, nānatta, sabba, nibbāna | oneness, diversity, all, Nibbāna (gold accent) |

Icon ideas per row: (1) ground-lines / waves / flame / wind-curves, (2) two-figures / halo-figure / crown / radiant-figure, (3) radiating-lines / filled-glow / orb / crowned-orb, (4) expanding-circle / concentric-circles / dashed-empty-circle / half-visible-circle, (5) single-dot / scattered-dots / enclosing-circle / extinguishing-flame

> Note: The sense experience row (diṭṭha, suta, muta, viññāta) is omitted from the grid since those 4 are already used as the worked example in Phase 3.

**Phase 5: Eight Levels Progression (steps 19–23, y: 930–1480)**

Each level shows its **distinct verb forms** — this is the key grammatical shift across levels:

19. Gold tier label bar: `EIGHT LEVELS OF UNDERSTANDING` / `aṭṭha naya-bhūmi`

20. **Level ① Puthujjana** (burgundy panel) — `assutavā puthujjano` / uninstructed ordinary person
    - Verbs: `sañjānāti` → `maññati` → `abhinandati` (perceives → **conceives** → delights)
    - Reason: `apariññātaṁ tassā` → *"not fully understood"*

21. **Level ② Sekha** (transitional blue panel) — `sekkho appattamānaso` / trainee who has not yet reached the goal
    - Verbs: `abhijānāti` → `mā maññi` → `mābhinandi` (directly knows → **should not conceive** → should not delight)
    - Note: imperative mood (`mā` + aorist) — the trainee is *actively restraining* from conceiving
    - Reason: `pariññeyyaṁ tassā` → *"should be fully understood"* (gerundive — potential/obligation)

22. **Levels ③–⑥ Arahant** (teal, 2×2 grid) — `arahaṁ khīṇāsavo` / arahant with taints destroyed
    - Verbs: `abhijānāti` → `na maññati` → `nābhinandati` (directly knows → **does not conceive** → does not delight)
    - Note: simple negation (`na`) — conceiving has naturally ceased
    - 4 distinct reasons (one per sub-cell):
      - ③ `pariññātaṁ tassā` → *"fully understood"*
      - ④ `khayā rāgassa, vītarāgattā` → *"through destruction of lust"*
      - ⑤ `khayā dosassa, vītadosattā` → *"through destruction of hatred"*
      - ⑥ `khayā mohassa, vītamohattā` → *"through destruction of delusion"*

23. **Levels ⑦–⑧ Tathāgata** (gold-accented panel, radial glow) — `tathāgato arahaṁ sammāsambuddho`
    - Verbs: same as Arahant (`abhijānāti → na maññati → nābhinandati`)
    - 2 distinct reasons:
      - ⑦ `pariññātantaṁ tathāgatassa` → *"fully understood by the Tathāgata"*
      - ⑧ `nandī dukkhassa mūlaṁ` → *"delight is the root of suffering"*
         + `bhavā jāti bhūtassa jarāmaraṇaṁ` → *"from existence, birth; for one born, aging & death"*
         + `sabbaso taṇhānaṁ khayā … anuttaraṁ sammāsambodhiṁ abhisambuddho`

> **The grammatical arc across the 8 levels:**
> `maññati` (conceives) → `mā maññi` (should not conceive) → `na maññati` (does not conceive)
> This is the central progression the diagram should make visually legible.

**Phase 6: Conclusion (steps 24–28, y: 1490–1600)**
24. Gold radial glow background
25. `nandī dukkhassa mūlaṁ` — 16px bold gold, glow2 filter
26. *"Delight is the root of suffering"* — 14px italic
27. `Na te bhikkhū bhagavato bhāsitaṁ abhinandun ti` — 12px italic, dimmed (#607880)
28. *"The bhikkhus did not delight in the Blessed One's words"* — 12px italic

---

### Key Text Pairings

**Core Verbs (3 grammatical forms across levels):**
- ① Puthujjana: `sañjānāti` → `maññati` → `abhinandati` (perceives → **conceives** → delights)
- ② Sekha: `abhijānāti` → `mā maññi` → `mābhinandi` (directly knows → **should not conceive** → should not delight)
- ③–⑧ Arahant/Tathāgata: `abhijānāti` → `na maññati` → `nābhinandati` (directly knows → **does not conceive** → does not delight)

**5 Modes of Maññanā** (using *diṭṭha* — the seen — as worked example):
- `diṭṭhaṁ maññati` → conceives [himself as] the seen
- `diṭṭhasmiṁ maññati` → conceives [himself] in the seen
- `diṭṭhato maññati` → conceives [himself apart] from the seen
- `diṭṭhaṁ me ti maññati` → conceives the seen to be "mine"
- `diṭṭhaṁ abhinandati` → delights in the seen

**8 Level Reasons:**
① `apariññātaṁ tassā` → not fully understood
② `pariññeyyaṁ tassā` → should be fully understood
③ `pariññātaṁ tassā` → fully understood
④ `khayā rāgassa, vītarāgattā` → through destruction of lust
⑤ `khayā dosassa, vītadosattā` → through destruction of hatred
⑥ `khayā mohassa, vītamohattā` → through destruction of delusion
⑦ `pariññātantaṁ tathāgatassa` → fully understood by the Tathāgata
⑧ `nandī dukkhassa mūlaṁ` → delight is the root of suffering

---

### Font Sizes Reference

| Element | Size | Weight/Style | Color |
|---------|------|-------------|-------|
| Main title | 22px | bold, letter-spacing 3 | #a0b0c8 |
| Subtitle | 15px | italic | #708090 |
| Panel headers | 12px | bold, letter-spacing 1.5 | #a08090 / #6898a0 |
| Pali verbs (emphasis) | 15px | bold italic | #c0a8b8 / #90c0b0 |
| English verbs | 14px | italic | #b098b0 / #80b8a8 |
| Tier category labels | 13px | bold, letter-spacing 3 | #c8a040 |
| Phenomenon name (EN) | 14px | bold | #b098b0 |
| Phenomenon name (Pali) | 12px | italic | #807088 |
| Conclusion key phrase | 16px | bold + glow2 | #c8a040 |
| Final Pali | 12px | italic | #607880 |

---

### Verification
1. Render in browser — confirm all Pali diacriticals (ā, ī, ū, ṁ, ṇ, ṅ, ḷ, ḍ) display correctly
2. Side-by-side with mn113.svg — visual consistency check
3. Zoom to 50% — all text remains legible
4. XML validation — well-formed SVG, no unclosed tags
5. Import into Astro site and verify rendering alongside other discourse diagrams

### Decisions
- **Literal Pali characters** (e.g. `maññati` not `ma&#xF1;&#xF1;ati`) — per user preference for editability
- **920px width** — consistent with all 7 existing discourse SVGs
- **Height ~1600px** — may extend to 1700 if the phenomena grid feels cramped
- **Arahant levels 3–6 grouped as 2×2** — they share identical verb patterns, differ only in reason
- **Formless bases in 2×2 sub-grid** — names too long for 4-column
- **Famous ending included** (*"the bhikkhus did not delight"*) — distinctive and thematically perfect for this sutta about delighting
- **Scope**: single SVG file only, no other file changes

### Further Considerations
1. **Nibbāna special treatment** — It's the 24th and final phenomenon, and uniquely it appears in both the conceiving and non-conceiving sections. Should it get extra visual emphasis (gold outline, larger icon)? **Recommendation: yes, subtle gold accent.**
2. **Formless base labels** — `nevasaññānāsaññāyatana` is 26+ chars. Use abbreviated display? **Recommendation: keep full Pali but use 11px font for this row only, with a 2×2 layout giving ~420px per item.**
3. **Progressive shading in the 8 levels** — Should levels visually darken/lighten to show progression from ignorance to awakening? **Recommendation: yes, transition from burgundy (level 1) → blue (level 2) → teal (levels 3–6) → gold-tinted (levels 7–8), mirroring the project's established color semantics.**
