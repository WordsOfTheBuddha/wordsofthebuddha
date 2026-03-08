# Search Latency Optimizations

Tracking performance improvements for `/api/search` and browser search (ExploreWidget).

## Latency Instrumentation

The API endpoint now logs per-phase timing via `Server-Timing` header and console.
The search-test-cli also prints timing breakdowns per query.

Example:
```
⏱  parse 1ms → categories 62ms → discourses 3341ms → ranking 32ms → format 0ms → total 3435ms
```

---

## Measured Baselines (March 2026)

### After optimization #1–#4

| Query | parse | categories | discourses | disc:fuse | disc:scoring | ranking | format | TOTAL |
|-------|------:|----------:|-----------:|----------:|-------------:|--------:|-------:|------:|
| `"dhammaja dhammanimmita dhammadayada"` | 0ms | ~18ms | ~72ms | 72ms | 2ms | 0ms | 0ms | **214ms** |
| `"dhammaja"` | 0ms | ~18ms | ~119ms | 119ms | 31ms | 1ms | 0ms | **166ms** |
| `"craving"` | 0ms | ~24ms | ~200ms | 200ms | 166ms | 131ms | 0ms | **511ms** |
| `"a"` | 0ms | ~18ms | ~334ms | 334ms | 333ms | 1348ms | 0ms | **2036ms** |

**Fuse search is now 5–60x faster** after removing content/contentPali from the
Fuse index (8 MB → ~270 KB). Content matching is done via direct text scan.
The remaining bottleneck for broad queries like "a" is the scoring loop (processes
~1000 content-supplement results) and diversity ranking.

<details><summary>After optimization #1–#3 (before metadata-only Fuse)</summary>

| Query | parse | categories | discourses | disc:fuse | disc:scoring | ranking | format | TOTAL |
|-------|------:|----------:|-----------:|----------:|-------------:|--------:|-------:|------:|
| `"dhammaja dhammanimmita dhammadayada"` | 1ms | 187ms | 4528ms | 4508ms | 20ms | 0ms | 0ms | **4716ms** |
| `"dhammaja"` | 1ms | 63ms | 3385ms | 3247ms | 138ms | 22ms | 0ms | **3471ms** |
| `"craving"` | 0ms | 51ms | 3206ms | 2985ms | 222ms | 139ms | 0ms | **3396ms** |
| `"a"` | 0ms | 45ms | 2005ms | 1675ms | 331ms | 1317ms | 0ms | **3367ms** |

</details>

<details><summary>Original baselines (before optimizations)</summary>

| Query | parse | categories | discourses | ranking | format | TOTAL |
|-------|------:|----------:|-----------:|--------:|-------:|------:|
| `"dhammaja dhammanimmita dhammadayada"` | 1ms | 161ms | 4765ms | 0ms | 0ms | **4927ms** |
| `"dhammaja"` | 1ms | 62ms | 3341ms | 32ms | 0ms | **3435ms** |
| `"craving"` | 0ms | 30ms | 3136ms | 2399ms | 0ms | **5565ms** |
| `"a"` | 0ms | 66ms | 2282ms | 15354ms | 0ms | **17703ms** |

</details>

---

## Optimizations — Ordered by Measured Impact

### 1. ⚡ Cap diversity ranking input OR simplify the algorithm (Critical — saves 2–15s)

**Status:** Implemented
**Location:** `src/utils/searchRanking.ts` L1816 — `rankResultsWithDiversity()`

**Problem:** The while-loop is O(n²). For each position in the output, it scans ALL sorted items
to find the best candidate. With n=1000 results (broad query like "a"), that's ~500k iterations.
Each iteration also does snippet similarity: `extractSnippetSignatures()` (regex + split + 4-gram
extraction) and `calculateSnippetOverlap()` against a growing `seenSnippetSignatures` set.

**Fix options (choose one or combine):**

**(a) Cap input to top-N before diversity ranking** — simplest fix:
```ts
const cappedResults = deduplicatedResults.slice(0, 200); // Only diversify top 200
const rankedResults = rankResultsWithDiversity(cappedResults);
```
Users never see more than ~50 results. Diversifying 200 covers any pagination needs and
drops the while-loop from ~1M to ~40K iterations. Remaining results can be appended unsorted.

