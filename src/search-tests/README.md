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

## Search Ranking Rules

### Score Hierarchy

#### Categories (Topics, Qualities, Similes)

| Match Type          | Score | Description                                |
| ------------------- | ----- | ------------------------------------------ |
| exact-title         | 100   | Query exactly matches title                |
| exact-slug          | 98    | Query exactly matches slug                 |
| exact-pali          | 96    | Query exactly matches Pali term            |
| exact-synonym       | 94    | Query exactly matches synonym              |
| word-exact-title    | 97    | Query is a word within title               |
| word-exact-synonym  | 93    | Query is a word within synonym             |
| prefix-title        | 92    | Query is prefix of title                   |
| prefix-slug         | 90    | Query is prefix of slug                    |
| prefix-pali         | 88    | Query is prefix of Pali term               |
| prefix-synonym      | 86    | Query is prefix of synonym                 |
| word-prefix         | 80    | Query is prefix of word in title/synonym   |
| cross-field-title   | 75    | Multi-term: all terms found + one in title |
| cross-field-all     | 70    | Multi-term: all terms found across fields  |
| description-word    | 40    | Query found as whole word in description   |
| infix               | 35    | Query found as substring in title/slug     |
| cross-field-partial | 30    | At least one term found                    |
| description-infix   | 28    | Query found as substring in description    |
| fuzzy-1             | 25    | Edit distance 1                            |
| fuzzy-2             | 18    | Edit distance 2                            |

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
- `four noble truths` - Should show Four Noble Truths topic
- `dependent origination` - Should show Dependent Origination topic

### Edge Cases

- `mn 38` - Discourse ID search
- `sn 12` - Collection prefix
- `akuppa` - Pali with diacritics
- `dukkha vedana` - Mixed Pali terms
- `self` - Short query, limited matching

## File Structure

```
src/search-tests/
├── README.md
├── package.json
├── search-test-cli.js      # Main CLI runner
├── test-queries.json       # Test suite definition
├── snapshots/              # Stored baseline results
│   ├── craving.json
│   ├── exhaust-craving.json
│   └── ...
├── reports/                # Generated test reports
│   └── report-2025-12-31.md
└── services/
    └── deepseek.js         # AI evaluation service

src/pages/api/
└── search.ts               # Search API endpoint (used by CLI)
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
