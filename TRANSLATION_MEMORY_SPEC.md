# Translation Memory Feature Specification

## Overview

A development-mode feature that assists translators by automatically finding and displaying similar Pali passages that have already been translated elsewhere in the corpus. When paragraphs are pending translation ("Translation in progress..."), the system shows matches from the existing translation database, allowing the translator to quickly reference how similar phrases were rendered previously.

---

## High-Level Requirements

### 1. Match Detection

| Requirement         | Description                                                                                                              |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| **Match Types**     | Three levels: Paragraph (80%+ similar), Phrase (clause/sentence, 85%+ similar), Partial (4+ consecutive words)           |
| **Priority**        | Show highest quality matches first: Paragraph > Phrase > Partial. Only fall back to lower types if higher not found      |
| **Diversity**       | When matches have similar quality (within 3% error bar), prefer diversity across collections. Otherwise, rank by match % |
| **Skip Phrases**    | Author-editable list of common stock phrases to exclude from matching (e.g., "Evaṃ me sutaṃ")                            |
| **Sandhi Handling** | Use `paliSandhi.json` to expand compound words when matching, improving fuzzy match accuracy                             |

### 2. Data & Indexing

| Requirement        | Description                                                                                                                               |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- |
| **Build Time**     | Index is pre-computed via build script (runs in `pre-dev` or manually)                                                                    |
| **Index Content**  | For each translated paragraph: normalized Pali, original Pali, **original English**, source reference (suttaId, paragraphNum, collection) |
| **N-gram Index**   | 4-word sequences mapped to source references for fast partial matching                                                                    |
| **No Runtime API** | All match data (including English) is pre-indexed. Popover displays from stored data, no fetch calls                                      |

### 3. UI/UX

| Requirement           | Description                                                                                               |
| --------------------- | --------------------------------------------------------------------------------------------------------- |
| **Trigger Location**  | Replaces "Translation in progress..." text with clickable match summary                                   |
| **Summary Text**      | e.g., "Found 1 paragraph match", "Found 2 phrase matches", "Found 3 partial matches"                      |
| **Popover Display**   | Shows matches in order of quality. Each match shows: Pali phrase + English translation                    |
| **Context Expansion** | Surrounding paragraph context is hidden by default (collapse pattern), expandable inline without API call |
| **Navigation**        | Links to source discourses open in new tab for reference                                                  |
| **Dev Mode Only**     | Feature only active when `import.meta.env.DEV` is true                                                    |

### 4. Match Ranking Logic

```
IF matches exist at similar quality (within 3% of each other):
    Prefer diversity: select up to 3 from unique collections
ELSE:
    Rank by match percentage, highest first
    Return top 3 regardless of collection

Display order: Paragraph matches > Phrase matches > Partial matches
(Only show lower tier if higher tier has no matches)
```

**Distinct Phrase Detection:** When a source paragraph contains multiple reusable phrases, the algorithm detects them separately:

- If a smaller match (5+ fewer words) exists that is a subset of a larger match, it's shown as a separate phrase group
- Example: "Tassa, bhikkhave... nappaṭikkositabbaṁ" might match mn112 fully, while "tena bhagavatā jānatā passatā" matches mn119 separately
- Both are shown as distinct tabs, allowing the translator to see how each phrase was rendered elsewhere

### 5. Thresholds (Configurable Constants)

```typescript
const THRESHOLDS = {
	PARAGRAPH_SIMILARITY: 0.8, // 80% for paragraph-level match
	PHRASE_SIMILARITY: 0.85, // 85% for phrase-level match
	PARTIAL_MIN_WORDS: 4, // Minimum consecutive words for partial (4 to reduce noise)
	PARTIAL_MAX_FREQUENCY: 0.1, // Skip n-grams appearing in >10% of paragraphs (too common)
	DIVERSITY_ERROR_BAR: 0.03, // 3% - prefer collection diversity within this range
	MAX_MATCHES: 3, // Maximum matches to display
	MIN_WORDS_TO_INDEX: 4, // Skip paragraphs shorter than this
	WORD_COUNT_TOLERANCE: 0.2, // Pre-filter: only compare paragraphs within ±20% word count
};
```

---

## Algorithms

### Similarity Metric

Use **token-based Sørensen–Dice coefficient** for primary similarity scoring:

```typescript
function similarity(a: string[], b: string[]): number {
	// a and b are arrays of normalized words
	const setA = new Set(a);
	const setB = new Set(b);
	const intersection = [...setA].filter((x) => setB.has(x)).length;
	return (2 * intersection) / (setA.size + setB.size);
}
```

