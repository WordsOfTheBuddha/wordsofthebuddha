## Plan: MN2 Sabbāsava Sutta — SVG Visualization

A vertical dark-themed SVG (920×1520px) that visualizes the central teaching: wise vs unwise attention, and the seven methods for abandoning taints. It reuses the established design language (dark blue backgrounds, gold accents, Georgia serif, glow filters, Pali in italic) from the three reference SVGs.

---

**Steps**

### Phase 1: Header & Core Contrast (y: 0–240)

1. **Title block** — "MN 2 — SABBĀSAVA SUTTA" / "Overcoming Of All The Taints", decorative line, subtitle: *"For one who knows and sees"*
2. **Core contrast panel** *(modeled on MN113's asappurisa/sappurisa boxes)*
   - **Left**: Unwise Attention (*ayoniso manasikāra*) — purple-tinted panel, tangled-lines icon — "Taints arise and increase"
   - **Right**: Wise Attention (*yoniso manasikāra*) — teal-tinted panel, clear-lines icon — "Taints do not arise; arisen taints are abandoned"
   - Gold vertical divider between them

### Phase 2: Method 1 — Seeing (y: 264–560) *— featured section*

3. **Tier label**: "1. SEEING — DASSANĀ" with gold gradient line
4. **Left panel** — *The Six Wrong Views*: speculative questions ("Was I? Will I be?"), the six views, Pali: *diṭṭhigataṁ diṭṭhigahanaṁ* — purple-stroked
5. **Right panel** — *Four Noble Truths → Three Fetters Abandoned*: the four truths listed, then arrow to the three fetters (*sakkāyadiṭṭhi, vicikicchā, sīlabbataparāmāsa*) shown as broken chain links — teal-stroked

> Method 1 gets special treatment because it's the most detailed and structurally distinct section (the gateway of right view).

### Phase 3: Methods 2–7 — Symmetrical 3×2 Grid (y: 580–1380)

6. **Tier label**: "SIX METHODS OF PRACTICE"
7. **Grid: 2 columns × 3 rows** — each cell has numbered circle, English name, Pali, brief description, and a small icon

| Row | Left (Protective) | Right (Active) |
|---|---|---|
| **1** | **2. Restraint** (*saṁvarā*) — eye-with-shield icon, guarding six senses | **3. Proper Use** (*paṭisevanā*) — robe+bowl icon, using four requisites wisely |
| **2** | **4. Enduring** (*adhivāsanā*) — figure-standing-firm icon, enduring cold/heat/pain/harsh-words | **5. Avoiding** (*parivajjanā*) — diverging-path icon, avoiding wild animals/bad companions/bad places |
| **3** | **6. Removing** (*vinodanā*) — dispelled-thought icon, not tolerating sensual/ill-will/harmful thoughts | **7. Cultivation** (*bhāvanā*) — seven-dot-arc icon, cultivating the seven awakening factors |

Left column = protective/restraining. Right column = active/engaged. The 6 items give **perfect bilateral symmetry**.

### Phase 4: Conclusion (y: 1400–1520)

8. **Result bar** — teal-glowing panel: *"Freed from suffering — cut off craving, unraveled the fetter"* / *"acchecchi taṇhaṁ, vivattayi saṁyojanaṁ"*
9. **Source reference**: "Majjhima Nikāya 2" at bottom

---

**Relevant files**
- `src/assets/content-images/mn113.svg` — reuse `defs` structure (bg gradient, glow filters, tier label pattern), left/right contrast box layout
- `src/assets/content-images/mn20.svg` — reuse sequential panel styling, step numbering with circles, Pali caption positioning
- `src/assets/content-images/an10.51.svg` — reuse paired column layout, numbered rows, subtle separators
- `src/content/en/mn/mn2.mdx` — English translation text source
- `src/content/pli/mn/mn2.md` — Pali text source

**Output**: `src/assets/content-images/mn2.svg`

---

**Verification**
1. Open the SVG in browser — verify rendering at 920px width
2. Check text legibility against dark background
3. Verify bilateral symmetry: contrast boxes, 3×2 grid cells, consistent sizing
4. Verify Pali diacritics (ṁ, ā, ī, ū, ṭ, ṇ, ḍ, ñ)
5. Compare visual weight and color palette against the three reference SVGs

---

**Further Considerations**
1. **Method 1 internal layout**: Side-by-side (Six Wrong Views left, Four Truths right) vs top-to-bottom? **Rec: side-by-side** for consistency with the contrast panel above.
2. **Seven Awakening Factors in Method 7**: List all seven as small text (*sati, dhammavicaya, vīriya, pīti, passaddhi, samādhi, upekkhā*) since the sutta enumerates them explicitly. **Rec: list them.**
3. **Grid grouping alternative**: Could group by sutta logic (prevent vs abandon) instead of protective/active — but the current split maintains better visual balance per row.
