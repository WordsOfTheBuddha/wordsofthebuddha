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

## MDX parsing

- **Verses** with bare `#### N` headings (e.g. Dhammapada): one “paragraph” per verse block; manifest / alignment **ids** are still `1..n` in reading order (verse numbers stay only in the heading text).
- **Everything else**: split on blank lines into blocks; paragraph ids are `1..n`. Heading lines (`###` …) are stripped from the spoken text. This is a best-effort match to prose layout; refine later if needed.

## FFmpeg

stable-ts loads audio via ffmpeg; ensure `ffmpeg` is installed (`brew install ffmpeg` on macOS).

## Phase 0b (site UI)

On discourse pages with Pāli toolbar, a **Listen** control appears for discourses listed in `src/data/audioStatus.ts` (regenerate with `python scripts/generate_audio_status.py`). In production, set `PUBLIC_AUDIO_BASE_URL` to the R2 public origin so assets load from `https://…/<discourseId>.opus` (bucket root, no `/audio/` path). Locally, files are served from `/audio/`. Open with **Listen** or `?voice=1`. Playback state is stored under `localStorage` key `voice:<discourseId>`.