**Why Sørensen–Dice over Jaccard?**

- Same complexity (O(n))
- Gives higher scores for partial overlaps, better for translation context
- Range 0-1, intuitive threshold setting

**Tie-breaking:** When Dice scores are equal, use word-order Levenshtein ratio as secondary metric:

```typescript
function levenshteinRatio(a: string[], b: string[]): number {
	// Standard Levenshtein on word arrays
	const m = a.length,
		n = b.length;
	const dp: number[][] = Array(m + 1)
		.fill(null)
		.map(() => Array(n + 1).fill(0));

	for (let i = 0; i <= m; i++) dp[i][0] = i;
	for (let j = 0; j <= n; j++) dp[0][j] = j;

	for (let i = 1; i <= m; i++) {
		for (let j = 1; j <= n; j++) {
			dp[i][j] =
				a[i - 1] === b[j - 1]
					? dp[i - 1][j - 1]
					: 1 +
						Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
		}
	}

	const maxLen = Math.max(m, n);
	return maxLen === 0 ? 1 : 1 - dp[m][n] / maxLen;
}
```

### Phrase Segmentation

Pali paragraphs are split into "phrases" at these boundaries:

- `।` (danda)
- `.` (period)
- `;` (semicolon)
- `?` (question mark)

```typescript
function segmentPhrases(text: string): string[] {
	return text
		.split(/[।.;?]+/)
		.map((s) => s.trim())
		.filter((s) => s.length > 0);
}
```

Each phrase is matched independently. A "phrase match" is when any phrase from the query matches any phrase in the corpus at ≥85% similarity.

**Display clarification:** When showing a phrase match, we highlight the **corpus phrase** (from the indexed source), since that's what the translator will copy. The query phrase is what triggered the match but isn't displayed separately.

### Partial Match (N-gram) Strategy

1. **Index time:** Generate 4-word n-grams; skip n-grams that appear in >10% of paragraphs
2. **Query time:** Generate 4-word n-grams from query; look up in index
3. **Score:** Count how many n-grams matched; report longest contiguous matched sequence

```typescript
// N-gram with IDF filtering
type NgramIndex = {
	ngrams: Record<string, string[]>; // ngram → source refs
	documentCount: number; // total paragraphs for IDF calculation
};

function shouldIndexNgram(
	ngram: string,
	frequency: number,
	docCount: number,
): boolean {
	return frequency / docCount <= THRESHOLDS.PARTIAL_MAX_FREQUENCY;
}
```

### Performance Optimization: Pre-filtering

Before expensive similarity computation, filter candidates:

```typescript
function preFilterCandidates(
	queryWordCount: number,
	entries: TMEntry[],
): TMEntry[] {
	const tolerance = THRESHOLDS.WORD_COUNT_TOLERANCE;
	const minWords = queryWordCount * (1 - tolerance);
	const maxWords = queryWordCount * (1 + tolerance);
	return entries.filter(
		(e) => e.wordCount >= minWords && e.wordCount <= maxWords,
	);
}
```

This reduces O(n) full comparisons to a much smaller candidate set.

### Skip Phrases

Skip phrases are matched as **exact substrings** on normalized text:

```typescript
function containsSkipPhrase(
	normalized: string,
	skipPhrases: string[],
): boolean {
	return skipPhrases.some((skip) => normalized.includes(skip));
}

function calculateSkipPhraseRatio(
	normalized: string,
	skipPhrases: string[],
): number {
	let skipLength = 0;
	for (const skip of skipPhrases) {
		if (normalized.includes(skip)) {
			skipLength += skip.length;
		}
	}
	return skipLength / normalized.length;
}
```

**Skip phrase handling:**

- If >50% of the normalized text **by character count** consists of skip phrases, skip the entire paragraph
- Otherwise, exclude the skip phrase portions from n-gram generation but still match the rest

**Note:** Character count (not word count) is used because skip phrases vary in length and this gives a more accurate measure of how much of the paragraph is formulaic.

---

## Data Structures

### Translation Memory Index (JSON)