**(b) Skip snippet similarity for ranks > 50** — the penalty is only meaningful for visible results:
```ts
if (ENABLE_SNIPPET_SIMILARITY && finalOrder.length < 50 && ...) {
```
This keeps the diversity logic but avoids the expensive n-gram work for tail results.

**(c) Pre-sort + early-exit** — since items are already sorted by score, once the score gap
exceeds `diversityTolerance`, no more candidates can be acceptable. Break early.

**Risk:** (a) May truncate long-tail results for extreme queries. (b,c) None for accuracy.

---

### 2. Index searchIndex by slug (High — saves ~5–20ms within discourses phase)

**Status:** Implemented
**Location:** `src/pages/api/search.ts` ~L678

**Problem:** For each discourse result, `searchIndex.find(doc => doc.slug === itemSlug)` does a
linear O(n) scan of the ~1000-item array. With 50-200 discourse results per query, this is
O(n×m) — up to 200K comparisons.

**Fix:** Build a `Map<string, SearchData>` once at module level:
```ts
const indexBySlug = new Map(
  (searchIndex as any[]).map(doc => [doc.slug, doc])
);
```
Then replace `.find()` with `indexBySlug.get(itemSlug)` — O(1) per lookup.

**Risk:** None. Same data, faster access.

---

### 3. Cache category Fuse index (Medium — saves ~30–130ms)

**Status:** Implemented
**Location:** `src/pages/api/search.ts` ~L155

**Problem:** Every request calls `buildUnifiedContent()` to rebuild the full topics/qualities/similes
array, then constructs a new `Fuse` instance over ~200 items.

**Fix:** Cache `allCategories` and `categoryFuse` at module level (same pattern as discourse Fuse):
```ts
let cachedCategories: UnifiedContentItem[] | null = null;
let cachedCategoryFuse: Fuse<UnifiedContentItem> | null = null;

function getCategoryFuse() {
  if (!cachedCategoryFuse) {
    cachedCategories = buildUnifiedContent({ include: ["topics", "qualities", "similes"] });
    cachedCategoryFuse = new Fuse(cachedCategories, { /* ... */ });
  }
  return cachedCategoryFuse;
}
```

**Risk:** None. Data is static JSON loaded at build time.

---

### 4. Metadata-only Fuse + content text scan (Critical — saves 1–4.3s in fuse.search())

**Status:** Implemented
**Location:** `src/service/search/search.ts` — `getSearchIndex()`, `performSearch()`

**Problem:** Fuse.js searched ~8 MB of text (5 MB English + 2.8 MB Pali content across 998 docs)
with every query. The `content` and `contentPali` fields account for 96% of total text. Fuse.js
runs Bitap/extended-search matching on every document's full content with `ignoreLocation: true`,
`ignoreDiacritics: true`, and up to 5 field queries per term.

The `limit` parameter in Fuse.js is just `results.slice(0, limit)` — no early termination.

**Fix:** Two-phase search:
1. **Fuse on metadata only** (slug/title/description — ~270 KB): Remove `content` and `contentPali`
   from Fuse keys. This makes `fuse.search()` ~30x faster.
2. **Direct content scan**: For documents not found by Fuse, check if query terms appear in
   pre-normalized (diacritic-stripped, lowercased) content/contentPali using `String.includes()`.
   Normalized content is cached at module level (`normalizedContentMap`).
3. **Snippet generation**: `findBestMatchingParagraph()` already has its own regex-based paragraph
   scoring independent of Fuse match indices. Pass empty indices for content-supplement results.

**Results:**
- "craving": fuse 2985ms → 200ms (15x)
- "dhammaja": fuse 3247ms → 119ms (27x)
- "dhammaja×3": fuse 4508ms → 72ms (63x)

**Risk:** Fuzzy matching on content is lost (Fuse no longer does fuzzy matching on content fields).
However, the API scoring already does thorough content analysis (term matching, occurrence counting,
phrase proximity) using exact/prefix/infix matching — this covers the same use cases.

---

### 5. Content scoring ranking fixes (addresses regressions from optimization #4)

