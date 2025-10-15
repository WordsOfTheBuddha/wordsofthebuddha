# Words of the Buddha – HTTP API

This document describes the public API endpoints for retrieving raw text and performing Pāli dictionary lookups.

-   All endpoints return JSON with `Content-Type: application/json`.
-   CORS: `Access-Control-Allow-Origin: *` is enabled.
-   Unless specified, all parameters are querystring params.

Implementation references:

-   Generic text endpoints: `src/pages/api/text/[lang].ts`, `src/pages/api/text/[lang]/random.ts`, helpers in `src/utils/textApi.ts`
-   Pāli dictionary lookup: `src/pages/api/lookup/pali.ts`

## GET /api/text/:lang

Return raw text for a specific discourse in a given language.

Path params:

-   lang: string
    -   Recognized: `pali`, `pli`, `pi` (Pāli), `english`, `en` (English)

Query params:

-   slug: string (preferred) OR id: string (one is required)
-   format: `md` | `text` | `segments` (optional; default `md`)
    -   `md`: raw Markdown body
    -   `text`: Markdown stripped to plain text (lightweight rules)
    -   `segments`: array of strings split on blank lines (helpful for per-paragraph UX)
-   includeMeta: boolean (optional; default `true`)
    -   When `true`, includes `slug`, `id`, and `title` if available

Response 200 (examples):

-   format=md or text

```
{
  "lang": "pli",
  "format": "text",
  "id": "sn46.53",
  "title": "Aggi sutta - Fire",
  "description": "Optional discourse description",
  "body": "Atha kho sambahulā bhikkhū ..."
}
```

-   format=segments

```
{
  "lang": "en",
  "format": "segments",
  "id": "mn128",
  "title": "Upakkilesa sutta - Impurity",
  "description": "Optional discourse description",
  "segments": [
    "Thus have I heard—At one time ...",
    "Now at that time ...",
    "Then the Blessed One ..."
  ]
}
```

Errors:

-   400: missing `slug`/`id` or invalid `format`
-   404: entry not found
-   500: unexpected error

Caching:

-   `Cache-Control: public, max-age=300, s-maxage=300`

Examples:

-   `/api/text/pli?slug=sn46.53`
-   `/api/text/en?id=mn128&format=text`
-   `/api/text/pli?slug=an8.29&format=segments&includeMeta=false`

Notes:

-   The backend searches language-appropriate content collections (e.g., `pliAll` for Pāli and `en`/`all` for English); unknown collections are skipped safely.
-   Exact slug lookup is attempted first; then a fallback scan matches against multiple candidate fields (`slug`, `data.slug`, `id`, `data.id`, `uid`, etc.).

## GET /api/text/:lang/random

Return raw text for a random discourse in the given language.

Path params:

-   lang: string (see above)

Query params:

-   format: `md` | `text` | `segments` (optional; default `md`)
-   includeMeta: boolean (optional; default `true`)
-   maxParagraphs: positive integer (optional)
-   When provided, the random discourse is selected from entries whose paragraph count is less than or equal to this number. Paragraph count is computed with the same blank-line segmentation used by `format=segments` on the plain-text rendering.

Response 200: same schema as `/api/text/:lang`.

Errors:

-   404: no entries available
-   404: no entries available within paragraph limit (when `maxParagraphs` filters out all entries)
-   400/500 as above

Caching:

-   `Cache-Control: no-store`

Examples:

-   `/api/text/pli/random`
-   `/api/text/en/random?format=text`
-   `/api/text/en/random?maxParagraphs=10&format=segments`

## GET /api/lookup/pali

Pāli word lookup: supports single-word and batch modes.

Query params:

-   word: string (single-word mode; ignored if `q` is present)
-   q: string (batch mode; comma-separated list of words)

Behavior:

## GET /api/text

Return both Pāli and English for a given discourse in a unified payload.

Query params:

-   slug: string (preferred) OR id: string (one is required)
-   format: `md` | `text` | `segments` (optional; applies to both; default `md`)
-   includeMeta: boolean (optional; default `true`)

