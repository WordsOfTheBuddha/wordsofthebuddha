# Voice generation (PoC)

Generates **Opus** audio and a **word-level manifest** for English sutta MDX using Google Cloud Text-to-Speech (Chirp 3 HD — Charon) and [stable-ts](https://github.com/jianfch/stable-ts) forced alignment.

Slugs are resolved from [`src/utils/routes.ts`](../src/utils/routes.ts) (generated at build). That is the canonical list of discourses; folder names in `directoryStructure` align with these ids but expansion does not parse the TS structure file.

## Setup

```bash
cd /path/to/suttas-basics
python3 -m venv .venv-voice
source .venv-voice/bin/activate   # Windows: .venv-voice\Scripts\activate
pip install -r scripts/requirements-voice.txt
```

Copy `scripts/voice.env.example` to `.env` in the repo root (or export variables). Required:

- `GOOGLE_APPLICATION_CREDENTIALS` — path to a service account JSON with **Cloud Text-to-Speech API** enabled on the GCP project.

Optional:

- `TTS_VOICE` (default `en-US-Chirp3-HD-Charon`)
- `TTS_LANGUAGE_CODE`
- `WHISPER_MODEL` (default `base`)
- `TTS_PARAGRAPH_BREAK_MS` — silence inserted **between** SSML `<p>` blocks (default **800** ms, i.e. 2× a typical ~400 ms implicit pause). Increase/decrease if you want longer or shorter gaps between verses/paragraphs.

Whisper model weights download on first run (cached under `.cache/` in the repo).

## Usage

**At least one target is required** (no “generate everything” default).

From the repo root you can use npm (arguments after `--` are passed to the script):

```bash
npm run voice:gen -- dhp1-20
npm run voice:gen -- mn10 mn37 dhp
```

Equivalent directly:

```bash
export GOOGLE_APPLICATION_CREDENTIALS=/absolute/path/to/service-account.json
source .venv-voice/bin/activate

# One discourse
python scripts/generate_voice.py dhp1-20

# Several explicit discourses
python scripts/generate_voice.py dhp1-20 dhp21-32

# Whole Dhammapada (all slugs starting with dhp)
python scripts/generate_voice.py dhp

# One Saṁyutta chapter (e.g. SN 36 — all sn36.* slugs)
python scripts/generate_voice.py sn36

# Majjhima range (mn1, mn2, … that exist in routes)
python scripts/generate_voice.py mn1-50

# Mixed: chapter + single discourse
python scripts/generate_voice.py sn36 mn1

# Other collection shortcuts
python scripts/generate_voice.py iti      # all iti*
python scripts/generate_voice.py snp      # all snp*
python scripts/generate_voice.py mn     # all mn*
python scripts/generate_voice.py an     # all an*
python scripts/generate_voice.py ud     # all ud*
```

**Resolution rules (order):**

1. **Exact slug** — if the token equals a route (e.g. `dhp1-20`), that single file is used. This prevents `dhp1-20` from being treated as a numeric range.
2. **Numeric range** — `mn1-50`, `kp1-3`, `iti1-10`: expands to `mn1`, `mn2`, … only where each slug exists in `routes`. (Many AN slugs are `an3.2`-style, so `an1-10` may yield nothing.)
3. **Collection shortcuts** — `dhp`, `iti`, `snp`, `mn`, `an`, `ud`, `sn36` (digits + optional dot-suttas), etc., as documented above.

Outputs per discourse:

- `public/audio/<slug>.opus`
- `public/audio/<slug>.manifest.json`

TTS only (no Whisper alignment):

```bash
python scripts/generate_voice.py dhp1-20 --skip-align
```

## voice:edit copy mode (no TTS)

`voice:edit` can now copy one or more paragraph audio segments from an existing discourse
and splice them into another discourse **without** synthesizing new speech.

Use this for stock/repeated paragraph reuse:

```bash
# Copy target ¶2 from source ¶5, and target ¶3-4 from source ¶8-9
npm run voice:edit -- iti23 --copy-from iti10 --copy-paragraphs 2=5,3-4=8-9
```

Notes:

- Mapping is **1-based** and supports ranges (`N-M`).
- Source discourse must already have timed audio/manifest (`start`/`end` paragraph timings).
- This mode does not require Google TTS credentials.
- Existing `.webm` + `.manifest.json` are backed up (`.bak`) and can be restored with `--rollback`.

## voice:edit exact paragraph retake

By default, `--retake-paragraphs` expands to the covering TTS group(s). To retake only the
exact paragraph(s) you selected, add `--exact`:

```bash
# Retake only paragraph 4 (even if it sits inside a larger TTS group)
npm run voice:edit -- iti23 --retake-paragraphs 4 --exact
```

Notes:

- This is useful for one-line fixes inside larger grouped audio.
- It keeps existing backup/rollback behavior.
- Internally this path aligns per paragraph after splicing, then restores `ttsGroups` metadata.

## MDX parsing

- **Verses** with bare `#### N` headings (e.g. Dhammapada): one “paragraph” per verse block; manifest / alignment **ids** are still `1..n` in reading order (verse numbers stay only in the heading text).
- **Everything else**: split on blank lines into blocks; paragraph ids are `1..n`. Heading lines (`###` …) are stripped from the spoken text. This is a best-effort match to prose layout; refine later if needed.

## FFmpeg

stable-ts loads audio via ffmpeg; ensure `ffmpeg` is installed (`brew install ffmpeg` on macOS).

## Phase 0b (site UI)

On discourse pages with Pāli toolbar, a **Listen** control appears after a quick async check (one manifest `GET` plus a `.webm` existence check). `src/data/audioStatus.ts` is **generated** (gitignored): run `yarn voice:status` (runs automatically in `predev` / `prebuild`).

**Build-time list (CI / Vercel):** set `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, and optionally `R2_BUCKET` (default `dhamma-audio`). The script uses **Node** (`@aws-sdk/client-s3` ListObjectsV2, declared in `dependencies` so production installs include it) against the R2 S3 API—no `.venv-voice` or Python required on the host. If those three vars are missing, it falls back to scanning `public/audio/`, or—only for local machines with `.venv-voice`—`python scripts/generate_audio_status.py --from-r2` when `R2_ACCOUNT_ID` is set but the Node path failed.

The static set speeds up list/explore “has listen” hints; discourse pages still pick up new R2 audio without committing that file. In production, set `PUBLIC_AUDIO_BASE_URL` to the R2 public origin so assets load from `https://…/<discourseId>.webm` (bucket root, no `/audio/` path). Locally, files are served from `/audio/`. Open with **Listen** or `?voice=1`. Playback state is stored under `localStorage` key `voice:<discourseId>`.