**Status:** Implemented
**Location:** `src/pages/api/search.ts` ~L866-973, `src/components/ExploreWidget.astro` ~L1324-1420

**Problem:** Optimization #4 (metadata-only Fuse) introduced ranking regressions. Content-supplement
results were appended at the end with high `index` values (500-1000), and the original scoring code
used `index * 0.2` penalties that severely reduced scores (-100 to -500 points). This caused three issues:

1. **"equanimity"**: AN 3.61 (content-whole-word, p=3) ranked #2, beating description-whole-word matches like MN 106
2. **"exhaust craving"**: Content-only matches outranked multi-field matches
3. **"dependent origination"**: MN 26 (passing mention) ranked #1, SN 12.1 (dedicated sutta) at #2

**Root Cause:** The `index` variable (Fuse result position) was used as a quality proxy via penalties
like `BASE - index * 0.2`. This worked when Fuse ranked content matches by relevance, but broke when
content-supplement results were appended without Fuse scoring.

**Fix:** Five-part scoring refinement:

1. **Removed index penalties** from content-whole-word, content-substring, and content-fuzzy branches
2. **Added content cap** (`contentCap = DISCOURSE_DESCRIPTION_WHOLE_WORD - 1 = 83`) to enforce match type hierarchy: description-whole-word (84) > content-whole-word (83 max)
3. **Scaled priority multiplier**: 1.5x for content-only matches (no title/description), 3x for multi-field matches. Prevents content-only from jumping above descriptions via priority alone.
4. **Increased cross-field bonus**: +2 for single-term queries, +4 for multi-term queries. Rewards multi-field relevance signal.
5. **Per-term cross-field detection**: For multi-word queries like "dependent origination", checks if individual non-stopword terms appear in title/description fields using `textContainsWholeWord()`. Handles cases where full phrase doesn't match but individual terms do (e.g., SN 12.1 has "Dependent" in title but not "Origination").

**Results:**
- Issue #1 fixed: "equanimity" descriptions now rank #1-#8, AN 3.61 at #9 (was #2)
- Issue #2 fixed: "exhaust craving" properly ranks multi-field above content-only
- Issue #3 fixed: "dependent origination" SN 12.1 cluster at #1-#7, MN 26 at #4 (was #1)
- All 30 test cases pass with improved subjective ranking quality

**Browser Sync:** Both API (`api/search.ts`) and browser (`ExploreWidget.astro`) scoring updated identically.

---

### 6. Pre-compile highlight regex patterns (Low-Medium — saves ~3–10ms within discourses phase)

**Status:** Not started
**Location:** `src/service/search/search.ts` — `findBestMatchingParagraph()`

**Problem:** For each discourse result with content matches, `findBestMatchingParagraph()` splits
content into paragraphs, then for each paragraph creates `new RegExp(pattern, "giu")` for every
query term. For a 50-paragraph discourse with 3 terms = 150 regex compilations per query.

**Fix:** Compile regex patterns once per query (outside the paragraph loop), reuse across all
paragraphs.

**Risk:** None. Same patterns, compiled once instead of per paragraph.

---

### 7. Short-circuit Levenshtein in category scoring (Low — saves ~1–3ms)

**Status:** Not started
**Location:** `src/pages/api/search.ts` ~L514-524

**Problem:** For categories that don't match any better criteria, `minEditDistance()` is computed
against title, slug, and every synonym — without early exit.

**Fix:** Break out of the synonym loop as soon as `bestEditDist <= 1`.

**Risk:** None.

---

### 8. Pre-normalize Pali terms at load time (Low — saves ~0.5–1ms)

**Status:** Not started
**Location:** `src/utils/searchRanking.ts`

**Problem:** `normalizeForComparison()` is called per Pali term comparison; terms are static data.

**Fix:** Pre-normalize when category data is cached (from optimization #3).

**Risk:** None.

---

## Browser Sync Gap

### Pali multi-term fallback — RESOLVED ✅

The ExploreWidget now uses the same two-pass approach as the API:
1. English-first via `countTermMatchesWithQuality`
2. Pali fallback via `textContainsPaliWholeWord` for unmatched terms (0.8 score per match)