```typescript
// Generated at: src/data/translationMemory.json

interface TranslationMemoryIndex {
	version: number;
	generatedAt: string;
	skipPhrases: string[];
	entries: TMEntry[];
	ngramIndex: Record<string, string[]>; // ngram → ["suttaId:paragraphNum", ...]
	documentCount: number; // total paragraphs for IDF calculation
}

interface TMEntry {
	/** Normalized Pali (lowercase, no punctuation, sandhi-expanded) */
	paliNormalized: string;
	/** Original Pali text for display */
	paliOriginal: string;
	/** Corresponding English translation */
	englishOriginal: string;
	/** Word count for quick filtering */
	wordCount: number;
	/** Source reference */
	source: {
		suttaId: string; // e.g., "mn1", "sn22.59"
		paragraphNum: number; // e.g., 5
		collection: string; // e.g., "mn", "sn"
	};
}
```

### Match Result (Runtime)

```typescript
interface TMMatch {
	matchType: "paragraph" | "phrase" | "partial";
	similarity: number; // 0-1
	/** The specific Pali text that matched */
	matchedPali: string;
	/** Full source paragraph Pali (for context expansion) */
	fullPali: string;
	/** Full source paragraph English (for display) */
	fullEnglish: string;
	/** Source reference */
	source: {
		suttaId: string;
		paragraphNum: number;
		collection: string;
	};
}

interface TMMatchSummary {
	bestMatchType: "paragraph" | "phrase" | "partial" | "none";
	matches: TMMatch[];
	summaryText: string; // e.g., "Found 2 phrase matches"
}
```

---

## Text Normalization

### Pali Normalization

Before matching, Pali text is normalized to improve match accuracy:

```typescript
function normalizePali(text: string): string {
	return (
		text
			.toLowerCase()
			// Strip all quotes (single, double, curly)
			.replace(/['"'"'"«»„"]/g, "")
			// Strip punctuation including colons
			.replace(/[.,;:!?…—–\-\(\)\[\]\{\}]/g, "")
			// Normalize whitespace
			.replace(/\s+/g, " ")
			.trim()
	);
}
```

### English Gloss Handling

English paragraphs may contain gloss syntax: `|Nibbāna::definition text [nibbāna]|`

**Display:** Render glosses with `.tooltip-text` class so `BottomDrawer.astro` handles them:

```html
<span class="tooltip-text" data-tooltip-content="definition text [nibbāna]"
	>Nibbāna</span
>
```

This reuses existing infrastructure — clicking a gloss in the popover opens the same bottom drawer.

**Copy with raw gloss syntax:** When translator selects English text in the popover, a floating "Copy raw" tooltip appears. Clicking it copies the raw markdown including gloss patterns:

```
|Nibbāna::the unconditioned; lit. extinguishing [nibbāna]|
```

This is achieved by:

1. Storing raw English in a `data-raw-english` attribute
2. Listening for `mouseup` events on the selectable text area
3. Showing a floating copy button near the selection
4. On click, copying the raw text (full paragraph if entire text selected, otherwise selected portion)

Note: The main discourse highlight menu is not active inside the TM popover to avoid conflicts.

---

## Sandhi Handling

The `paliSandhi.json` file maps compound/sandhi words to their components:

```json
{
	"yennūna": ["yaṁ", "nūna"],
	"dhammañhi": ["dhammaṁ", "hi"],
	"tenahānanda": ["tena", "hānanda"]
}
```

**Usage in matching:**

1. **During indexing:** Expand sandhi forms to component words before generating n-grams
2. **During query:** Expand sandhi in the query text before searching
3. **Benefit:** `"dhammañhi"` in query will match `"dhammaṁ hi"` in corpus and vice versa

```typescript
function expandSandhi(
	text: string,
	sandhiMap: Record<string, string[]>,
): string {
	let expanded = text;
	for (const [compound, parts] of Object.entries(sandhiMap)) {
		// Extract just the words (strip definitions after colon)
		const words = parts.map((p) => p.split(":")[0]);
		expanded = expanded.replace(
			new RegExp(compound, "gi"),
			words.join(" "),
		);
	}
	return expanded;
}
```

---