Response 200 (when available):

```
{
  "format": "segments",
  "id": "sn56.11",     // present when includeMeta=true and known
  "title": "Dhammacakkappavattana Sutta",
  "description": "Optional discourse description",
  "body": {
    "pli": ["...", "..."],  // string when format != segments
    "en": ["...", "..."]     // string when format != segments
  },
  "missing": ["en"] // only present when exactly one language is missing
}
```

Errors:

-   400: missing `slug`/`id` or invalid `format`
-   404: discourse not found (neither language available)
-   500: unexpected error

Caching:

-   `Cache-Control: public, max-age=300, s-maxage=300`
-   If `word` is provided and `q` is not set, returns a single lookup result.
    -   404 when the word is not found.
-   Otherwise, performs a batch lookup using either `q` or `word` (if comma-separated), and returns aggregated results.
    -   400 when no valid words are provided.

Responses:

-   200: JSON result(s) from the Pāli dictionary backend
-   400: `{ "error": "No valid words provided" }`
-   404: `{ "error": "Word not found", "word": "<word>" }`
-   500: `{ "error": "Dictionary lookup error", ... }`

Headers:

-   `Access-Control-Allow-Origin: *`

Examples:

-   Single: `/api/lookup/pali?word=anicca`
-   Batch: `/api/lookup/pali?q=anicca,dukkha,anatta`

Notes:

-   This endpoint proxies to internal utilities for the dictionary (`src/utils/paliLookup.ts`). Response shape depends on the dictionary source and may evolve; clients should be resilient to additional fields.

## GET /api/discover

Explore curated content by topics, qualities, and similes, with optional filtering.

Query params:

-   by: comma-separated list of kinds to include. Valid values: `topics`, `qualities`, `similes`. Defaults to `topics,qualities,similes`.
-   filter: string (optional). Case-insensitive match against item titles, descriptions, synonyms, Pāli, redirects, related, and per-item discourse fields (id, collection, title, description). Hyphens are treated like spaces during matching.

Response 200:

```
{
  "success": true,
  "data": [
    {
      "id": "four-noble-truths",
      "slug": "four-noble-truths",
      "type": "topic",            // or "quality" | "simile"
      "title": "Four Noble Truths",
      "description": "...",       // optional
      "synonyms": ["..."],        // optional (topics/qualities)
      "pali": ["..."],            // optional (topics/qualities)
      "redirects": ["..."],       // optional (topics)
      "qualityType": "positive",  // only for qualities
      "supportedBy": ["..."],     // only for qualities
      "leadsTo": ["..."],         // only for qualities
      "related": ["..."],         // optional
      "opposite": ["..."],        // optional
      "discourses": [
        {
          "id": "sn56.11",
          "title": "Turning the Wheel of Dhamma",
          "description": "...",
          "collection": "sn",
          "note": "...",            // optional
          "priority": 10,            // optional; higher first
          "isFeatured": true          // optional
        }
      ]
    }
  ],
  "count": 123
}
```

Errors:

-   500: `{ "success": false, "error": "Internal server error" }`

Notes:

-   Data is built from JSON mappings in `src/data`: `topicMappings.json`, `qualityMappings.json`, `simileMappings.json`, and `qualities.json`.
-   Ordering: featured items first within each item’s discourses, then by numeric priority (higher first), then stable collection ordering, then alphanumeric id. Items themselves are sorted alphabetically by title.

---

## Conventions

-   All endpoints return JSON with UTF-8 encoding.
-   Boolean query parameters accept common truthy values: `true`, `1`, `yes` (case-insensitive). Any other value is treated as `false`.
-   For `segments`, splitting is done by blank lines; no semantic segmentation is implied.
-   Markdown stripping is conservative and intended for readability. If you need a stricter/plain-text transformation, open an issue.

## Versioning and changes

-   These endpoints are considered v1 and may be extended in a backward-compatible manner (additional fields, headers, etc.).
-   Breaking changes will be documented here.
