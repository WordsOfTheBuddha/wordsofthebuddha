# Search Test Suite

A CLI tool for testing and validating search ranking quality with automated regression detection and AI-powered evaluation.

## Overview

This framework provides:

1. **Snapshot Testing** - Deterministic regression detection against stored baselines
2. **AI Evaluation** - DeepSeek agent analysis for quality assessment and intuition checks
3. **Visual Reports** - ASCII card-based output for human review

## Usage

```bash
# Run full test suite
npm run test:search

# Test a single query
npm run test:search -- --query "craving"

# Update snapshots (after review)
npm run test:search -- --update

# Run with AI evaluation (requires DEEPSEEK_API_KEY)
npm run test:search -- --ai-eval
```

## Test Modes

### 1. Regression Mode (Default)

Runs all queries against stored snapshots and reports:

- ✅ PASS - Results match expectations
- ⚠️ CHANGED - Ranking changed (needs review)
- ❌ FAIL - Assertion violated

### 2. AI Evaluation Mode (--ai-eval)

After regression tests, sends results to DeepSeek for:

- Quality scoring (1-10)
- Intuition check (does ranking make sense?)
- Bug detection (unexpected rankings)
- Improvement suggestions

---

## Architecture: Browser vs API Search

The search logic exists in **two places** that must be kept in sync:

### 1. API Search (`src/pages/api/search.ts`)

- Server-side endpoint at `/api/search?q=...`
- Used by: Search test CLI, dynamic searches, non-cached pages
- Has full access to Node.js APIs and file system
- Imports utilities from `src/utils/searchRanking.ts`

### 2. Browser Search (`src/components/ExploreWidget.astro`)

- Client-side inline JavaScript (~1900 lines)
- Used by: `/discover` and `/search` pages (prerendered for PWA caching)
- Searches pre-bundled JSON data embedded at build time
- **Duplicates** much of the ranking logic (cannot import from server files)

### Why Two Implementations?

The `/discover` and `/search` pages are **prerendered** for PWA/offline support. This means:

- They cannot call the API at runtime (would break offline mode)
- All search data must be bundled into the HTML
- Search logic runs in the browser against the bundled data

### Keeping Them in Sync

When modifying search ranking, **update both files**:

| Change           | API Location                     | Browser Location                      |
| ---------------- | -------------------------------- | ------------------------------------- |
| Score values     | `search.ts` lines ~430-550       | `ExploreWidget.astro` lines ~930-1000 |
| Phrase proximity | Imported from `searchRanking.ts` | Inline copy around line ~1150-1350    |
| Stopwords        | Imported from `searchRanking.ts` | Inline `STOPWORDS` set                |
| Match type logic | Uses `getMatchType()`            | Inline version                        |
| Multi-term boost | Imported from `searchRanking.ts` | Inline version                        |

**Critical**: After any ranking change, test both:

```bash
# Test API
curl "http://localhost:4321/api/search?q=four%20noble%20truths&limit=10"

# Test browser (manually on /discover or /search page)
```

---

## Shared Utilities (`src/utils/searchRanking.ts`)

Centralized search logic used by the API. Key exports:

### Constants

```typescript
STOPWORDS; // Set of common words to filter from queries
SCORE; // Score values for each match type
PHRASE_PROXIMITY_CONFIG; // Phrase matching configuration
DEFAULT_SEARCH_CONFIG; // Pagination and diversity settings
```

### Query Processing

```typescript
getNonStopwordTerms(query); // Filter stopwords from query
allowPrefixMatch(query); // Returns true if query ≥ 3 chars
allowInfixMatch(query); // Returns true if query ≥ 4 chars
getMaxAllowedEditDistance(query); // 0 for short, 1 for medium, 2 for long
```

### Match Detection

```typescript
getMatchType(item, query, options); // Determine best match type
normalizeForComparison(text); // Lowercase + strip diacritics
minEditDistance(a, b); // Levenshtein distance
textContainsWholeWord(text, word); // Word boundary check
countWholeWordOccurrences(text, word); // Count occurrences
```

### Phrase Proximity

```typescript
calculatePhraseProximityBoost(item, terms); // Multi-term phrase scoring
findPhraseMatchPositions(text, terms); // For highlighting
```

### Text Processing

```typescript
stripAnnotations(text); // Remove |visible::tooltip| syntax → visible
// Critical for matching - glosses contain text that shouldn't affect scoring
```

### Ranking

```typescript
rankResultsWithDiversity(results, config); // Apply diversity + similarity penalties
applyMultiTermBoost(score, matches); // Boost for multiple term matches
```

---

## Search Ranking Rules

### Score Hierarchy

#### Categories (Topics, Qualities, Similes)