## Implementation Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        BUILD TIME                               │
│                                                                 │
│  scripts/buildTranslationMemory.ts                             │
│  ├── Scan src/content/pli/**/*.md (Pali files)                 │
│  ├── Check corresponding src/content/en/**/*.md exists         │
│  ├── For each translated paragraph:                            │
│  │   ├── Normalize Pali (lowercase, strip punctuation)         │
│  │   ├── Expand sandhi using paliSandhi.json                   │
│  │   ├── Store: paliNormalized, paliOriginal, englishOriginal  │
│  │   └── Generate 4-word n-grams → ngramIndex                  │
│  └── Output: src/data/translationMemory.json                   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                      DEV SERVER TIME                            │
│                                                                 │
│  src/utils/translationMemory.ts                                │
│  ├── loadIndex(): Load translationMemory.json                  │
│  ├── findMatches(paliText): Query the index                    │
│  │   ├── Check paragraph-level similarity first                │
│  │   ├── If no paragraph match, check phrase-level             │
│  │   ├── If no phrase match, check partial (n-gram lookup)     │
│  │   ├── Apply diversity/ranking logic                         │
│  │   └── Return TMMatchSummary                                 │
│  └── Exports functions for contentParser.ts                    │
│                                                                 │
│  src/utils/contentParser.ts (processBlocks modification)       │
│  ├── For "Translation in progress" paragraphs:                 │
│  │   ├── Call findMatches(paliText)                            │
│  │   ├── If matches found: embed match data in HTML            │
│  │   └── Replace placeholder text with match summary           │
│  └── Match data stored in data-* attributes (JSON-encoded)     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                       CLIENT SIDE                               │
│                                                                 │
│  src/components/TranslationMatches.astro                       │
│  ├── Click handler on .translation-matches elements            │
│  ├── Parse match data from data-matches attribute              │
│  ├── Display popover with:                                     │
│  │   ├── Match type badge + similarity %                       │
│  │   ├── Source reference (suttaId.paragraphNum)               │
│  │   ├── Matched Pali phrase (highlighted)                     │
│  │   ├── English translation                                   │
│  │   └── Expand button → show full paragraph context           │
│  ├── Context expansion uses stored data (no API call)          │
│  └── Close on outside click                                    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## File Structure

```
src/
├── data/
│   ├── translationMemory.json    # Generated index (GITIGNORED - dev only)
│   ├── skipPhrases.json          # Author-editable skip list
│   └── paliSandhi.json           # Existing sandhi mappings
├── utils/
│   ├── translationMemory.ts      # Matching logic
│   └── contentParser.ts          # Modified to integrate TM
├── components/
│   └── TranslationMatches.astro  # Popover UI component
├── types/
│   └── translationMemory.ts      # Type definitions
scripts/
└── buildTranslationMemory.ts     # Index builder script
```

**Note:** `translationMemory.json` should be added to `.gitignore`. This is a dev-only feature, and the index is regenerated on `npm run dev`. This keeps the repo smaller and avoids stale index issues.

---

## MVP (Phase 0): Validation Sprint ✅ COMPLETED

**Goal:** Validate the core hypothesis with minimal investment before building the full feature.

**Status:** MVP validated successfully. The feature surfaced genuinely useful matches during real translation work, leading to Phase 1 implementation.

---

## Phase 1: Enhanced Matching ✅ IMPLEMENTED

**Goal:** Full partial phrase matching with n-gram index, grouping, and polished UI.

### What's Implemented

#### Index & Matching

| Feature                         | Status | Notes                                          |
| ------------------------------- | ------ | ---------------------------------------------- |
| N-gram index (5-word sequences) | ✅     | ~135K ngrams, ~11K entries                     |
| Content word matching           | ✅     | Stop words filtered for grouping               |
| Subset detection                | ✅     | Smaller phrase matches merged into larger ones |
| Collection diversity            | ✅     | Prefers matches from different collections     |
| Word count pre-filter           | ✅     | ±20% tolerance for candidates                  |
| Current sutta exclusion         | ✅     | Skips matches from the page you're viewing     |

#### Stop Words

| Feature         | Status | Notes                                                   |
| --------------- | ------ | ------------------------------------------------------- |
| Basic particles | ✅     | ca, pi, kho, vā, hi, etc.                               |
| Demonstratives  | ✅     | ime, imā, imāni, imaṁ                                   |
| Vocatives       | ✅     | bhikkhave, bhikkhavo, bhikkhu, bhikkhū, bhikkhuno, etc. |
| Honorifics      | ✅     | āyasmā, āyasmant, āyasmantaṁ, āyasmato, āyasmante       |

#### UI/UX

| Feature                   | Status | Notes                                              |
| ------------------------- | ------ | -------------------------------------------------- |
| Popover with tabs         | ✅     | Multiple phrase groups shown as tabs               |
| Source highlighting       | ✅     | Matched segment highlighted in source paragraph    |
| Matched Pali highlighting | ✅     | Same highlight in the matched entry                |
| Discourse links           | ✅     | Each match links to source discourse               |
| Collection badges         | ✅     | Visual indicator for MN, SN, AN, etc.              |
| Word count display        | ✅     | Shows "N words M disc." for each phrase group      |
| Copy on selection         | ✅     | Tooltip with copy button appears on text selection |

