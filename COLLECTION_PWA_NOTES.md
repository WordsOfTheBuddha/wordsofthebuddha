# Offline PWA notes (implementation)

This app uses one vanilla Service Worker (`public/sw.js`) with a TypeScript mirror kept in parity (`src/sw.ts`) and an Offline Control Center (`/offline`) to drive user‑selected caching. Dev and prod share behavior; `/sw.js` is registered once from `Layout.astro`.

Updated: 2025‑09‑17

---

## Service Worker behavior

-   Caches

    -   core-v3: minimal, durable core: `/`, `/offline`, `/offline-manifest.json`, `/search`, `/manifest.webmanifest`, and `manifest.coreAssets`.
    -   navigations-v1: prerendered HTML navigations (including discourse pages and, when explicitly selected, `/search`).
    -   assets-v1: `/_astro/*`, `/assets/*`, favicons/manifest.
    -   fonts-local-v1 and fonts-web-v1: local font files and Google Fonts (created on demand when fonts are first requested; you may not see these caches until a page loads fonts).

-   Strategies

    -   Navigations: network‑first with offline fallback to `/offline`.
    -   Assets (/\_astro, /assets, icons, fonts): cache‑first.
    -   offline-manifest: cache‑first with `{}` JSON fallback when offline; refreshed into core when possible.

-   Robust navigation classification

    -   isHtmlLikePath uses a known set of file extensions to treat unknown or extensionless paths as HTML, so slugs like `/sn12.2` are cached in `navigations-v1` (fixes prior misclassification).

-   Linked asset prefetch for HTML

    -   Whenever HTML is fetched (navigations or bulk), the SW parses it and prefetches same‑origin linked assets into `assets-v1` (`/_astro/*`, `/assets/*`, favicons/manifest). This ensures pages render styled and interactive offline without prior online visits.

-   Special handling for `/search`

    -   Network‑first fetch caches the base shell `/search` (no query) and prefetches its linked assets.
    -   In bulk jobs, HTML‑like pages are stored in `navigations-v1` (dedup); we skip storing `/offline` but allow `/search` so it appears under Navigations when the user selects Search in the Control Center.

-   Bulk caching Message API (postMessage)

    -   Messages: `CACHE_URLS`, `PAUSE_JOB`, `RESUME_JOB`, `CANCEL_JOB`, `CLEAR_ALL`, plus a lightweight `PING`/`PONG` handshake.
    -   Events broadcast: `STARTED`, `PROGRESS`, `PAUSED`, `RESUMED`, `DONE`, `ERROR`, `CANCELLED`, `CLEARED` (each with a `progressKey`).
    -   Dedup policy (Option A): HTML goes to `navigations-v1`; static assets go to `assets-v1`. Bulk jobs route any non‑HTML directly to `assets-v1` (we no longer use a `bulk-download` cache).

-   CLEAR_ALL

    -   Deletes all non‑core caches; keeps `core-v3`.
    -   Tries to refresh core entries from network: `/offline`, `/offline-manifest.json`, `/search`.
    -   Broadcasts `CLEARED` to clients.

-   Dev‑mode offline stubs
    -   When offline on localhost, the SW stubs Vite/Astro dev resources (e.g., `/@vite/client`, Astro CSS/TS transforms) so pages don’t error.

---

## Offline Control Center (`/offline`)

-   Features

    -   Toggles for: Collections (primary eight with correct key mapping), Discovery pages (`/discover` + `/on/:slug`), and Search.
    -   Accurate status labels per group: “Not in Cache”, “Partial (x/y)”, “Installed”.
    -   Rescan after downloads complete; exposes `window.__offlineMissing` with the last missing URLs per collection to aid diagnosis.
    -   Online gating; compatibility guard when Cache API or SW are unavailable.
    -   Pause/Resume for the unified download job; progress bar with counts.
    -   GET‑based size estimates using decoded bytes (avoids HEAD gzip mismatch on Vercel).

-   Deterministic prewarm

    -   Before queueing a job (when any toggle is on), dynamically imports shared client modules so their chunks are cached deterministically: `selectionHandler`, `highlightService`, `tooltipFormatter`, `transformId`, `dom`, `theme`, and Pāli dictionary warmup via `warmupPaliDictionary`.
    -   When Search is selected, it imports the search module to pull in the static index chunk and also adds `/search` (and `/offline`) to the job list so HTML asset prefetch captures the page’s scripts/styles.

-   iOS/PWA resilience

    -   Waits for SW control (`controllerchange`) and handshakes (`PING`/`PONG`) before queuing downloads to avoid races.

-   Clear/Nuke UX
    -   Clear Cache sends `CLEAR_ALL`; upon `CLEARED`, shows a 3‑second banner: “Reloading the page in 3…2…1” and auto‑reloads to re‑install the core.
    -   Debug “Nuke all (debug)” unregisters SW, deletes all caches and storage, then shows the same countdown and reloads.

Notes

-   Discourse pages already include both English and Pāli server‑side; toggles are purely client‑side. We do not fetch a separate `?pli=true` variant in the SW; prefetching the HTML’s linked assets is sufficient for offline toggling.

---

## Search (Phase A — implemented)

-   Source of truth: static `src/data/searchIndex.ts` built at compile time.
-   Browser module: `src/service/search/search.ts` imports the index and builds Fuse; API unchanged (`performSearch`).
-   The Search page has a client fallback for offline where SSR is absent; the SW ensures `/search` HTML and its assets are available when explicitly selected.

Quality gates

-   Visit `/search?q=term` online; results render. Go offline and reload; results render via client fallback and cached index.

---

## Discourses offline (Phase B — implemented)

-   Use Control Center to select collections; the SW caches each discourse HTML into `navigations-v1` and prefetches linked assets into `assets-v1`.
-   Robust classification treats dot‑slugs as HTML, fixing prior misses (e.g., `/sn12.2`).
-   Pāli toggle and other client features work offline thanks to deterministic prewarm and asset prefetch.

Quality gates

-   Cache a single discourse; offline reload shows styling, components, and Pāli toggle working.
-   Navigate among several cached discourses while offline; all resolve from caches without network.
-   Storage sanity: hashed assets dedupe across pages.

---

## Test quickstart

-   Online: Visit a few discourse pages (e.g., `/an1.41-50`) and `/search?q=consciousness`.
-   Control Center: choose Collections/Discovery/Search and click Download; watch progress.
-   Clear All: click “Clear Cache”; observe the 3‑second reload countdown, then verify the core is re‑installed after reload.
-   Offline: Toggle DevTools “Offline”; reload cached discourse pages and `/search?q=…`; confirm UI and search function without network.
