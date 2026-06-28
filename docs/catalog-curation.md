# Catalog curation rubric

Catalog YAML supplies **title, description, qualities, and theme** for reference-only discourses (Pāli + Sujato translation, no curated English MDX). Entries live at `src/content/catalog/{collection}/{slug}.yaml` and are compiled into `src/data/collectionReferenceIndex.ts` at build time.

## Purpose

Reference-only discourses appear on collection index pages and in search via the combined reference index. Curated metadata should match the tone and structure of existing English frontmatter in the same collection.

## Required fields

| Field | Rules |
| --- | --- |
| `slug` | Must match filename and Pāli/Sujato reference path |
| `title` | Short English title (from Sujato ref or curated override) |
| `description` | One or two sentences; third person; names the teacher and teaching focus |
| `qualities` | Comma-separated list; **every token must exist** in `src/data/qualities.json` (positive, negative, or neutral) |
| `theme` | Comma-separated keys from `src/data/themes.json` |

## Description style (AN4 exemplar)

Match curated EN AN4 descriptions:

- Lead with **who teaches** (“The Buddha describes…”, “The Buddha explains…”, “The Buddha teaches…”).
- State the **numerical frame** when present (“the four…”, “four kinds of…”).
- Summarize **content**, not mood or commentary.
- Prefer concrete doctrinal terms from the discourse (ethical conduct, collectedness, fetters, etc.).
- Keep to **one sentence** when possible; two only when enumerating four items briefly.

**Good:** “The Buddha describes the four yokes—sensual pleasures, future lives, views, and ignorance—and how not understanding their origin, disappearance, gratification, drawback, and escape keeps them binding.”

**Avoid:** vague summaries (“A teaching on practice”), meta commentary (“This sutta is important”), or copying the opening line verbatim without synthesis.

## Qualities selection

1. Read the Sujato reference at `src/content/references/sujato/{collection}/{slug}.md`.
2. Choose **3–6 primary qualities** explicitly taught or exemplified—not every keyword hit.
3. Prefer qualities that distinguish this discourse from neighbors in the same vagga.
4. Use canonical spellings from `qualities.json` (e.g. `ethical conduct`, not `morality`).
5. Include both wholesome and unwholesome qualities when the discourse contrasts them.

## Theme selection

Choose **1–2** themes from `themes.json`:

| Theme | Use when |
| --- | --- |
| `wisdom` | Understanding, reflection, insight into phenomena |
| `principle` | Foundational frameworks, numbered sets as doctrine |
| `training guideline` | Practice instructions, meditation, path factors |
| `cultivating discernment` | Comparisons, dichotomies, systematic pairs |
| `inquisitiveness` | Encourages investigation or questioning |
| `inspiration` | Faith, confidence, urgency to practice |
| `directly knowing` | Emphasis on direct experience or realization |
| `recollection of the Buddha` | Buddha's qualities as object of reflection |
| `urgency` | Impermanence, death, prompt effort |
| `story` | Narrative or parable structure |

## Batched curation workflow

1. `node scripts/curate-catalog-draft.mjs --collection an4 --batch-size 10` — prints batch prompts from Sujato refs (for LLM or manual review).
2. `node scripts/curate-catalog-draft.mjs --collection an4 --write` — writes draft YAML from heuristics (review before shipping).
3. `node scripts/apply-an3-dn-curation.mjs --collection an3` — apply AN3 curation to Sujato frontmatter only.
4. `node scripts/apply-an3-dn-curation.mjs --collection an5` — apply AN5 curation to Sujato frontmatter only.
5. `node scripts/apply-an3-dn-curation.mjs --collection an6|an7|an8|an9|an10|an11` — apply AN6–AN11 curation to Sujato frontmatter only.
6. `node scripts/apply-an3-dn-curation.mjs --collection dn` — apply DN curation to Sujato frontmatter only.
7. `node scripts/apply-an3-dn-curation.mjs --collection=sn1|sn2|…|sn56|snp1|snp2|snp3` — apply SN/SNP curation to Sujato frontmatter only.
8. `node scripts/apply-an3-dn-curation.mjs --collection=--all-sn-remaining` — apply all pending SN saṃyuttas in one pass.
9. `npx tsx src/utils/validateCatalog.ts` — validate all catalog files.
10. `npx tsx src/utils/generateCollectionReferenceIndex.ts` — rebuild index.

## Curation rollout

| Collection | Status | Slugs | Script |
| --- | --- | --- | --- |
| MN | done | 47 | `scripts/apply-mn-curation.mjs` |
| AN2, AN4 | done (pilots) | varies | `scripts/curate-catalog-draft.mjs` |
| **AN3** | **done** | **123** | `scripts/apply-an3-dn-curation.mjs` |
| **AN5** | **done** | **239** | `scripts/apply-an3-dn-curation.mjs` |
| **AN6** | **done** | **98** | `scripts/apply-an3-dn-curation.mjs` |
| **AN7** | **done** | **79** | `scripts/apply-an3-dn-curation.mjs` |
| **AN8** | **done** | **72** | `scripts/apply-an3-dn-curation.mjs` |
| **DN** | **done** | **33** | `scripts/apply-an3-dn-curation.mjs` |
| **SN1, SN8, SN10** | **done** | **77** | `scripts/apply-an3-dn-curation.mjs` |
| **SN2, SN4, SN6** | **done** | **58** | `scripts/apply-an3-dn-curation.mjs` |
| **SN12, SN22, SN35** | **done** | **325** | `scripts/apply-an3-dn-curation.mjs` |
| **SN11, SN19, SN36** | **done** | **71** | `scripts/apply-an3-dn-curation.mjs` |
| **SN23, SN24, SN29, SN30** | **done** | **78** | `scripts/apply-an3-dn-curation.mjs` |
| **SN45, SN46, SN47** | **done** | **193** | `scripts/apply-an3-dn-curation.mjs` |
| **SN37, SN44, SN48, SN49, SN50** | **done** | **126** | `scripts/apply-an3-dn-curation.mjs` |
| **SN5, SN18, SN21** | **done** | **36** | `scripts/apply-an3-dn-curation.mjs` |
| **SN31, SN32, SN39, SN40** | **done** | **28** | `scripts/apply-an3-dn-curation.mjs` |
| **SN16, SN26, SN27** | **done** | **32** | `scripts/apply-an3-dn-curation.mjs` |
| **SN3, SN7, SN9, SN15, SN17, SN28, SN33–SN34, SN38, SN41–SN43, SN51–SN56** | **done** | **328** | `scripts/apply-an3-dn-curation.mjs --collection=--all-sn-remaining` |
| **SN (all ref-only)** | **done** | **1352** | `scripts/apply-an3-dn-curation.mjs` |
| **SNP1, SNP2, SNP3** | **done** | **23** | `scripts/apply-an3-dn-curation.mjs` |
| **AN9** | **done** | **74** | `scripts/apply-an3-dn-curation.mjs` |
| **AN10** | **done** | **195** | `scripts/apply-an3-dn-curation.mjs` |
| **AN11** | **done** | **31** | `scripts/apply-an3-dn-curation.mjs` |
| AN12+ | pending | — | — |

Metadata is written to `src/content/references/sujato/{collection}/{slug}.md` frontmatter (`description`, `qualities`, `theme`) via `buildSujatoMarkdown` — not catalog YAML.

## Range discourses

Grouped slugs (e.g. `an4.277-303`) may have terse Sujato stubs. Descriptions should state the **repeated formula** and range purpose rather than inventing per-sutta detail.