#### Text Normalization

| Feature             | Status | Notes                                     |
| ------------------- | ------ | ----------------------------------------- |
| Lowercase           | ✅     |                                           |
| Strip quotes        | ✅     | All Unicode quote types (U+2018-201F)     |
| Punctuation → space | ✅     | Preserves word boundaries (em-dash, etc.) |
| Em-dash handling    | ✅     | "seyyathidaṁ—rūpa" splits correctly       |

#### Debug Tooling

| Feature                       | Status | Notes                                       |
| ----------------------------- | ------ | ------------------------------------------- |
| `tmDebug.loadIndex()`         | ✅     | Load TM index in console                    |
| `tmDebug.getIndexStats()`     | ✅     | Show index statistics                       |
| `tmDebug.getWords(text)`      | ✅     | Check tokenization and normalization        |
| `tmDebug.isStopWord(word)`    | ✅     | Test if word is a stop word                 |
| `tmDebug.findMatchesJSON()`   | ✅     | Find matches for any text                   |
| `tmDebug.getPaliParagraphs()` | ✅     | Get paragraphs from current page            |
| `tmDebug.findPageMatches()`   | ✅     | Full debug with segment, score, word ranges |

### What's Deferred or Changed

| Original Feature                   | Status           | Notes                                              |
| ---------------------------------- | ---------------- | -------------------------------------------------- |
| Sandhi expansion                   | ❌ Deferred      | Would improve fuzzy matching but adds complexity   |
| Skip phrases list                  | ❌ Changed       | Stop words + grouping handles this better          |
| Phrase segmentation (danda/period) | ❌ Changed       | N-gram approach works better than clause splitting |
| Similarity % in display            | ❌ Removed       | Was confusing (showed coverage not quality)        |
| Context expansion (±10 words)      | ❌ Deferred      | Full segment shown; expansion not needed yet       |
| Gloss → tooltip rendering          | ❌ Deferred      | Raw gloss syntax shown (acceptable for now)        |
| 📋 Copy button                     | ✅ Via selection | Selection-based copy works better than button      |

---

## Original MVP Scope (Historical Reference)

### MVP Scope

| In Scope                                 | Out of Scope (defer to full spec)        |
| ---------------------------------------- | ---------------------------------------- |
| Paragraph matching (80% Dice)            | Phrase & partial matching                |
| Word-count pre-filter (±30%)             | N-gram index                             |
| Single best match                        | Top 3 with diversity ranking             |
| Full paragraph display                   | Context expansion (±10 words with ․․․)   |
| Plain text English (glosses shown as-is) | Gloss → tooltip rendering & BottomDrawer |
| Basic click-to-open popover              | 📋 Copy button, styling polish           |
| No sandhi expansion                      | Sandhi handling                          |
| No skip phrase filtering                 | Skip phrase logic                        |

### MVP Index Structure (Simplified)

```typescript
interface MVPTranslationMemoryIndex {
	version: number;
	generatedAt: string;
	entries: MVPTMEntry[];
	// No ngramIndex in MVP
}

interface MVPTMEntry {
	paliNormalized: string;
	paliOriginal: string;
	englishOriginal: string;
	wordCount: number;
	source: {
		suttaId: string;
		paragraphNum: number;
		collection: string;
	};
}
```

### MVP Matching (Simplified)

```typescript
function findBestMatch(
	queryPali: string,
	index: MVPTranslationMemoryIndex,
): MVPMatch | null {
	const queryNormalized = normalizePali(queryPali);
	const queryWords = queryNormalized.split(/\s+/);
	const queryWordCount = queryWords.length;

	// Pre-filter by word count (±30% for MVP - more lenient)
	const candidates = index.entries.filter((e) => {
		const ratio = e.wordCount / queryWordCount;
		return ratio >= 0.7 && ratio <= 1.3;
	});

	// Find best Dice similarity
	let bestMatch: MVPTMEntry | null = null;
	let bestScore = 0;

	for (const entry of candidates) {
		const score = diceSimilarity(
			queryWords,
			entry.paliNormalized.split(/\s+/),
		);
		if (score >= 0.8 && score > bestScore) {
			bestScore = score;
			bestMatch = entry;
		}
	}

	return bestMatch ? { ...bestMatch, similarity: bestScore } : null;
}
```

### MVP UI

