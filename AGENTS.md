# Agent instructions

## Dev server ownership (port 4321) — DO NOT TOUCH

- The Astro dev server on port `4321` is **user-owned** and managed by `pm2`
  (`ecosystem.config.cjs`, process name `astro-dev`, auto-restart on).
  That process runs `yarn dev`: `predev` (indexes, routes, catalogs) plus the
  content watcher, image watcher, and `astro dev --port 4321 --strictPort`.
- **Never** run `yarn dev`, `astro dev`, `astro dev --force`, `astro dev stop`,
  `lsof -ti:4321 | xargs kill`, `fuser -k`, or `pm2` commands against it.
- **Never** start your own server on port `4321`. If you need a dev server for
  testing, use a different port, e.g. `astro dev --port 4322 --strictPort`.
- If port `4321` is not responding, **do not kill/restart anything** — just tell
  the user. They manage it via `pm2 logs astro-dev` / `pm2 restart astro-dev`.
- `astro dev --force` clears the content cache and kills the running server —
  never use it on this repo's default port.