| Match Type          | Score | Description                                  |
| ------------------- | ----- | -------------------------------------------- |
| exact-title         | 100   | Query exactly matches title                  |
| exact-slug          | 98    | Query exactly matches slug                   |
| exact-pali          | 96    | Query exactly matches Pali term              |
| exact-synonym       | 94    | Query exactly matches synonym                |
| word-exact-title    | 97    | Query is a word within title                 |
| word-exact-synonym  | 93    | Query is a word within synonym               |
| prefix-title        | 92    | Query is prefix of title                     |
| prefix-slug         | 90    | Query is prefix of slug                      |
| prefix-pali         | 88    | Query is prefix of Pali term                 |
| prefix-synonym      | 86    | Query is prefix of synonym                   |
| cross-field-title   | 77    | Multi-term: all terms found + one in title   |
| term-synonym-exact  | 75    | Multi-term: one term exactly matches synonym |
| cross-field-all     | 70    | Multi-term: all terms found across fields    |
| word-prefix         | 80    | Query is prefix of word in title/synonym     |
| description-word    | 40    | Query found as whole word in description     |
| infix               | 35    | Query found as substring in title/slug       |
| cross-field-partial | 30    | At least one term found                      |
| description-infix   | 28    | Query found as substring in description      |
| fuzzy-1             | 25    | Edit distance 1                              |
| fuzzy-2             | 18    | Edit distance 2                              |

#### Discourses

| Match Type         | Score | Description                                          |
| ------------------ | ----- | ---------------------------------------------------- |
| exact-title        | 95    | Query exactly matches title                          |
| word-exact-title   | 93    | Query is a word within title                         |
| prefix-title       | 90    | Query is prefix of title                             |
| word-prefix        | 85    | Query is prefix of word in title                     |
| term-title-match   | 82    | Multi-term: one term in title + ALL terms in content |
| infix-with-content | 70    | Title contains query + content match                 |
| content-whole-word | 60-80 | Content has query as whole word                      |
| content-substring  | 45-65 | Content has query as substring                       |
| infix-no-content   | 40    | Title contains query, no content match               |
| content-fuzzy      | 15-30 | Fuzzy content match                                  |

### Ranking Rules

1. **Score Primary** - Higher score wins
2. **NonStopword Matches** - More non-stopword term matches wins (tie-breaker)
3. **Priority** - Higher priority wins (tie-breaker)
4. **Diversity** - After 3 same-type results, different types get +10 boost
5. **Strata Boundaries** - [100, 76, 51, 26] define quality tiers

### Query Processing

1. **Stopword Removal** - Common words (the, a, is, in, of, etc.) are filtered
2. **Minimum Lengths**:
    - Prefix matching: query ≥ 3 chars
    - Infix matching: query ≥ 4 chars
    - Fuzzy matching: query ≥ 5 chars (edit dist 1), ≥ 8 chars (edit dist 2)
3. **Diacritic Normalization** - Pali diacritics normalized for comparison

---

## Recent Algorithm Updates

### Phrase Proximity Boosting

Multi-word queries now detect when terms appear near each other:

```typescript
PHRASE_PROXIMITY_CONFIG = {
	MAX_WORD_DISTANCE: 5, // Max words apart to be "near"
	ADJACENT_BOOST: 18, // Terms directly adjacent
	NEAR_BOOST: 12, // Terms within 5 words
	TITLE_MULTIPLIER: 1.5, // Boost for phrase in title
	DESCRIPTION_MULTIPLIER: 1.3, // Boost for phrase in description
	SCATTERED_PENALTY: 15, // Penalty when terms NOT near each other
};
```

**Example**: "four noble truths" query gives higher score to items where these words appear as a phrase, not scattered.

### Synonym Phrase Matching

For multi-term queries, individual synonyms are now checked for phrase proximity:

- Synonym match alone: base score 75
- Synonym with phrase proximity: +boost with DESCRIPTION_MULTIPLIER (1.3x)

**Example**: "four noble truths" → Wisdom topic (has "four noble truths" as synonym) now ranks higher.

### Similar Snippet Repelling

Formulaic content (like jhāna descriptions appearing in many suttas) is detected and spread out:

```typescript
SNIPPET_SIMILARITY_PENALTY = 25; // Score reduction for similar content
SNIPPET_SIMILARITY_THRESHOLD = 0.6; // 60% n-gram overlap triggers penalty
PRIORITY_THRESHOLD = 1; // Only affects low-priority discourses
```

**How it works**:

1. Extract 4-gram signatures from each discourse's content snippet
2. Track signatures of already-shown discourses
3. If a new discourse has >60% overlap with seen signatures, reduce its score
4. Only affects same quality tier (doesn't demote genuinely better results)

**Example**: SN 12.x discourses with nearly identical dependent origination passages get spread out in results instead of appearing consecutively.

### Annotation Stripping

The `stripAnnotations()` function removes gloss/tooltip syntax before matching:

```
|craving::taṇhā| → craving
```

This prevents:

- False matches on tooltip content
- Incorrect snippet selection (picking paragraphs with only tooltip matches)
- Phrase proximity miscalculation due to invisible text

### Snippet Selection Improvements

Best paragraph selection now:

1. Evaluates ALL paragraphs (not just Fuse.js index matches)
2. Strips annotations before counting term matches
3. Applies -10000 penalty to paragraphs with only stopword matches
4. Prioritizes paragraphs with phrase proximity

---

## Snapshot Format

```json
{
	"query": "craving",
	"timestamp": "2025-12-31T00:00:00Z",
	"version": "1.0.0",
	"results": [
		{
			"rank": 1,
			"type": "topic-quality",
			"slug": "craving",
			"title": "Craving",
			"score": 97,
			"matchType": "word-exact",
			"nonStopwordMatches": 1
		}
	],
	"assertions": [
		{ "type": "has", "slug": "craving", "position": 1 },
		{ "type": "has", "slug": "self-making", "maxPosition": 5 },
		{ "type": "not", "slug": "an10.90", "maxPosition": 3 }
	],
	"aiEvaluation": {
		"score": 8,
		"notes": "Good ranking, Craving topic correctly at #1",
		"concerns": [],
		"timestamp": "2025-12-31T00:00:00Z"
	}
}
```

## Representative Test Queries

### Single-Word Queries

- `craving` - Should show Craving topic first
- `suffering` - Should show Suffering topic first
- `mindfulness` - Should show Mindfulness topic first
- `tanha` - Pali search, should match Craving
- `jhana` - Should show Jhāna quality

### Multi-Word Queries

- `craving in` - Should still show Craving (stopword handling)
- `exhaust craving` - Should prioritize items with BOTH terms
- `noble eightfold path` - Should show Noble Eightfold Path topic
- `four noble truths` - Should show Four Noble Truths topic + Wisdom/Ignorance via synonym
- `dependent origination` - Should show Dependent Origination topic

### Edge Cases

- `mn 38` - Discourse ID search
- `sn 12` - Collection prefix
- `akuppa` - Pali with diacritics
- `dukkha vedana` - Mixed Pali terms
- `self` - Short query, limited matching

---

## Development Guidelines

### Adding New Ranking Logic

1. **Implement in `searchRanking.ts`** first (shared utility)
2. **Import into `search.ts`** API endpoint
3. **Copy/adapt for `ExploreWidget.astro`** browser implementation
4. **Test both paths** with curl and manual browser testing
5. **Update snapshots** if ranking changes are intentional

### Testing Changes

```bash
# Start dev server
npm run dev

# In another terminal, run search tests
cd src/search-tests && npm run test:search

# Test specific query
npm run test:search -- --query "four noble truths"

# Manual API test
curl "http://localhost:4321/api/search?q=four%20noble%20truths&limit=20"
```

### Common Pitfalls

1. **Forgetting browser sync** - Changes to API won't affect prerendered pages
2. **Annotation content matching** - Always use `stripAnnotations()` before text matching
3. **Stopword-only queries** - Must handle gracefully (e.g., "the" returns nothing)
4. **Pali diacritics** - Use `normalizeForComparison()` for diacritic-insensitive matching

---

## File Structure

```
src/
├── utils/
│   └── searchRanking.ts     # Shared search utilities (THE source of truth)
├── pages/api/
│   └── search.ts            # API endpoint (imports from searchRanking.ts)
├── components/
│   └── ExploreWidget.astro  # Browser search (inline copy of logic)
├── service/search/
│   └── search.ts            # Discourse search with Fuse.js
└── search-tests/
    ├── README.md            # This file
    ├── package.json
    ├── search-test-cli.js   # Main CLI runner
    ├── test-queries.json    # Test suite definition
    ├── snapshots/           # Stored baseline results
    ├── reports/             # Generated test reports
    └── services/
        └── deepseek.js      # AI evaluation service
```

## Prerequisites

The test CLI requires the dev server to be running:

```bash
# In one terminal
npm run dev

# In another terminal
npm run test:search
```

## Environment Variables

Create a `.env` file in the project root:

```env
DEEPSEEK_API_KEY=your_api_key_here
SEARCH_API_URL=http://localhost:4321  # Optional, defaults to localhost:4321
```

## API Endpoint

The search API is available at `/api/search` and can be used independently:

```bash
# Basic search
curl "http://localhost:4321/api/search?q=craving"

# With options
curl "http://localhost:4321/api/search?q=craving&limit=20&categories=true&discourses=true"
```

Response format:

```json
{
	"success": true,
	"query": "craving",
	"results": [
		{
			"rank": 1,
			"type": "topic-quality",
			"slug": "craving",
			"title": "Craving",
			"score": 97,
			"matchType": "word-exact",
			"nonStopwordMatches": 1
		}
	],
	"counts": { "discourses": 122, "topicsQualities": 2, "similes": 0 },
	"total": 124
}
```