```
"Translation in progress..."
    ↓ (if match found)
"📖 Found similar: mn1 ¶5 (84%)"
    ↓ (on click)
┌──────────────────────────────────────────────────┐
│ Similar translation found                    ✕   │
│ mn1 ¶5 (84% match)                              │
├──────────────────────────────────────────────────┤
│ Pali:                                            │
│ Seyyathāpi, bhikkhave, mahāsamuddo eko          │
│ raso loṇaraso; evamevaṃ kho...                  │
│                                                  │
│ English:                                         │
│ Just as the great ocean has one taste, the      │
│ taste of salt; so too this teaching...          │
└──────────────────────────────────────────────────┘
```

- Full paragraph shown (no ±10 word truncation)
- Glosses displayed as raw `|term::def|` syntax (acceptable for MVP)
- Close on click outside or Escape

### MVP Files

| File                                      | Lines (est.) | Purpose                               |
| ----------------------------------------- | ------------ | ------------------------------------- |
| `scripts/buildTranslationMemory.ts`       | ~80          | Index builder (no n-grams, no sandhi) |
| `src/utils/translationMemory.ts`          | ~50          | Dice similarity, single-match lookup  |
| `src/components/TranslationMatches.astro` | ~80          | Basic popover modal                   |
| `src/utils/contentParser.ts`              | +10          | Embed match data in HTML              |

**Estimated effort:** 1-2 days

### MVP Success Criteria

- [ ] Translator confirms ≥3 real-world useful matches during actual translation work
- [ ] Page load remains instant (<100ms additional delay)
- [ ] Index builds in <5 seconds
- [ ] Index size is reasonable (<10MB)

### Post-MVP Decision

| Outcome                    | Action                                            |
| -------------------------- | ------------------------------------------------- |
| **Matches are useful**     | Proceed to full spec (Phases 1-4)                 |
| **Thresholds need tuning** | Adjust 80% threshold before adding complexity     |
| **Matches rarely helpful** | Reconsider feature or pivot to different approach |
| **Performance issues**     | Address before adding phrase/partial matching     |

---

## Implementation Plan (Full Spec)

_Proceed to these phases only after MVP validation._

### Phase 1: Foundation

**Files to create:**

1. `src/data/skipPhrases.json` - Initial skip phrases list
2. `src/types/translationMemory.ts` - Type definitions
3. `scripts/buildTranslationMemory.ts` - Index builder

**package.json addition:**

```json
{
	"scripts": {
		"build:tm": "tsx scripts/buildTranslationMemory.ts",
		"predev": "npm run build:tm"
	}
}
```

**Note:** `predev` (no hyphen) is an npm lifecycle hook that runs automatically before `npm run dev`. This ensures the translation memory index is always fresh when starting the dev server.

### Phase 2: Core Matching Logic ✅ COMPLETE

**Status:** All core matching logic is implemented in `TranslationMatches.astro`:

- `loadTMIndex()` - Load and cache the JSON index
- `normalizePali()` - Normalize text for comparison
- `findNgramMatches()` - N-gram lookup for partial matching
- `findMatches()` - Main entry point
- `selectDiverseDiscourses()` - Collection diversity logic
- `getSourceWordRange()` - Find best contiguous matched segment
- ❌ `expandSandhi()` - Deferred (low priority)

### Phase 3: Integration ✅ COMPLETE

**Status:** Integration is complete:

- `enhanceTranslationPlaceholders()` - Injects TM buttons into "Translation in progress..." spans
- Click handlers on `.tm-match-trigger` and `.tm-lookup-btn`

**File modified:**

1. `src/utils/contentParser.ts`
    - Import `findMatches` from translationMemory
    - Modify `processBlocks()` around line 387-402
    - For untranslated paragraphs, call `findMatches()`
    - Embed match data as JSON in data attribute
    - Update placeholder text with summary

### Phase 4: UI Component ✅ COMPLETE

**Status:** UI component is fully implemented in `TranslationMatches.astro` (~1850 lines):

- `showPopover()` - Full modal popover with phrase tabs + discourse tabs
- `highlightMatches()` - Highlights matched segment in source and matched text
- `renderGlosses()` - Gloss → tooltip rendering with BottomDrawer integration
- Selection-based copy tooltip for raw English
- Keyboard navigation: Arrow keys (←→ within row, ↑↓ between rows), Enter to activate, Escape to close
- Auto-focus on first tab row when popover opens
- Close on Escape or click outside

**File modified:**

1. `src/layouts/Layout.astro` - Conditionally includes `TranslationMatches` in dev mode

---

## All Phases Complete ✅

The Translation Memory feature is fully implemented and ready for use. All original phases have been completed with the following adjustments:

- **Sandhi expansion**: Deferred (low priority, adds complexity)
- **Skip phrases list**: Changed approach - stop words + grouping handles this better
- **Similarity percentage display**: Removed (was confusing)
- **Context expansion (±10 words)**: Deferred - full segment shown instead

---

## Popover UI Mockup (Historical Reference)

```
┌──────────────────────────────────────────────────────────────────┐
│ 🔍 Found 2 phrase matches                                    ✕   │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│ ┌────────────────────────────────────────────────────────────┐  │
│ │ [phrase 92%]  ud5.5 ¶3                                     │  │
│ ├────────────────────────────────────────────────────────────┤  │
│ │ Pali:                                                      │  │
│ │ ․․․ **Seyyathāpi, bhikkhave, mahāsamuddo** eko raso ․․․   │  │
│ │                                                            │  │
│ │ English:                                                   │  │
│ │ → "Just as the great ocean has one taste, the taste of..." │  │
│ └────────────────────────────────────────────────────────────┘  │
│                                                                  │
│ ┌────────────────────────────────────────────────────────────┐  │
│ │ [phrase 88%]  an8.19 ¶4                                    │  │
│ ├────────────────────────────────────────────────────────────┤  │
│ │ Pali:                                                      │  │
│ │ ․․․ **Seyyathāpi, bhikkhave, mahāsamuddo** anupubba- ․․․  │  │
│ │                                                            │  │
│ │ English:                                                   │  │
│ │ → "Just as the great ocean gradually slopes..."            │  │
│ └────────────────────────────────────────────────────────────┘  │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

**Interaction:**

- `․․․` = **Clickable collapse marker** — click to expand/collapse surrounding context
- `**text**` = Matched portion highlighted (yellow background)
- No separate "Show full" button needed — context toggle is on `․․․` itself

**Expanded state (after clicking `․․․`):**

```
│ Pali:                                                            │
│ Seyyathāpi, bhikkhave, **mahāsamuddo** eko raso loṇaraso;       │
│ evamevaṃ kho, bhikkhave, ayaṃ dhammavinayo ekaraso              │
│ vimuttiraso. ․․․                                                 │
```

### English Display for Partial Matches

**Important clarification:** For **partial matches** (4+ word sequences), we cannot show a corresponding "partial English phrase" because there is no word-level alignment between Pali and English.

**Solution:**

- Always show the **full English paragraph** for the matched source
- The matched Pali phrase is highlighted, giving the translator context
- The translator infers which part of the English corresponds

```
┌────────────────────────────────────────────────────────────────┐
│ [partial · exact]  sn22.59 ¶12                           📋    │
├────────────────────────────────────────────────────────────────┤
│ Pali:                                                          │
│ ․․․ **rūpaṃ bhikkhave anattā** ․․․                            │
│                                                                │
│ English (full paragraph):                                      │
│ → "Form, mendicants, is not-self. For if form were self,      │
│    it wouldn't lead to affliction..."                          │
└────────────────────────────────────────────────────────────────┘
```

**Note:** Partial matches show "exact" instead of a percentage, since n-gram matches are binary (found or not). Paragraph and phrase matches show similarity percentages (e.g., "92%").

The translator sees:

1. The exact Pali phrase that matched (highlighted)
2. The complete English paragraph for context
3. Can expand `․․․` to see the full Pali paragraph too
4. 📋 button copies raw English with gloss syntax

---

## Key Design Decisions

### 1. Pre-compute English (No API Calls)

**Rationale:** The popover must work instantly without network latency. Since we're building an index anyway, including the English translation adds minimal overhead and enables immediate display.

**Trade-off:** Larger index file. Acceptable for dev-only feature.

**Memory estimate:**

- Assuming ~10,000 translated paragraphs
- Average 150 chars Pali + 200 chars English = 350 chars/paragraph = 3.5MB text
- N-gram index overhead: ~4-word sequences × frequency data ≈ 1-2MB
- **Total: ~5-8MB** for a mature corpus

### 2. Sandhi-Aware Matching

**Rationale:** Pali text frequently uses sandhi (word joining). Without expansion, `"dhammañhi"` wouldn't match `"dhammaṁ hi"` even though they're semantically identical.

**Implementation:** The existing `paliSandhi.json` provides a curated mapping. We expand during both indexing and querying.

### 3. Three-Tier Matching

**Rationale:** Different use cases need different granularity:

- **Paragraph**: Nearly identical passages (e.g., repeated suttas)
- **Phrase**: Stock sentences or clauses (e.g., "The Blessed One said...")
- **Partial**: Compound terms or short recurring expressions

**Priority:** Higher tiers suppress lower ones to reduce noise.

### 4. Collection Diversity vs. Quality

**Rationale:** Seeing the same phrase from 3 different collections (MN, SN, AN) is more valuable than 3 matches from the same collection—unless one match is significantly better.

**Implementation:** If top matches are within 3% of each other, prefer diversity. Otherwise, rank purely by quality.

### 5. Inline Context Expansion

**Rationale:** The translator needs to see surrounding context to understand how a phrase was used. But showing everything upfront is overwhelming.

**Implementation:**

- The `․․․` markers themselves are clickable (no separate button)
- This is a **new inline toggle**, not reusing `Collapse.astro` component (simpler)
- Context is already in the data; expansion is pure DOM manipulation
- Keeps popover compact by default
- **Initial state:** Show matched portion ±10 words on each side
- **Expanded state:** Show full paragraph

### 6. Gloss Syntax Handling

**Rationale:** English content may contain `|term::definition [pali]|` gloss patterns. Translators need to both SEE the formatted gloss and COPY the raw syntax.

**Implementation:**

- **Display:** Render glosses as `.tooltip-text` spans (same as elsewhere on site)
- **BottomDrawer integration:** Clicking a gloss in popover opens the existing bottom drawer
- **Copy button:** Explicit 📋 button next to English text copies raw markdown with gloss syntax intact
- **Why button not selection:** Right-click copy doesn't trigger custom handlers; button is reliable

**Phase 1 scope:** Straightforward since we reuse `BottomDrawer.astro` infrastructure. The gloss→tooltip conversion already exists in `replaceTooltips()`.

### 7. Match Highlighting Strategy

**Rationale:** When displaying matched text, we need to show what portion matched.

**Implementation:**

- For **paragraph matches:** Highlight nothing (entire paragraph matched)
- For **phrase matches:** Highlight the matched phrase within the paragraph
- For **partial matches:** Highlight the matched n-gram sequence (the query phrase itself)

The highlighting is applied to the **query phrase in the source**, not attempting reverse alignment. Since we know which words matched, we wrap them in `<mark class="tm-highlight">`.

### 8. Z-Index and Drawer Interaction

**Rationale:** Both TM popover and BottomDrawer compete for attention.

**Implementation:**

- TM popover: `z-index: 50`
- BottomDrawer: `z-index: 40` (already set)
- When BottomDrawer opens (e.g., clicking a gloss in popover), popover stays visible above it
- Pressing Escape closes popover; drawer has its own close behavior

---

## Known Limitations

### Index Staleness

The translation memory index is built at `npm run dev` startup. If the translator adds new translations while the dev server is running, those won't appear in matches until the server restarts.

**Mitigation options (future):**

- File watcher to rebuild index on content changes
- Manual "Refresh TM" button in dev toolbar

**For v1:** Document this limitation. Translator can restart dev server to pick up new translations.

### Sandhi Expansion Ambiguity

Some sandhi forms have multiple valid expansions. `paliSandhi.json` provides one canonical expansion per compound. The source text might use a slightly different form.

**Mitigation:** Accept as known limitation. The mapping covers the most common cases and is "good enough" for practical use.

### Index Schema Versioning

The index has a `version` field but no migration logic. If the schema changes between versions, the old index becomes incompatible.

**For v1:** Simply regenerate the index when schema changes. The `predev` hook ensures this happens automatically. No backward compatibility needed since the index is gitignored and rebuilt on each `npm run dev`.

---

## Success Criteria

1. **Accuracy**: Matches surfaced are genuinely useful (>80% of matches help the translator)
2. **Performance**: No perceptible delay when loading a page with pending translations
3. **Non-disruptive**: Feature enhances workflow without interrupting it
4. **Tunable**: Thresholds can be easily adjusted based on real-world usage

---

## Future Enhancements (Out of Scope for v1)

- [ ] User text selection → "Find similar" button
- [x] Keyboard navigation in popover ✅ (Arrow keys, Enter, Escape)
- [ ] File watcher for automatic index rebuild
- [ ] Analytics on which matches are used
- [ ] VSCode extension integration
- [ ] Bi-directional matching (search English to find Pali)
- [ ] Lazy-load index via Intersection Observer (memory optimization)
