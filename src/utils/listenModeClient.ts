/**
 * Listen-mode client.
 *
 * Owns a single `<audio>` element through the entire listen-mode session.
 * Track transitions are in-place: load next manifest, swap `audio.src`,
 * update DOM + `mediaSession.metadata`, then `history.replaceState` to the
 * new `/listen/{slug}` URL — no full page navigation.
 *
 * Phase 0/2 prototype scope:
 *   - paragraph-level highlight (no per-word highlight yet)
 *   - autoplay default OFF, persisted in localStorage
 *   - YT-style prev/next semantics (paragraph first, then discourse)
 *   - MediaSession track metadata refresh on every transition
 */

import {
	loadVoiceManifestForDiscourse,
	type VoiceManifest,
} from "./voiceManifest";
import {
	formatDisplayId,
	queueWindow,
	getPlaylist,
	isAudioSlug,
} from "./listenMode";
import { audioTitles } from "../data/audioTitles.generated";
import { audioDurations } from "../data/audioDurations.generated";
import type { Playlist } from "../data/playlists.generated";

export type ListenInitialData = {
	slug: string;
	displayId: string;
	title: string;
	description: string | null;
	nextSlug: string | null;
	nextTitle: string | null;
	nextDescription: string | null;
	nextDisplayId: string | null;
	prevSlug: string | null;
	prevTitle: string | null;
	prevDescription: string | null;
	prevDisplayId: string | null;
};

const LS_AUTOPLAY = "listen:autoplay";
const LS_RESUME = "listen:resume";
const LS_SPEED = "listen:speed";
const LS_TRANSITION_HOLD_MS = "listen:transitionHoldMs";
const LS_SCRUBBER_COLLAPSED = "listen:scrubberCollapsed";
const LS_SCROLL_UNLOCKED = "listen:scrollUnlocked";
const RESUME_TTL_MS = 24 * 60 * 60 * 1000;
const PREV_RESTART_THRESHOLD_S = 3;
const DEFAULT_TRANSITION_PULSE_MS = 1800;
const DEFAULT_AUTOPLAY_TRANSITION_HOLD_MS = 10000;
const MIN_STRUCTURED_WAVEFORM_PX_PER_PARAGRAPH = 12;
const PARAGRAPH_SNAP_THRESHOLD_SEC = 5;
const HEADING_SNAP_THRESHOLD_RATIO = 0.01;
const MIN_HEADING_SNAP_THRESHOLD_SEC = 8;
const MAX_HEADING_SNAP_THRESHOLD_SEC = 25;

/** Discrete playback rates; mirrors voice-mode's `VOICE_PLAYBACK_RATES`. */
const SPEED_RATES = [0.75, 1, 1.25, 1.5] as const;
const DEFAULT_SPEED = 1;

function loadSpeed(): number {
	try {
		const raw = localStorage.getItem(LS_SPEED);
		const n = raw ? Number(raw) : NaN;
		const found = SPEED_RATES.find((r) => Math.abs(r - n) < 0.01);
		return found ?? DEFAULT_SPEED;
	} catch {
		return DEFAULT_SPEED;
	}
}

function saveSpeed(rate: number): void {
	try {
		localStorage.setItem(LS_SPEED, String(rate));
	} catch {}
}

function loadScrubberCollapsed(): boolean {
	try {
		return localStorage.getItem(LS_SCRUBBER_COLLAPSED) === "1";
	} catch {
		return false;
	}
}

function saveScrubberCollapsed(collapsed: boolean): void {
	try {
		localStorage.setItem(LS_SCRUBBER_COLLAPSED, collapsed ? "1" : "0");
	} catch {}
}

function loadScrollUnlocked(): boolean {
	try {
		return localStorage.getItem(LS_SCROLL_UNLOCKED) === "1";
	} catch {
		return false;
	}
}

function saveScrollUnlocked(unlocked: boolean): void {
	try {
		localStorage.setItem(LS_SCROLL_UNLOCKED, unlocked ? "1" : "0");
	} catch {}
}

function formatSpeedLabel(rate: number): string {
	// "1×", "1.25×", "0.75×" — strip trailing zeros only when already showing decimals.
	const s = rate.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
	return `${s}×`;
}

function titleFor(slug: string, fallback: string): string {
	return audioTitles[slug] ?? runtimeTitles.get(slug) ?? fallback;
}

function durationFor(slug: string): number | undefined {
	const fromBuild = audioDurations[slug];
	if (typeof fromBuild === "number") return fromBuild;
	return runtimeDurations.get(slug);
}

/**
 * Titles discovered at runtime via the voice manifest (Phase 1 schema field
 * `manifest.title`). Bridges the gap for slugs that gained audio after the
 * last `audioTitles.generated.ts` rebuild — the queue would otherwise show
 * the bare slug. Populated by `loadTrack()` when the active track resolves
 * and by `hydrateQueueTitles()` for visible drawer items.
 */
const runtimeTitles = new Map<string, string>();

/** Runtime duration fallback for slugs added after the last durations build. */
const runtimeDurations = new Map<string, number>();

/** Single-flight cache for runtime manifest metadata hydration. */
const runtimeMetaHydration = new Map<string, Promise<void>>();

type TrackMeta = {
	slug: string;
	title: string;
	displayId: string;
	description: string | null;
};

type ParagraphPlaybackMode = "continuous" | "single";

type Resume = { slug: string; time: number; savedAt: number };

function audioBaseUrl(): string {
	const root = (import.meta.env.PUBLIC_AUDIO_BASE_URL as string | undefined)
		?.replace(/\/$/, "");
	return root || "/audio";
}

function webmUrlFor(slug: string, m: VoiceManifest | null): string {
	const base = `${audioBaseUrl()}/${encodeURIComponent(slug)}`;
	const h = m?.audioHash || m?.textHash || m?.generatedAt || `v${m?.version ?? 1}`;
	return `${base}.webm?h=${encodeURIComponent(h)}`;
}

function renderWordSpans(
	parent: HTMLElement,
	words: { w: string }[],
	lineSizes?: number[],
): void {
	const hasLetter = (s: string): boolean => /\p{L}/u.test(s);
	const endsSentence = (s: string): boolean => /[.!?]["'”’)\]]*$/.test(s.trim());
	const capitalizeFirstLetter = (s: string): string => {
		for (let i = 0; i < s.length; i++) {
			const ch = s[i];
			const upper = ch.toLocaleUpperCase();
			const lower = ch.toLocaleLowerCase();
			// Letter check: letters have different upper/lower forms.
			if (upper !== lower) {
				if (ch === lower && ch !== upper) {
					return s.slice(0, i) + upper + s.slice(i + 1);
				}
				return s;
			}
		}
		return s;
	};

	// Words from the manifest carry punctuation in-token (e.g. "Bhikkhus,").
	// A lone single-character punct token (comma, sentence end, etc.) doesn't get a
	// leading space — it's glued to the prior word visually. Multi-char punct-only
	// tokens (e.g. "...") keep normal word spacing before them.
	const isPunctOnly = (s: string): boolean => /^[,.;:!?]$/.test(s);
	// Opening punctuation should not be followed by an injected space.
	// Example: token stream ["“", "dwell"] should render as `“Dwell`, not `“ Dwell`.
	const isOpeningPunctOnly = (s: string): boolean => /^[([{“‘]+$/.test(s.trim());
	// Only honour `lineSizes` when the count matches (paragraph endpoint may
	// drift from manifest tokenization on edge cases — fall back to flat).
	const useLines =
		!!lineSizes &&
		lineSizes.length > 1 &&
		lineSizes.reduce((a, b) => a + b, 0) === words.length;
	let nextBreakAt = useLines ? lineSizes![0] : -1;
	let lineCursor = 0;
	let shouldCapitalizeNext = true; // capitalize first word of each paragraph
	for (let i = 0; i < words.length; i++) {
		const w = words[i];
		let displayWord = w.w;
		if (shouldCapitalizeNext) {
			// Some manifests can retain leading whitespace when prior tokens are
			// removed during TTS edits; strip it from sentence/paragraph starts.
			displayWord = displayWord.trimStart();
			displayWord = capitalizeFirstLetter(displayWord);
		}

		if (i === nextBreakAt) {
			parent.appendChild(document.createElement("br"));
			lineCursor++;
			nextBreakAt += lineSizes![lineCursor];
		} else if (
			i > 0 &&
			!isPunctOnly(displayWord) &&
			!isOpeningPunctOnly(words[i - 1]?.w ?? "")
		) {
			parent.appendChild(document.createTextNode(" "));
		}
		const span = document.createElement("span");
		span.className = "listen-word";
		span.dataset.w = String(i);
		span.textContent = displayWord;
		parent.appendChild(span);

		if (endsSentence(displayWord)) {
			shouldCapitalizeNext = true;
		} else if (hasLetter(displayWord)) {
			shouldCapitalizeNext = false;
		}
	}
}

function formatTime(sec: number): string {
	if (!Number.isFinite(sec) || sec < 0) return "0:00";
	const m = Math.floor(sec / 60);
	const s = Math.floor(sec % 60);
	return `${m}:${s.toString().padStart(2, "0")}`;
}

/** Compact duration for queue items: "2m", "12m", "1h 4m". */
function formatDurationShort(sec: number): string {
	if (!Number.isFinite(sec) || sec <= 0) return "";
	const totalMin = Math.max(1, Math.round(sec / 60));
	if (totalMin < 60) return `${totalMin}m`;
	const h = Math.floor(totalMin / 60);
	const m = totalMin % 60;
	return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

function loadAutoplay(): boolean {
	try {
		return localStorage.getItem(LS_AUTOPLAY) === "1";
	} catch {
		return false;
	}
}

function saveAutoplay(on: boolean): void {
	try {
		localStorage.setItem(LS_AUTOPLAY, on ? "1" : "0");
	} catch {}
}

function loadTransitionHoldMs(): number {
	try {
		const raw = localStorage.getItem(LS_TRANSITION_HOLD_MS);
		const ms = raw ? Number(raw) : NaN;
		if (Number.isFinite(ms) && ms >= 0) return Math.round(ms);
	} catch {}
	return DEFAULT_AUTOPLAY_TRANSITION_HOLD_MS;
}

function loadResume(slug: string): number | null {
	try {
		const raw = localStorage.getItem(LS_RESUME);
		if (!raw) return null;
		const r = JSON.parse(raw) as Resume;
		if (r.slug !== slug) return null;
		if (Date.now() - r.savedAt > RESUME_TTL_MS) return null;
		return r.time;
	} catch {
		return null;
	}
}

function saveResume(slug: string, time: number): void {
	try {
		const r: Resume = { slug, time, savedAt: Date.now() };
		localStorage.setItem(LS_RESUME, JSON.stringify(r));
	} catch {}
}

/**
 * In-session per-slug playback positions. Populated whenever we leave a
 * track (via advanceTo, popstate, or beforeunload) so that returning to
 * the same slug — most importantly via browser back — resumes from where
 * the listener was, not from 0. Lives only for the current page session;
 * boot still uses LS_RESUME for cold-start resume.
 */
const sessionPositions = new Map<string, number>();

/** Distance from end below which a position is treated as "finished" and discarded. */
const NEAR_END_EPSILON_S = 1.0;

/**
 * Record a per-slug position for the current session. Drops the position if
 * we're within ~1s of the end (treat as finished — start fresh next time).
 */
function rememberPosition(slug: string, time: number, duration: number | null): void {
	if (!Number.isFinite(time) || time <= 0) {
		sessionPositions.delete(slug);
		return;
	}
	if (duration && Number.isFinite(duration) && time >= duration - NEAR_END_EPSILON_S) {
		sessionPositions.delete(slug);
		return;
	}
	sessionPositions.set(slug, time);
}

export function initListenMode(initial: ListenInitialData): void {
	const audioEl = document.getElementById("listen-audio") as HTMLAudioElement | null;
	const playBtn = document.getElementById("listen-play");
	const playIcon = document.getElementById("listen-play-icon");
	const prevBtn = document.getElementById("listen-prev");
	const nextBtn = document.getElementById("listen-next");
	const seek = document.getElementById("listen-seek") as HTMLInputElement | null;
	const waveCanvas = document.getElementById("listen-waveform") as HTMLCanvasElement | null;
	const waveCtx = waveCanvas?.getContext("2d") ?? null;
	const rootEl = document.getElementById("listen-root") as HTMLElement | null;
	const transportEl = document.querySelector<HTMLElement>(".listen-transport");
	const scrubberToggle = document.getElementById("listen-scrubber-toggle") as HTMLButtonElement | null;
	const autoplayToggle = document.getElementById(
		"listen-autoplay-toggle",
	) as HTMLButtonElement | null;
	const scrollLockToggle = document.getElementById("listen-scroll-lock-toggle") as HTMLButtonElement | null;
	const scrollLockIcon = document.getElementById("listen-scroll-lock-icon") as SVGElement | null;
	const tCur = document.getElementById("listen-time-current");
	const tTot = document.getElementById("listen-time-total");
	const titleEl = document.getElementById("listen-title");
	const displayIdEl = document.getElementById("listen-display-id");
	const stage = document.querySelector<HTMLElement>(".listen-stage");
	const queueLabel = document.getElementById("listen-queue-label");
	const queueChip = document.getElementById("listen-queue-chip");
	const modeSwitch = document.getElementById(
		"listen-mode-switch",
	) as HTMLAnchorElement | null;
	const speedCycleBtn = document.getElementById(
		"listen-speed-cycle",
	) as HTMLButtonElement | null;
	const speedLabel = document.getElementById("listen-speed-label");
	const queueDrawer = document.getElementById(
		"listen-queue-drawer",
	) as HTMLElement | null;
	const queueScrim = document.getElementById(
		"listen-queue-scrim",
	) as HTMLElement | null;
	const queueList = document.getElementById(
		"listen-queue-list",
	) as HTMLOListElement | null;
	const queueCloseBtn = document.getElementById(
		"listen-queue-close",
	) as HTMLButtonElement | null;
	const queueResetBtn = document.getElementById(
		"listen-queue-reset",
	) as HTMLButtonElement | null;

	if (!audioEl || !playBtn || !prevBtn || !nextBtn || !seek || !tCur || !tTot) {
		console.error("listen-mode: required DOM nodes missing");
		return;
	}
	// Re-bind to a non-nullable local so closures defined below preserve
	// narrowing without per-use non-null assertions.
	const audio: HTMLAudioElement = audioEl;
	const playButton: HTMLElement = playBtn;

	let current: TrackMeta = {
		slug: initial.slug,
		title: initial.title,
		displayId: initial.displayId,
		description: initial.description,
	};
	let manifest: VoiceManifest | null = null;
	let activeParaIdx = -1;
	let activeWordIdx = -1;
	let activeLineParaIdx = -1;
	let activeLineTop = Number.NaN;
	let pauseAfterParagraphIdx = -1;
	let paragraphPlaybackMode: ParagraphPlaybackMode = "continuous";
	let autoplay = loadAutoplay();
	const autoplayTransitionHoldMs = loadTransitionHoldMs();
	let speed = loadSpeed();
	let scrubberCollapsed = loadScrubberCollapsed();
	let scrollUnlocked = loadScrollUnlocked();
	const knownDescriptions = new Map<string, string>();

	function applyAutoplayUi(): void {
		if (!autoplayToggle) return;
		autoplayToggle.setAttribute("aria-pressed", autoplay ? "true" : "false");
		const onLabel = "Autoplay next discourse is on. Activate to turn off.";
		const offLabel = "Autoplay next discourse is off. Activate to turn on.";
		autoplayToggle.setAttribute("aria-label", autoplay ? onLabel : offLabel);
		autoplayToggle.title = autoplay ? onLabel : offLabel;
	}

	function applyScrubberCollapsed(): void {
		transportEl?.classList.toggle("is-scrubber-collapsed", scrubberCollapsed);
		const label = scrubberCollapsed ? "Expand seek view" : "Collapse seek view";
		scrubberToggle?.setAttribute("aria-label", label);
		scrubberToggle?.setAttribute("title", label);
		scrubberToggle?.setAttribute("aria-expanded", scrubberCollapsed ? "false" : "true");
		if (!scrubberCollapsed) drawWaveformCanvas();
	}

	function applyScrollUnlock(): void {
		rootEl?.classList.toggle("is-scroll-unlocked", scrollUnlocked);
		const label = scrollUnlocked ? "Lock guided listen mode" : "Unlock free scroll mode";
		scrollLockToggle?.setAttribute("aria-label", label);
		scrollLockToggle?.setAttribute("title", label);
		if (scrollLockIcon) {
			scrollLockIcon.innerHTML = scrollUnlocked
				? '<path stroke-linecap="round" stroke-linejoin="round" d="M13.5 10.5V6.75a4.5 4.5 0 1 1 9 0v3.75M3.75 21.75h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H3.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z"/>'
				: '<path stroke-linecap="round" stroke-linejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z"/>';
		}
		if (!scrollUnlocked && activeParaIdx >= 0) {
			highlightParagraph(activeParaIdx);
			if (activeWordIdx >= 0) {
				window.requestAnimationFrame(() => highlightWord(activeParaIdx, activeWordIdx));
			}
		}
	}

	function rememberDescription(slug: string | null, description: string | null | undefined): void {
		if (!slug || typeof description !== "string") return;
		const trimmed = description.trim();
		if (!trimmed) return;
		knownDescriptions.set(slug, trimmed);
	}

	function descriptionFor(slug: string | null): string | null {
		if (!slug) return null;
		return knownDescriptions.get(slug) ?? null;
	}

	/**
	 * Eagerly hydrate runtime metadata for a slug so transitions and queue labels
	 * can show title/description even before the user navigates to that discourse.
	 */
	function hydrateRuntimeMeta(slug: string | null): Promise<void> {
		if (!slug) return Promise.resolve();
		const existing = runtimeMetaHydration.get(slug);
		if (existing) return existing;
		const p = loadVoiceManifestForDiscourse(slug)
			.then((m) => {
				if (!m) return;
				if (m.title) runtimeTitles.set(slug, m.title);
				if (typeof m.description === "string") rememberDescription(slug, m.description);
				if (typeof m.duration === "number" && m.duration > 0) {
					runtimeDurations.set(slug, m.duration);
				}
			})
			.catch(() => {});
		runtimeMetaHydration.set(slug, p);
		return p;
	}

	rememberDescription(initial.slug, initial.description);
	rememberDescription(initial.nextSlug, initial.nextDescription);
	rememberDescription(initial.prevSlug, initial.prevDescription);

	// Playlist context (from `?pl=<id>`). When non-null, the queue, neighbours,
	// and drawer header are sourced from the playlist instead of the global
	// route order. The URL's `?pl=` is preserved across in-mode transitions
	// (advanceTo / popstate) so the context survives navigation.
	//
	// Guard: if the resolved playlist does not contain the *current* slug,
	// fall back to the global queue. This happens when the user manually
	// edits the URL to a discourse outside the anthology while keeping
	// `?pl=...`. In that case the playlist context is meaningless — show
	// the natural queue and strip `?pl=` so neighbours/share-links also
	// reflect the global context.
	let playlist: Playlist | null = (() => {
		try {
			const id = new URLSearchParams(location.search).get("pl");
			const p = getPlaylist(id);
			if (p && !p.slugs.includes(initial.slug)) {
				stripPlFromUrl();
				return null;
			}
			return p;
		} catch {
			return null;
		}
	})();
	function stripPlFromUrl(): void {
		try {
			const url = new URL(location.href);
			if (url.searchParams.has("pl")) {
				url.searchParams.delete("pl");
				history.replaceState(history.state, "", url.toString());
			}
		} catch {}
	}
	const playlistQuery = (): string => (playlist ? `?pl=${playlist.id}` : "");
	const queueTitleEl = document.getElementById("listen-queue-title");
	function renderQueueTitle(): void {
		if (!queueTitleEl) return;
		queueTitleEl.textContent = playlist ? playlist.title : "Queue";
	}

	// Prev/next neighbours; refreshed on each track change from listenMode helper.
	let neighbours = {
		next: initial.nextSlug
			? {
				slug: initial.nextSlug,
				title: initial.nextTitle ?? initial.nextSlug,
				description: initial.nextDescription ?? null,
				displayId: initial.nextDisplayId ?? formatDisplayId(initial.nextSlug),
			}
			: null,
		prev: initial.prevSlug
			? {
				slug: initial.prevSlug,
				title: initial.prevTitle ?? initial.prevSlug,
				description: initial.prevDescription ?? null,
				displayId: initial.prevDisplayId ?? formatDisplayId(initial.prevSlug),
			}
			: null,
	};

	function refreshNeighbours(slug: string): void {
		// Honor any user reorder for prev/next neighbours so the footer chips
		// and the "Up next" label reflect what the queue drawer shows. Falls
		// back to canonical order when no reorder is saved.
		const slugs = effectiveSlugs();
		const i = slugs.indexOf(slug);
		const ns = i >= 0 && i + 1 < slugs.length ? slugs[i + 1] : null;
		const ps = i > 0 ? slugs[i - 1] : null;
		neighbours = {
			next: ns
				? {
					slug: ns,
					title: titleFor(ns, ns),
					description: descriptionFor(ns),
					displayId: formatDisplayId(ns),
				}
				: null,
			prev: ps
				? {
					slug: ps,
					title: titleFor(ps, ps),
					description: descriptionFor(ps),
					displayId: formatDisplayId(ps),
				}
				: null,
		};
		if (ns) {
			void hydrateRuntimeMeta(ns).then(() => {
				if (neighbours.next?.slug !== ns) return;
				neighbours.next.title = titleFor(ns, neighbours.next.title);
				neighbours.next.description = descriptionFor(ns);
				setQueueLabel();
			});
		}
		if (ps) {
			void hydrateRuntimeMeta(ps).then(() => {
				if (neighbours.prev?.slug !== ps) return;
				neighbours.prev.title = titleFor(ps, neighbours.prev.title);
				neighbours.prev.description = descriptionFor(ps);
			});
		}
	}

	function setQueueLabel(): void {
		if (!queueLabel) return;
		const shortQueueLabel = window.matchMedia("(max-width: 640px)").matches;
		if (neighbours.next) {
			queueLabel.textContent = `${shortQueueLabel ? "Next" : "Up next"} · ${neighbours.next.displayId}`;
			queueChip?.setAttribute(
				"title",
				`Open queue · next is ${neighbours.next.displayId}${neighbours.next.title ? " · " + neighbours.next.title : ""}`,
			);
			queueChip?.setAttribute("aria-label", "Queue");
		} else {
			queueLabel.textContent = "End of queue";
			queueChip?.setAttribute("title", "Open queue");
			queueChip?.setAttribute("aria-label", "Queue");
		}
		// Drawer is always reachable; chip is never disabled (the drawer also
		// shows previous items, useful even at end-of-queue).
		queueChip?.removeAttribute("disabled");
	}

	function setMediaSessionMetadata(): void {
		if (!("mediaSession" in navigator)) return;
		try {
			navigator.mediaSession.metadata = new MediaMetadata({
				title: `${current.displayId} · ${current.title}`,
				artist: "Words of the Buddha",
				album: "Listen mode",
			});
		} catch (e) {
			console.warn("listen-mode: mediaSession metadata failed", e);
		}
	}

	function bindMediaSessionActions(): void {
		if (!("mediaSession" in navigator)) return;
		const ms = navigator.mediaSession;
		try {
			ms.setActionHandler("play", () => void audio.play().catch(() => {}));
			ms.setActionHandler("pause", () => audio.pause());
			ms.setActionHandler("nexttrack", () => onNext());
			ms.setActionHandler("previoustrack", () => onPrev());
			ms.setActionHandler("seekto", (details) => {
				if (typeof details.seekTime === "number") {
					audio.currentTime = details.seekTime;
				}
			});
		} catch (e) {
			console.warn("listen-mode: mediaSession action binding failed", e);
		}
	}

	function setPlayIcon(playing: boolean): void {
		if (!playIcon) return;
		playIcon.innerHTML = playing
			? '<path d="M6 4.75A.75.75 0 0 1 6.75 4h2.5a.75.75 0 0 1 .75.75v14.5a.75.75 0 0 1-.75.75h-2.5a.75.75 0 0 1-.75-.75V4.75ZM14 4.75A.75.75 0 0 1 14.75 4h2.5a.75.75 0 0 1 .75.75v14.5a.75.75 0 0 1-.75.75h-2.5a.75.75 0 0 1-.75-.75V4.75Z"/>'
			: '<path d="M8 5.14v13.72c0 .8.87 1.29 1.55.87l10.79-6.86a1.03 1.03 0 0 0 0-1.74L9.55 4.27A1.03 1.03 0 0 0 8 5.14Z"/>';
		playButton.setAttribute("aria-label", playing ? "Pause" : "Play");
	}

	function renderHeader(): void {
		if (titleEl) titleEl.textContent = current.title;
		if (displayIdEl) displayIdEl.textContent = current.displayId;
		document.title = `Listen · ${current.displayId} ${current.title}`;
		if (modeSwitch) modeSwitch.href = `/${current.slug}${playlistQuery()}`;
	}

	// ── Waveform canvas ─────────────────────────────────────────────────
	// Path A: paragraph-structure timeline. Each bar represents one paragraph,
	// height-scaled by word density (words/sec). No extra data files needed —
	// all timing info comes from the already-loaded manifest.
	let waveScaleInitialized = false;

	function fillWaveRect(x: number, y: number, width: number, height: number, color: string): void {
		if (!waveCtx) return;
		waveCtx.fillStyle = color;
		waveCtx.fillRect(x, y, width, height);
	}

	function drawFallbackTimeline(
		W: number,
		H: number,
		dur: number,
		currentTime: number,
	): void {
		const trackH = Math.max(5, Math.min(8, H * 0.22));
		const trackY = Math.round((H - trackH) / 2);
		const playedW = Math.max(0, Math.min(W, (currentTime / dur) * W));
		fillWaveRect(0, trackY, W, trackH, "rgba(214, 199, 155, 0.18)");
		fillWaveRect(0, trackY, playedW, trackH, "rgba(214, 199, 155, 0.78)");
	}

	function drawHeadingMarkers(
		W: number,
		H: number,
		dur: number,
		paras: VoiceManifest["paragraphs"],
		headings: NonNullable<VoiceManifest["headings"]>,
	): void {
		const byId = new Map(paras.map((para) => [para.id, para]));
		for (const heading of headings) {
			const para = byId.get(heading.paragraphId);
			if (!para) continue;
			const x = Math.round((para.start / dur) * W);
			const lineWidth = heading.level <= 3 ? 2 : 1.5;
			fillWaveRect(x - lineWidth / 2, 1, lineWidth, H - 2, "rgba(236, 230, 218, 0.42)");
			fillWaveRect(Math.max(0, x - 3), 0, 6, 2, "rgba(236, 230, 218, 0.55)");
		}
	}

	function drawHeadingMarkersInParagraphMode(
		W: number,
		H: number,
		dur: number,
		paras: VoiceManifest["paragraphs"],
		headings: NonNullable<VoiceManifest["headings"]>,
	): void {
		const byId = new Map(paras.map((para) => [para.id, para]));
		for (const heading of headings) {
			const para = byId.get(heading.paragraphId);
			if (!para) continue;
			const x = Math.round((para.start / dur) * W);
			const isPrimaryLevel = heading.level <= 3;
			const lineWidth = isPrimaryLevel ? 2.25 : 1.5;
			const stemColor = isPrimaryLevel
				? "rgba(244, 236, 214, 0.85)"
				: "rgba(236, 230, 218, 0.68)";
			const capColor = isPrimaryLevel
				? "rgba(244, 236, 214, 0.95)"
				: "rgba(236, 230, 218, 0.78)";
			const glowColor = isPrimaryLevel
				? "rgba(214, 199, 155, 0.35)"
				: "rgba(214, 199, 155, 0.2)";
			fillWaveRect(x - 2, 1, 4, H - 2, glowColor);
			fillWaveRect(x - lineWidth / 2, 1, lineWidth, H - 2, stemColor);
			fillWaveRect(Math.max(0, x - 3), 0, 6, 2, capColor);
		}
	}

	function drawWaveformCanvas(): void {
		if (!waveCanvas || !waveCtx || !manifest) return;
		const W = waveCanvas.clientWidth;
		const H = waveCanvas.clientHeight;
		if (W === 0 || H === 0) return;
		const dpr = window.devicePixelRatio || 1;
		const bW = Math.round(W * dpr);
		const bH = Math.round(H * dpr);
		if (!waveScaleInitialized || waveCanvas.width !== bW || waveCanvas.height !== bH) {
			waveCanvas.width = bW;
			waveCanvas.height = bH;
			waveCtx.scale(dpr, dpr);
			waveScaleInitialized = true;
		}
		waveCtx.clearRect(0, 0, W, H);

		const dur = (typeof manifest.duration === "number" && manifest.duration > 0)
			? manifest.duration
			: (audio.duration > 0 ? audio.duration : 0);
		if (dur <= 0) return;

		const paras = manifest.paragraphs;
		const currentTime = seek?.matches(":active")
			? (Number(seek.value) / 100) * dur
			: audio.currentTime;
		const pxPerParagraph = W / Math.max(1, paras.length);

		const useFallbackTimeline = pxPerParagraph < MIN_STRUCTURED_WAVEFORM_PX_PER_PARAGRAPH;

		if (useFallbackTimeline) {
			drawFallbackTimeline(W, H, dur, currentTime);
		} else {
			// Compute word density (words/sec) for height variation.
			const densities = paras.map(p => {
				const d = p.end - p.start;
				return d > 0 ? p.words.length / d : 0;
			});
			const maxD = Math.max(...densities, 1);
			const minD = Math.min(...densities.filter(d => d > 0), 0);
			const dRange = maxD - minD || 1;

			const GAP_PX = 1.5;
			const MIN_H_RATIO = 0.3;
			const COLOR_PLAYED = "rgba(214, 199, 155, 0.62)";
			const COLOR_UNPLAYED = "rgba(214, 199, 155, 0.15)";

			for (let i = 0; i < paras.length; i++) {
				const p = paras[i];
				const x = (p.start / dur) * W;
				const rawW = ((p.end - p.start) / dur) * W;
				const barW = Math.max(rawW - GAP_PX, 1);

				const norm = (densities[i] - minD) / dRange;
				const hRatio = MIN_H_RATIO + (1 - MIN_H_RATIO) * norm;
				const barH = Math.round(H * hRatio);
				const barY = Math.round((H - barH) / 2);

				if (currentTime >= p.end) {
					waveCtx.fillStyle = COLOR_PLAYED;
					waveCtx.fillRect(x, barY, barW, barH);
				} else if (currentTime <= p.start) {
					waveCtx.fillStyle = COLOR_UNPLAYED;
					waveCtx.fillRect(x, barY, barW, barH);
				} else {
					const fraction = (currentTime - p.start) / (p.end - p.start);
					const splitX = x + fraction * barW;
					waveCtx.fillStyle = COLOR_PLAYED;
					waveCtx.fillRect(x, barY, splitX - x, barH);
					waveCtx.fillStyle = COLOR_UNPLAYED;
					waveCtx.fillRect(splitX, barY, barW - (splitX - x), barH);
				}
			}
		}

		if (useFallbackTimeline && manifest.headings?.length) {
			drawHeadingMarkers(W, H, dur, paras, manifest.headings);
		} else if (!useFallbackTimeline && manifest.headings?.length) {
			drawHeadingMarkersInParagraphMode(W, H, dur, paras, manifest.headings);
		}

		// Playhead line.
		if (currentTime > 0 && dur > 0) {
			const px = (currentTime / dur) * W;
			waveCtx.fillStyle = "rgba(255, 255, 255, 0.85)";
			waveCtx.fillRect(Math.round(px) - 0.75, 0, 1.5, H);
		}
	}

	function isFallbackTimelineMode(): boolean {
		if (!manifest || !waveCanvas) return false;
		const W = waveCanvas.clientWidth;
		if (W <= 0) return false;
		return W / Math.max(1, manifest.paragraphs.length) < MIN_STRUCTURED_WAVEFORM_PX_PER_PARAGRAPH;
	}

	if (waveCanvas) {
		const ro = new ResizeObserver(() => {
			waveScaleInitialized = false;
			drawWaveformCanvas();
		});
		ro.observe(waveCanvas);
	}

	function renderParagraphs(m: VoiceManifest | null): void {
		if (!stage) return;
		stage.innerHTML = "";
		if (!m || !m.paragraphs.length) {
			const empty = document.createElement("p");
			empty.className = "listen-paragraph listen-paragraph--placeholder";
			empty.textContent = "Audio is unavailable for this discourse.";
			stage.appendChild(empty);
			activeParaIdx = -1;
			return;
		}
		// Per-word spans are emitted eagerly; highlight is driven from `timeupdate`.
		// Verse line breaks come from `p.lineSizes` (manifest backfill v2). The
		// `sum(lineSizes) === words.length` invariant was already enforced by the
		// backfill writer, so we honour any present `lineSizes` directly.
		const headingsByParagraph = new Map<number, NonNullable<VoiceManifest["headings"]>>();
		for (const heading of m.headings ?? []) {
			const existing = headingsByParagraph.get(heading.paragraphId) ?? [];
			existing.push(heading);
			headingsByParagraph.set(heading.paragraphId, existing);
		}

		for (let i = 0; i < m.paragraphs.length; i++) {
			const p = m.paragraphs[i];
			for (const heading of headingsByParagraph.get(p.id) ?? []) {
				const headingTag = heading.level <= 3 ? "h3" : "h4";
				const headingEl = document.createElement(headingTag);
				headingEl.className = "listen-heading";
				headingEl.textContent = heading.text;
				stage.appendChild(headingEl);
			}
			const el = document.createElement("p");
			el.className = "listen-paragraph";
			el.dataset.paraId = String(p.id);
			el.dataset.paragraphNumber = String(p.id);

			const actions = document.createElement("span");
			actions.className = "listen-para-actions";

			const btnSingle = document.createElement("button");
			btnSingle.type = "button";
			btnSingle.className = "listen-para-btn listen-para-btn--single";
			btnSingle.setAttribute("aria-label", "Play this paragraph only");
			btnSingle.title = "Play this paragraph only";
			btnSingle.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.8" stroke="currentColor" width="16" height="16" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M21 7.5V18M15 7.5V18M3 16.811V8.69c0-.864.933-1.406 1.683-.977l7.108 4.061a1.125 1.125 0 0 1 0 1.954l-7.108 4.061A1.125 1.125 0 0 1 3 16.811Z"></path></svg>';
			btnSingle.addEventListener("click", (e) => {
				e.stopPropagation();
				void playParagraphByIndex(i, true);
			});

			const btnFrom = document.createElement("button");
			btnFrom.type = "button";
			btnFrom.className = "listen-para-btn listen-para-btn--from";
			btnFrom.setAttribute("aria-label", "Play from here");
			btnFrom.title = "Play from here";
			btnFrom.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.8" stroke="currentColor" width="16" height="16" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 0 1 0 1.972l-11.54 6.347a1.125 1.125 0 0 1-1.667-.986V5.653Z"></path></svg>';
			btnFrom.addEventListener("click", (e) => {
				e.stopPropagation();
				void playParagraphByIndex(i, false);
			});

			actions.appendChild(btnSingle);
			actions.appendChild(btnFrom);
			el.appendChild(actions);

			const text = document.createElement("span");
			text.className = "listen-para-text";
			const lineSizes = p.lineSizes && p.lineSizes.length > 1 ? p.lineSizes : undefined;
			if (p.isVerse || lineSizes) {
				el.classList.add("listen-paragraph--verse");
			}
			renderWordSpans(text, p.words, lineSizes);
			el.appendChild(text);
			stage.appendChild(el);
		}
		activeParaIdx = -1;
		activeWordIdx = -1;
		activeLineParaIdx = -1;
		activeLineTop = Number.NaN;
		stage.scrollTop = 0;
	}

	function highlightParagraph(idx: number): void {
		if (!stage) return;
		const all = stage.querySelectorAll(".listen-paragraph");
		all.forEach((el, i) => {
			el.classList.toggle("is-active", i === idx);
		});
		activeLineParaIdx = idx;
		activeLineTop = Number.NaN;
	}

	function highlightWord(paraIdx: number, wordIdx: number): void {
		if (!stage) return;
		// Clear previous active word (could be in a different paragraph).
		const prev = stage.querySelector(".listen-word.is-active");
		if (prev) prev.classList.remove("is-active");
		if (paraIdx < 0 || wordIdx < 0) return;
		const para = stage.querySelectorAll(".listen-paragraph")[paraIdx];
		if (!(para instanceof HTMLElement)) return;
		const span = para.querySelector(`.listen-word[data-w="${wordIdx}"]`);
		if (!(span instanceof HTMLElement)) return;
		span.classList.add("is-active");
		if (scrollUnlocked) return;

		// Keep the active word within a stable reading window. Most word changes
		// should not move the viewport; scrolling only steps when the active line
		// crosses a guard band or is actually clipped.
		const transport = document.querySelector(".listen-transport");
		const stageRect = stage.getBoundingClientRect();
		const wordRect = span.getBoundingClientRect();
		const paraRect = para.getBoundingClientRect();
		const lineTop = Math.round(wordRect.top - stageRect.top + stage.scrollTop);
		const isNewLine =
			activeLineParaIdx !== paraIdx ||
			!Number.isFinite(activeLineTop) ||
			Math.abs(lineTop - activeLineTop) > Math.max(8, wordRect.height * 0.6);
		if (isNewLine) {
			activeLineParaIdx = paraIdx;
			activeLineTop = lineTop;
		}
		const transportRect =
			transport instanceof HTMLElement ? transport.getBoundingClientRect() : null;
		const visualBottom = transportRect
			? Math.min(stageRect.bottom, transportRect.top)
			: stageRect.bottom;
		const stageHeight = Math.max(1, visualBottom - stageRect.top);
		const compactViewport = stageHeight < 520 || window.matchMedia("(max-width: 640px)").matches;
		const lineHeight = Math.max(18, wordRect.height);
		const paragraphFits = paraRect.height <= stageHeight * 0.55;
		const paragraphFullyVisible = paraRect.top >= stageRect.top && paraRect.bottom <= visualBottom;
		if (paragraphFits && paragraphFullyVisible) return;

		const topGuard = stageRect.top + stageHeight * (compactViewport ? 0.18 : 0.16);
		const bottomGuard = Math.min(
			stageRect.top + stageHeight * (compactViewport ? 0.78 : 0.84),
			visualBottom - lineHeight * (compactViewport ? 1.75 : 2.25),
		);
		const clippedAboveViewport = wordRect.bottom < stageRect.top + lineHeight * 0.5;
		const clippedBelowViewport = wordRect.top > visualBottom - lineHeight * 0.5;
		const shouldStep =
			(isNewLine && (wordRect.top < topGuard || wordRect.bottom > bottomGuard)) ||
			clippedAboveViewport ||
			clippedBelowViewport;

		if (shouldStep) {
			const landingRatio = compactViewport ? 0.38 : 0.42;
			const targetTop = stage.scrollTop + (wordRect.top - stageRect.top) - stageHeight * landingRatio;
			const maxScrollTop = Math.max(0, stage.scrollHeight - stage.clientHeight);
			const nextScrollTop = Math.max(0, Math.min(maxScrollTop, targetTop));
			if (Math.abs(nextScrollTop - stage.scrollTop) > lineHeight * 0.5) {
				stage.scrollTo({ top: nextScrollTop, behavior: "smooth" });
			}
		}
	}

	function findWordIdxAt(paraIdx: number, t: number): number {
		if (!manifest) return -1;
		const p = manifest.paragraphs[paraIdx];
		if (!p || !p.words.length) return -1;
		const ws = p.words;
		let lo = 0;
		let hi = ws.length;
		while (lo < hi) {
			const mid = (lo + hi) >> 1;
			if (ws[mid].s <= t) lo = mid + 1;
			else hi = mid;
		}
		return Math.max(0, lo - 1);
	}

	function findParagraphIdxAt(t: number): number {
		if (!manifest) return -1;
		const ps = manifest.paragraphs;
		let lo = 0;
		let hi = ps.length;
		while (lo < hi) {
			const mid = (lo + hi) >> 1;
			if (ps[mid].start <= t) lo = mid + 1;
			else hi = mid;
		}
		return Math.max(0, lo - 1);
	}

	async function loadTrack(
		slug: string,
		opts: { autoplayAfterLoad: boolean; resumeAt?: number; description?: string | null },
	): Promise<void> {
		// Update header optimistically. Title source priority:
		//   1. audioTitles bundled map (build-time slug → title)
		//   2. neighbours map (build-time prev/next)
		//   3. manifest.title (Phase 1 schema extension — may override later)
		//   4. slug (last-resort fallback)
		current = { ...current, slug };
		current.displayId = formatDisplayId(slug);
		current.description = opts.description ?? descriptionFor(slug);
		const mapped = audioTitles[slug];
		if (mapped) current.title = mapped;
		else if (neighbours.next?.slug === slug) current.title = neighbours.next.title;
		else if (neighbours.prev?.slug === slug) current.title = neighbours.prev.title;
		else current.title = slug;

		renderHeader();
		setMediaSessionMetadata();

		const m = await loadVoiceManifestForDiscourse(slug);
		manifest = m;
		if (!m) {
			renderParagraphs(null);
			return;
		}
		// Manifest may carry an authoritative title (Phase 1 schema extension).
		if (m.title) current.title = m.title;
		if (m.title) runtimeTitles.set(slug, m.title);
		if (typeof m.description === "string") {
			current.description = m.description;
			rememberDescription(slug, m.description);
		}
		if (typeof m.duration === "number" && m.duration > 0) {
			runtimeDurations.set(slug, m.duration);
		}
		if (m.slug) current.slug = m.slug;
		renderHeader();
		setMediaSessionMetadata();
		renderParagraphs(m);
		drawWaveformCanvas();

		audio.src = webmUrlFor(slug, m);
		audio.load();
		// playbackRate is per-element but some browsers reset it on `src` change;
		// re-apply after every load so the persisted speed sticks across tracks.
		applySpeed();
		if (typeof opts.resumeAt === "number" && opts.resumeAt > 0) {
			const seekTarget = opts.resumeAt;
			const onMeta = (): void => {
				try { audio.currentTime = Math.min(seekTarget, (audio.duration || seekTarget) - 0.1); } catch {}
				audio.removeEventListener("loadedmetadata", onMeta);
			};
			audio.addEventListener("loadedmetadata", onMeta);
		}
		if (opts.autoplayAfterLoad) {
			try { await audio.play(); } catch (e) {
				// iOS may require user gesture across some boundaries — surface for testing.
				console.warn("listen-mode: autoplay denied", e);
			}
		}
	}

	type AdvanceReason = "manual" | "queue" | "autoplay-end" | "history";

	type TransitionState = {
		timer: number;
		raf: number | null;
		playNow?: () => void;
		abortCtrl?: AbortController;
	};

	let pulseTimer: number | null = null;
	let transitionState: TransitionState | null = null;

	function hideTrackPulse(): void {
		const el = document.getElementById("listen-track-pulse");
		const actions = document.getElementById("listen-track-pulse-actions");
		const countdownEl = document.getElementById("listen-track-pulse-countdown");
		const playNowBtn = document.getElementById("listen-track-pulse-play-now") as HTMLButtonElement | null;
		if (!el || !actions || !countdownEl) return;
		el.classList.remove("is-visible", "is-hold");
		el.setAttribute("aria-hidden", "true");
		el.onclick = null;
		actions.hidden = true;
		countdownEl.style.removeProperty("--countdown-progress");
		playNowBtn?.style.removeProperty("--countdown-progress");
		playNowBtn?.classList.remove("is-countdown");
		playButton.classList.remove("is-next-countdown");
		if (pulseTimer !== null) {
			clearTimeout(pulseTimer);
			pulseTimer = null;
		}
	}

	function clearTransitionState(): void {
		if (!transitionState) return;
		clearTimeout(transitionState.timer);
		if (transitionState.raf !== null) cancelAnimationFrame(transitionState.raf);
		transitionState.abortCtrl?.abort();
		transitionState = null;
		hideTrackPulse();
	}

	function showTrackPulse(opts: {
		displayId: string;
		title: string;
		description?: string | null;
		holdMs?: number;
		interactive?: boolean;
		onPlayNow?: () => void;
		onDismiss?: () => void;
	}): void {
		const el = document.getElementById("listen-track-pulse");
		const idEl = document.getElementById("listen-track-pulse-id");
		const titleEl = document.getElementById("listen-track-pulse-title");
		const descEl = document.getElementById("listen-track-pulse-description");
		const actions = document.getElementById("listen-track-pulse-actions") as HTMLElement | null;
		const playNowBtn = document.getElementById("listen-track-pulse-play-now") as HTMLButtonElement | null;
		const cancelBtn = document.getElementById("listen-track-pulse-cancel") as HTMLButtonElement | null;
		const countdownEl = document.getElementById("listen-track-pulse-countdown") as HTMLElement | null;
		if (!el || !idEl || !titleEl || !descEl || !actions || !countdownEl) return;

		idEl.textContent = opts.displayId;
		titleEl.textContent = opts.title;
		descEl.textContent = opts.description?.trim() ?? "";
		descEl.hidden = !descEl.textContent;
		el.setAttribute("aria-hidden", "false");
		el.classList.add("is-visible");

		if (pulseTimer !== null) {
			clearTimeout(pulseTimer);
			pulseTimer = null;
		}

		if (!opts.interactive || !opts.holdMs || opts.holdMs <= 0) {
			actions.hidden = true;
			el.classList.remove("is-hold");
			countdownEl.style.removeProperty("--countdown-progress");
			playNowBtn?.style.removeProperty("--countdown-progress");
			playNowBtn?.classList.remove("is-countdown");
			playButton.classList.remove("is-next-countdown");
			pulseTimer = window.setTimeout(() => {
				hideTrackPulse();
			}, DEFAULT_TRANSITION_PULSE_MS);
			return;
		}

		el.classList.add("is-hold");
		actions.hidden = false;
		playButton.classList.add("is-next-countdown");
		playNowBtn?.classList.add("is-countdown");
		playNowBtn?.style.setProperty("--countdown-progress", "0");
		let done = false;
		const started = performance.now();

		const finalize = (action: "play" | "dismiss"): void => {
			if (done) return;
			done = true;
			if (action === "play") opts.onPlayNow?.();
			else opts.onDismiss?.();
		};

		const rafTick = (): void => {
			if (done) return;
			const elapsed = performance.now() - started;
			const progress = Math.max(0, Math.min(1, elapsed / opts.holdMs!));
			countdownEl.style.setProperty("--countdown-progress", String(progress));
			playNowBtn?.style.setProperty("--countdown-progress", String(progress));
			if (progress >= 1) {
				finalize("play");
				return;
			}
			if (transitionState) transitionState.raf = requestAnimationFrame(rafTick);
		};

		const onPlayNow = (): void => finalize("play");
		const onDismiss = (e?: Event): void => {
			e?.stopPropagation();
			finalize("dismiss");
		};

		el.onclick = onPlayNow;
		playNowBtn?.addEventListener("click", onPlayNow, { once: true });
		cancelBtn?.addEventListener("click", onDismiss, { once: true });

		const abortCtrl = new AbortController();
		const timer = window.setTimeout(() => finalize("play"), opts.holdMs);
		transitionState = {
			timer,
			raf: requestAnimationFrame(rafTick),
			playNow: onPlayNow,
			abortCtrl,
		};
	}

	async function advanceTo(
		slug: string,
		opts: {
			autoplayAfterLoad?: boolean;
			reason?: AdvanceReason;
			description?: string | null;
			showPulse?: boolean;
		} = {},
	): Promise<void> {
		// Capture the OUTGOING position so a later browser-back lands the
		// listener back where they were, not at 0.
		clearTransitionState();
		rememberPosition(current.slug, audio.currentTime, audio.duration ?? null);
		refreshNeighbours(slug);
		setQueueLabel();
		// Push a new history entry so the browser back button returns to the
		// previous discourse (in-listen-mode navigation). The state object lets
		// us distinguish our own entries from external navigations in popstate.
		if (opts.reason !== "history") {
			history.pushState({ listen: true, slug }, "", `/listen/${slug}${playlistQuery()}`);
		}
		if (opts.showPulse !== false) {
			showTrackPulse({
				displayId: formatDisplayId(slug),
				title: titleFor(slug, slug),
				description: null,
			});
		}
		const resumeAt = sessionPositions.get(slug);
		await loadTrack(slug, {
			autoplayAfterLoad: opts.autoplayAfterLoad ?? true,
			resumeAt,
			description: opts.description,
		});
		// Refresh drawer contents if it happens to be open.
		if (queueDrawer && !queueDrawer.hidden) renderQueue();
	}

	async function beginAutoplayTransition(next: {
		slug: string;
		title: string;
		displayId: string;
		description: string | null;
	}): Promise<void> {
		clearTransitionState();
		await hydrateRuntimeMeta(next.slug);
		const hydratedTitle = titleFor(next.slug, next.title);
		const hydratedDescription = descriptionFor(next.slug) ?? next.description;
		if (neighbours.next?.slug === next.slug) {
			neighbours.next.title = hydratedTitle;
			neighbours.next.description = hydratedDescription;
			setQueueLabel();
		}
		showTrackPulse({
			displayId: next.displayId,
			title: hydratedTitle,
			description: hydratedDescription,
			holdMs: autoplayTransitionHoldMs,
			interactive: true,
			onPlayNow: () => {
				void advanceTo(next.slug, {
					autoplayAfterLoad: true,
					reason: "autoplay-end",
					description: hydratedDescription,
					showPulse: false,
				});
			},
			onDismiss: () => {
				clearTransitionState();
			},
		});
	}

	function checkSingleParagraphPause(): void {
		if (pauseAfterParagraphIdx < 0 || !manifest || audio.paused) return;
		const target = manifest.paragraphs[pauseAfterParagraphIdx];
		if (!target) return;
		if (audio.currentTime >= target.end) {
			audio.pause();
			pauseAfterParagraphIdx = -1;
		}
	}

	async function playParagraphByIndex(idx: number, singleOnly: boolean): Promise<void> {
		if (!manifest) return;
		const p = manifest.paragraphs[idx];
		if (!p) return;
		clearTransitionState();
		paragraphPlaybackMode = singleOnly ? "single" : "continuous";
		pauseAfterParagraphIdx = singleOnly ? idx : -1;
		audio.currentTime = p.start;
		if (audio.paused) {
			try { await audio.play(); } catch {}
		}
	}

	async function onNext(): Promise<void> {
		if (!manifest) return;
		clearTransitionState();
		// Within-track: jump to next paragraph if available.
		const i = activeParaIdx >= 0 ? activeParaIdx : findParagraphIdxAt(audio.currentTime);
		if (i + 1 < manifest.paragraphs.length) {
			await playParagraphByIndex(i + 1, paragraphPlaybackMode === "single");
			return;
		}
		// At end → next discourse if autoplay on.
		if (autoplay && neighbours.next) {
			await advanceTo(neighbours.next.slug, {
				autoplayAfterLoad: true,
				reason: "manual",
				description: neighbours.next.description,
			});
		}
	}

	async function onPrev(): Promise<void> {
		if (!manifest) return;
		clearTransitionState();
		const i = activeParaIdx >= 0 ? activeParaIdx : findParagraphIdxAt(audio.currentTime);
		const para = manifest.paragraphs[i];
		const offsetIntoPara = para ? audio.currentTime - para.start : 0;
		// >3s in: restart current paragraph (YT semantics).
		if (offsetIntoPara > PREV_RESTART_THRESHOLD_S) {
			await playParagraphByIndex(i, paragraphPlaybackMode === "single");
			return;
		}
		if (i > 0) {
			await playParagraphByIndex(i - 1, paragraphPlaybackMode === "single");
			return;
		}
		// First paragraph + ≤3s + autoplay on → previous discourse, paragraph 1.
		if (autoplay && neighbours.prev) {
			await advanceTo(neighbours.prev.slug, {
				autoplayAfterLoad: true,
				reason: "manual",
				description: neighbours.prev.description,
			});
		}
	}

	async function advanceDiscourse(direction: -1 | 1): Promise<void> {
		const target = direction < 0 ? neighbours.prev : neighbours.next;
		if (!target) return;
		await advanceTo(target.slug, {
			autoplayAfterLoad: true,
			reason: "manual",
			description: target.description,
		});
	}

	// ── Wire DOM events ─────────────────────────────────────────────────
	playButton.addEventListener("click", () => {
		clearTransitionState();
		if (audio.paused) {
			paragraphPlaybackMode = "continuous";
			pauseAfterParagraphIdx = -1;
			audio.play().catch((e) => console.warn("listen-mode: play() denied", e));
		} else {
			audio.pause();
		}
	});
	nextBtn.addEventListener("click", () => void onNext());
	prevBtn.addEventListener("click", () => void onPrev());
	scrubberToggle?.addEventListener("click", () => {
		scrubberCollapsed = !scrubberCollapsed;
		saveScrubberCollapsed(scrubberCollapsed);
		applyScrubberCollapsed();
	});
	autoplayToggle?.addEventListener("click", () => {
		autoplay = !autoplay;
		saveAutoplay(autoplay);
		applyAutoplayUi();
	});
	scrollLockToggle?.addEventListener("click", () => {
		scrollUnlocked = !scrollUnlocked;
		saveScrollUnlocked(scrollUnlocked);
		applyScrollUnlock();
	});

	// Snapping: paragraph starts keep a tight fixed window, while heading starts
	// use a duration-relative window so long mobile timelines are still touchable.
	// Both windows are symmetric: before or after a target can snap to it.
	function headingSnapThresholdSec(): number {
		const dur = (audio.duration > 0 ? audio.duration : manifest?.duration) ?? 0;
		if (dur <= 0) return MIN_HEADING_SNAP_THRESHOLD_SEC;
		return Math.max(
			MIN_HEADING_SNAP_THRESHOLD_SEC,
			Math.min(MAX_HEADING_SNAP_THRESHOLD_SEC, dur * HEADING_SNAP_THRESHOLD_RATIO),
		);
	}

	function snapToNearestHeadingStart(t: number, maxDist: number): number | null {
		if (!manifest?.headings?.length) return null;
		const byId = new Map(manifest.paragraphs.map((para) => [para.id, para]));
		let best = t;
		let bestDist = maxDist;
		for (const heading of manifest.headings) {
			const para = byId.get(heading.paragraphId);
			if (!para) continue;
			const dist = Math.abs(t - para.start);
			if (dist < bestDist) {
				bestDist = dist;
				best = para.start;
			}
		}
		return best === t ? null : best;
	}

	function snapToNearestVisibleBoundary(t: number): number {
		if (!manifest) return t;
		const paras = manifest.paragraphs;
		const headingSnap = snapToNearestHeadingStart(t, headingSnapThresholdSec());
		if (isFallbackTimelineMode()) {
			return headingSnap ?? t;
		}
		if (headingSnap !== null) return headingSnap;

		let best = t;
		let bestDist = PARAGRAPH_SNAP_THRESHOLD_SEC;
		for (let i = 0; i < paras.length; i++) {
			const p = paras[i];
			// Candidate A: this paragraph's own start.
			const distStart = Math.abs(t - p.start);
			if (distStart < bestDist) {
				bestDist = distStart;
				best = p.start;
			}
			// Candidate B: next paragraph's start, when t is in the trailing
			// window of this paragraph's end. Use strict-less so ties prefer
			// the paragraph start already recorded above.
			if (i + 1 < paras.length && t > p.end - PARAGRAPH_SNAP_THRESHOLD_SEC) {
				const nextStart = paras[i + 1].start;
				const distNext = Math.abs(t - nextStart);
				if (distNext < bestDist) {
					bestDist = distNext;
					best = nextStart;
				}
			}
		}
		return best;
	}

	seek.addEventListener("input", () => {
		clearTransitionState();
		paragraphPlaybackMode = "continuous";
		pauseAfterParagraphIdx = -1;
		const pct = Number(seek.value);
		if (!Number.isFinite(pct) || !audio.duration) return;
		const rawTime = (pct / 100) * audio.duration;
		const snappedTime = snapToNearestVisibleBoundary(rawTime);
		audio.currentTime = snappedTime;
		// Nudge the range thumb to the snapped position so the visual stays in sync.
		if (snappedTime !== rawTime) {
			seek.value = String((snappedTime / audio.duration) * 100);
		}
		drawWaveformCanvas();
	});

	queueChip?.addEventListener("click", () => {
		clearTransitionState();
		// Phase 2.4: tapping the queue chip opens the queue drawer.
		// Falls back to direct-advance only when there's nothing to show.
		if (queueDrawer && queueScrim && queueList) {
			openQueueDrawer();
		} else if (neighbours.next) {
			void advanceTo(neighbours.next.slug, {
				autoplayAfterLoad: true,
				reason: "queue",
				description: neighbours.next.description,
			});
		}
	});

	// ── Queue drawer (Phase 2.4) ────────────────────────────────────────
	// Render the full queue so users can scroll freely backward and forward.
	// On open, anchor the current item with a few previous rows visible for
	// context instead of trimming the previous side to only those rows.
	const QUEUE_CURRENT_VISIBLE_OFFSET_N = 3;

	/**
	 * Per-queue user reorder, persisted to localStorage.
	 *   - Playlist queues: key = `listen:queueOrder:<playlist-id>`.
	 *   - Global queue:    key = `listen:queueOrder:__global__`.
	 * Both are reorderable; the only thing the user can't reorder is a
	 * single-discourse view (no playlist + we still allow global drag).
	 */
	const LS_QUEUE_ORDER_PREFIX = "listen:queueOrder:";
	const GLOBAL_ORDER_KEY = "__global__";
	function loadCustomOrder(key: string): string[] | null {
		try {
			const raw = localStorage.getItem(LS_QUEUE_ORDER_PREFIX + key);
			if (!raw) return null;
			const arr = JSON.parse(raw) as unknown;
			return Array.isArray(arr) && arr.every((s) => typeof s === "string") ? arr : null;
		} catch { return null; }
	}
	function saveCustomOrder(key: string, order: string[]): void {
		try {
			localStorage.setItem(LS_QUEUE_ORDER_PREFIX + key, JSON.stringify(order));
		} catch {}
	}

	/** localStorage key for the current queue context. */
	function currentQueueKey(): string {
		return playlist ? playlist.id : GLOBAL_ORDER_KEY;
	}

	/**
	 * Canonical (pre-reorder) slug list for the current queue context, with
	 * non-audio entries removed. For playlists this preserves the curated
	 * order; for the global queue it's `audioRoutes()` order.
	 */
	function canonicalSlugs(): readonly string[] {
		if (playlist) return playlist.slugs.filter(isAudioSlug);
		// audioRoutes() is already filtered.
		// Lazy import via existing queueWindow / nextAudioSlug helpers would
		// require us to materialise the list here; do it directly.
		return routesAudioCache ?? (routesAudioCache = computeRoutesAudio());
	}
	let routesAudioCache: readonly string[] | null = null;
	function computeRoutesAudio(): readonly string[] {
		// queueWindow already filters to audio; reuse via a wide window from
		// the first slug. Simpler: call once with current and stitch — but we
		// need the *full* order. Do a direct filter.
		const w = queueWindow(current.slug, Number.MAX_SAFE_INTEGER);
		return [...w.before, ...(w.current ? [w.current] : []), ...w.after];
	}

	/**
	 * Merge canonical order with the user's saved order:
	 *   - Slugs in saved order keep that order, filtered to those still present.
	 *   - Newly-added canonical slugs (since the last save) are spliced in next
	 *     to their nearest *canonical* neighbour that still exists in saved
	 *     order. This keeps a freshly-added discourse near its collection
	 *     siblings (e.g. a new SN 3.3 lands beside SN 3.2 / SN 3.4) instead of
	 *     being dumped at the very end of the queue.
	 *
	 *     Algorithm: walk canonical left-to-right. For each new slug (not in
	 *     saved), find the most recent saved-and-still-present slug we've seen
	 *     to its left in canonical order; splice the newcomer immediately
	 *     after that anchor in `ordered`. If no anchor exists yet (newcomer is
	 *     before any survivor in canonical order), prepend.
	 */
	function effectiveSlugs(): readonly string[] {
		const canonical = canonicalSlugs();
		const saved = loadCustomOrder(currentQueueKey());
		if (!saved) return canonical;
		const canonicalSet = new Set(canonical);
		const ordered = saved.filter((s) => canonicalSet.has(s));
		const savedSet = new Set(ordered);
		let lastAnchor: string | null = null;
		for (const s of canonical) {
			if (savedSet.has(s)) {
				lastAnchor = s;
				continue;
			}
			if (lastAnchor === null) {
				ordered.unshift(s);
			} else {
				const at = ordered.indexOf(lastAnchor);
				ordered.splice(at + 1, 0, s);
			}
			savedSet.add(s);
			lastAnchor = s;
		}
		return ordered;
	}

	/** True when the user has a saved reorder for the current queue context. */
	function hasCustomOrder(): boolean {
		return loadCustomOrder(currentQueueKey()) !== null;
	}

	/** Drop the saved reorder for the current queue and re-render the drawer. */
	function resetQueueOrder(): void {
		try {
			localStorage.removeItem(LS_QUEUE_ORDER_PREFIX + currentQueueKey());
		} catch {}
		refreshNeighbours(current.slug);
		setQueueLabel();
		if (queueDrawer && !queueDrawer.hidden) renderQueue();
	}

	function renderQueueItemMeta(
		metaEl: HTMLElement,
		kind: "before" | "current" | "after",
		durSec: number | undefined,
	): void {
		metaEl.textContent = "";
		if (kind === "current") {
			const nowEl = document.createElement("span");
			nowEl.className = "listen-queue-item-marker listen-queue-item-marker--now";
			nowEl.textContent = "Now";
			metaEl.appendChild(nowEl);
			if (typeof durSec === "number") {
				const sepEl = document.createElement("span");
				sepEl.className = "listen-queue-item-marker-sep";
				sepEl.textContent = " · ";
				const durEl = document.createElement("span");
				durEl.className =
					"listen-queue-item-marker listen-queue-item-marker--duration";
				durEl.textContent = formatDurationShort(durSec);
				metaEl.appendChild(sepEl);
				metaEl.appendChild(durEl);
			}
			return;
		}
		if (typeof durSec === "number") {
			const durEl = document.createElement("span");
			durEl.className = "listen-queue-item-marker listen-queue-item-marker--duration";
			durEl.textContent = formatDurationShort(durSec);
			metaEl.appendChild(durEl);
		}
	}

	/**
	 * Hydrate missing queue metadata (title + duration) via manifest for slugs
	 * that were added after the last generated maps build.
	 */
	function hydrateQueueMetadata(): void {
		if (!queueList) return;
		const rows = queueList.querySelectorAll<HTMLLIElement>(".listen-queue-li[data-slug]");
		for (const row of rows) {
			const slug = row.dataset.slug ?? null;
			if (!slug) continue;
			const missingTitle = !audioTitles[slug] && !runtimeTitles.has(slug);
			const missingDuration = typeof durationFor(slug) !== "number";
			if (!missingTitle && !missingDuration) continue;
			const titleEl = row.querySelector<HTMLElement>(".listen-queue-item-title");
			const metaEl = row.querySelector<HTMLElement>(".listen-queue-item-meta");
			const btn = row.querySelector<HTMLButtonElement>(".listen-queue-item");
			const kind: "before" | "current" | "after" =
				btn?.classList.contains("is-current")
					? "current"
					: btn?.classList.contains("is-before")
						? "before"
						: "after";
			void loadVoiceManifestForDiscourse(slug).then((m) => {
				if (!m) return;
				if (missingTitle && m.title) {
					runtimeTitles.set(slug, m.title);
					if (titleEl?.isConnected) titleEl.textContent = m.title;
				}
				if (missingDuration && typeof m.duration === "number" && m.duration > 0) {
					runtimeDurations.set(slug, m.duration);
					if (metaEl?.isConnected) renderQueueItemMeta(metaEl, kind, m.duration);
					updateQueueStats(effectiveSlugs());
				}
			});
		}
	}

	function renderQueue(): void {
		if (!queueList) return;
		const slugs = effectiveSlugs();
		const i = slugs.indexOf(current.slug);
		let before: string[];
		let cur: string | null;
		let after: string[];
		if (i < 0) {
			before = [];
			cur = null;
			after = [...slugs];
		} else {
			before = [...slugs.slice(0, i)];
			cur = slugs[i];
			after = [...slugs.slice(i + 1)];
		}
		const items: { slug: string; kind: "before" | "current" | "after" }[] = [
			...before.map((s) => ({ slug: s, kind: "before" as const })),
			...(cur ? [{ slug: cur, kind: "current" as const }] : []),
			...after.map((s) => ({ slug: s, kind: "after" as const })),
		];
		queueList.innerHTML = "";
		for (const it of items) {
			const li = document.createElement("li");
			li.className = "listen-queue-li";
			li.dataset.slug = it.slug;
			li.draggable = true;

			const btn = document.createElement("button");
			btn.type = "button";
			btn.className = `listen-queue-item is-${it.kind}`;
			btn.dataset.slug = it.slug;
			btn.setAttribute("role", "option");
			btn.setAttribute("aria-selected", it.kind === "current" ? "true" : "false");

			const fullTitle = titleFor(it.slug, it.slug);

			const grip = document.createElement("span");
			grip.className = "listen-queue-item-grip";
			grip.setAttribute("aria-hidden", "true");
			grip.textContent = "⋮⋮";
			btn.appendChild(grip);

			const idEl = document.createElement("span");
			idEl.className = "listen-queue-item-id";
			idEl.textContent = formatDisplayId(it.slug);
			const titleEl = document.createElement("span");
			titleEl.className = "listen-queue-item-title";
			titleEl.textContent = fullTitle;
			const markerEl = document.createElement("span");
			markerEl.className = "listen-queue-item-meta";
			renderQueueItemMeta(markerEl, it.kind, durationFor(it.slug));
			btn.appendChild(idEl);
			btn.appendChild(titleEl);
			btn.appendChild(markerEl);
			btn.addEventListener("click", () => {
				clearTransitionState();
				closeQueueDrawer();
				if (it.kind === "current") return;
				void advanceTo(it.slug, {
					autoplayAfterLoad: true,
					reason: "queue",
					description: null,
				});
			});
			li.appendChild(btn);
			queueList.appendChild(li);
		}
		wireReorderHandlers();
		updateQueueStats(slugs);
		if (queueResetBtn) queueResetBtn.hidden = !hasCustomOrder();
		hydrateQueueMetadata();
		anchorQueueCurrentNearTop();
	}

	function anchorQueueCurrentNearTop(): void {
		if (!queueList) return;
		const currentRow = queueList.querySelector<HTMLLIElement>(`.listen-queue-li[data-slug="${current.slug}"]`);
		if (currentRow) {
			const rowH = currentRow.getBoundingClientRect().height || 44;
			queueList.scrollTop = Math.max(0, currentRow.offsetTop - rowH * QUEUE_CURRENT_VISIBLE_OFFSET_N);
		} else {
			queueList.scrollTop = 0;
		}
	}

	/**
	 * Header summary: "<N tracks · total runtime>" for the current queue
	 * (playlist or global). Only counts slugs whose duration is known.
	 */
	function updateQueueStats(slugs: readonly string[]): void {
		const statsEl = document.getElementById("listen-queue-stats");
		if (!statsEl) return;
		let totalSec = 0;
		let knownCount = 0;
		for (const s of slugs) {
			const d = durationFor(s);
			if (typeof d === "number") {
				totalSec += d;
				knownCount += 1;
			}
		}
		const trackLabel = `${slugs.length} ${slugs.length === 1 ? "track" : "tracks"}`;
		if (knownCount === 0) {
			statsEl.textContent = trackLabel;
		} else {
			statsEl.textContent = `${trackLabel} · ${formatDurationShort(totalSec)}`;
		}
	}

	/**
	 * HTML5 drag-and-drop reorder for the visible window. On drop we:
	 *   1. Mutate the on-screen order optimistically.
	 *   2. Compute the new effective order (window items in their new
	 *      relative positions, slotted back into the surrounding effective
	 *      order around them) and persist to localStorage.
	 * Out-of-window items are untouched — the user reorders within what they
	 * can see, which is consistent with YouTube/Spotify drawer behavior.
	 */
	function wireReorderHandlers(): void {
		if (!queueList) return;
		let dragSlug: string | null = null;
		queueList.addEventListener("dragstart", (e) => {
			const li = (e.target as HTMLElement).closest<HTMLLIElement>(".listen-queue-li");
			if (!li || !li.dataset.slug) return;
			dragSlug = li.dataset.slug;
			li.classList.add("is-dragging");
			try {
				e.dataTransfer?.setData("text/plain", dragSlug);
				if (e.dataTransfer) e.dataTransfer.effectAllowed = "move";
			} catch {}
		});
		queueList.addEventListener("dragend", () => {
			queueList!.querySelectorAll(".is-dragging").forEach((el) => el.classList.remove("is-dragging"));
			dragSlug = null;
		});
		queueList.addEventListener("dragover", (e) => {
			if (!dragSlug) return;
			e.preventDefault();
			const li = (e.target as HTMLElement).closest<HTMLLIElement>(".listen-queue-li");
			if (!li || li.dataset.slug === dragSlug) return;
			const fromLi = queueList!.querySelector<HTMLLIElement>(`.listen-queue-li[data-slug="${dragSlug}"]`);
			if (!fromLi) return;
			const rect = li.getBoundingClientRect();
			const before = (e.clientY - rect.top) < rect.height / 2;
			queueList!.insertBefore(fromLi, before ? li : li.nextSibling);
		});
		queueList.addEventListener("drop", (e) => {
			if (!dragSlug) return;
			e.preventDefault();
			persistVisibleOrder();
			// Reorder may have changed the immediate next/prev — refresh
			// the footer chip label ("Up next · …") and the prev/next
			// neighbours used by Next/Prev buttons & end-of-track autoplay.
			refreshNeighbours(current.slug);
			setQueueLabel();
			if (queueResetBtn) queueResetBtn.hidden = !hasCustomOrder();
		});
	}

	function persistVisibleOrder(): void {
		if (!queueList) return;
		const visible: string[] = [];
		for (const li of queueList.querySelectorAll<HTMLLIElement>(".listen-queue-li")) {
			if (li.dataset.slug) visible.push(li.dataset.slug);
		}
		const visibleSet = new Set(visible);
		const fullOrder = effectiveSlugs().slice();
		const merged: string[] = [];
		const visibleIter = visible[Symbol.iterator]();
		for (const s of fullOrder) {
			if (visibleSet.has(s)) {
				const next = visibleIter.next();
				if (!next.done) merged.push(next.value);
			} else {
				merged.push(s);
			}
		}
		saveCustomOrder(currentQueueKey(), merged);
	}

	function openQueueDrawer(): void {
		if (!queueDrawer || !queueScrim) return;
		renderQueue();
		queueScrim.hidden = false;
		queueDrawer.hidden = false;
		// Force reflow so the transition runs from the initial transformed state.
		void queueDrawer.offsetHeight;
		queueScrim.classList.add("is-open");
		queueDrawer.classList.add("is-open");
		queueDrawer.setAttribute("aria-hidden", "false");
		queueScrim.setAttribute("aria-hidden", "false");
		window.requestAnimationFrame(() => {
			anchorQueueCurrentNearTop();
			focusQueueItem(0);
		});
	}

	function closeQueueDrawer(): void {
		if (!queueDrawer || !queueScrim) return;
		queueScrim.classList.remove("is-open");
		queueDrawer.classList.remove("is-open");
		queueDrawer.setAttribute("aria-hidden", "true");
		queueScrim.setAttribute("aria-hidden", "true");
		// After transition ends, fully hide so it's not in tab order.
		const onEnd = (): void => {
			if (!queueDrawer.classList.contains("is-open")) {
				queueDrawer.hidden = true;
				queueScrim.hidden = true;
			}
			queueDrawer.removeEventListener("transitionend", onEnd);
		};
		queueDrawer.addEventListener("transitionend", onEnd);
	}

	function activateQueueReset(event?: Event): void {
		event?.preventDefault();
		event?.stopPropagation();
		resetQueueOrder();
	}

	function getQueueItemButtons(): HTMLButtonElement[] {
		if (!queueList) return [];
		return Array.from(
			queueList.querySelectorAll<HTMLButtonElement>(".listen-queue-item"),
		);
	}

	function focusQueueItem(delta: -1 | 1 | 0): void {
		const buttons = getQueueItemButtons();
		if (!buttons.length) return;
		const active = document.activeElement as HTMLElement | null;
		const currentIndex = buttons.findIndex((button) => button === active);
		if (delta === 0) {
			const preferred =
				buttons.find((button) => button.classList.contains("is-current")) ??
				buttons.find((button) => !button.classList.contains("is-current")) ??
				buttons[0];
			preferred.focus();
			return;
		}
		const anchor = currentIndex >= 0 ? currentIndex : 0;
		const nextIndex = Math.max(0, Math.min(buttons.length - 1, anchor + delta));
		const target = buttons[nextIndex];
		target.focus();
		target.scrollIntoView({ block: "nearest" });
	}

	queueScrim?.addEventListener("click", closeQueueDrawer);
	queueCloseBtn?.addEventListener("click", closeQueueDrawer);
	queueResetBtn?.addEventListener("click", activateQueueReset);
	queueResetBtn?.addEventListener("pointerup", (event) => {
		if ((event as PointerEvent).pointerType === "touch") activateQueueReset(event);
	});

	// ── Speed control ───────────────────────────────────────────────────
	function applySpeed(): void {
		try { audio.playbackRate = speed; } catch {}
		if (speedLabel) speedLabel.textContent = formatSpeedLabel(speed);
	}

	function stepSpeed(direction: -1 | 1): void {
		const idx = SPEED_RATES.findIndex((r) => Math.abs(r - speed) < 0.01);
		const next = Math.min(SPEED_RATES.length - 1, Math.max(0, idx + direction));
		if (next === idx) return;
		speed = SPEED_RATES[next];
		saveSpeed(speed);
		applySpeed();
	}

	/** Cycle through SPEED_RATES, wrapping at the end. */
	function cycleSpeed(): void {
		const idx = SPEED_RATES.findIndex((r) => Math.abs(r - speed) < 0.01);
		const next = (idx + 1) % SPEED_RATES.length;
		speed = SPEED_RATES[next];
		saveSpeed(speed);
		applySpeed();
	}

	applySpeed();
	speedCycleBtn?.addEventListener("click", cycleSpeed);

	// ── Keyboard shortcuts (mirrors voice mode) ─────────────────────────
	document.addEventListener("keydown", (e) => {
		const active = document.activeElement as HTMLElement | null;
		const tag = active?.tagName.toLowerCase();
		const isRange = tag === "input" && (active as HTMLInputElement)?.type === "range";
		const isInputFocused =
			!isRange &&
			(tag === "input" || tag === "textarea" || tag === "select" || active?.isContentEditable);
		if (isInputFocused) return;
		if (e.ctrlKey || e.metaKey || e.altKey) return;
			const queueOpen = !!(
				queueDrawer &&
				!queueDrawer.hidden &&
				queueDrawer.classList.contains("is-open")
			);

		if (transitionState && (e.key === " " || e.key === "Enter")) {
			e.preventDefault();
			(document.getElementById("listen-track-pulse-play-now") as HTMLButtonElement | null)?.click();
			return;
		}

			if ((e.key === "Q" || e.key === "q") && e.shiftKey) {
				e.preventDefault();
				if (queueDrawer && queueScrim && queueList) {
					if (!queueOpen) openQueueDrawer();
					else focusQueueItem(0);
				}
				return;
			}

			if (
				queueOpen &&
				queueDrawer?.contains(active) &&
				(e.key === "ArrowDown" || e.key === "ArrowUp")
			) {
				e.preventDefault();
				focusQueueItem(e.key === "ArrowDown" ? 1 : -1);
				return;
			}

		if (e.key === " ") {
			e.preventDefault();
			paragraphPlaybackMode = "continuous";
			pauseAfterParagraphIdx = -1;
			if (audio.paused) {
				audio.play().catch(() => {});
			} else {
				audio.pause();
			}
			return;
		}
		if (e.key === "ArrowLeft" && !isRange) {
			e.preventDefault();
			void onPrev();
			return;
		}
		if (e.key === "ArrowRight" && !isRange) {
			e.preventDefault();
			void onNext();
			return;
		}
		if (e.key === "[") {
			e.preventDefault();
			void advanceDiscourse(-1);
			return;
		}
		if (e.key === "]") {
			e.preventDefault();
			void advanceDiscourse(1);
			return;
		}
		if (e.key === "Escape") {
			e.preventDefault();
			// If a transition modal is showing, Esc cancels it only (stays in listen mode).
			if (transitionState) {
				clearTransitionState();
				return;
			}
			// If the queue drawer is open, Esc closes it first; otherwise exits.
			if (queueDrawer && !queueDrawer.hidden && queueDrawer.classList.contains("is-open")) {
				closeQueueDrawer();
				return;
			}
			window.location.assign(`/${current.slug}`);
			return;
		}
		if (e.key === "+" || e.key === "=") {
			e.preventDefault();
			stepSpeed(1);
			return;
		}
		if (e.key === "-" || e.key === "_") {
			e.preventDefault();
			stepSpeed(-1);
			return;
		}
	});

	// ── Audio events ────────────────────────────────────────────────────
	audio.addEventListener("play", () => setPlayIcon(true));
	audio.addEventListener("pause", () => setPlayIcon(false));
	audio.addEventListener("ended", () => {
		pauseAfterParagraphIdx = -1;
		setPlayIcon(false);
		if (autoplay && neighbours.next) {
			if (document.visibilityState !== "visible") {
				void advanceTo(neighbours.next.slug, {
					autoplayAfterLoad: true,
					reason: "autoplay-end",
					description: neighbours.next.description,
					showPulse: false,
				});
			} else {
				void beginAutoplayTransition(neighbours.next);
			}
		}
	});
	document.addEventListener("visibilitychange", () => {
		if (document.visibilityState === "visible") return;
		transitionState?.playNow?.();
	});
	audio.addEventListener("loadedmetadata", () => {
		if (tTot) tTot.textContent = formatTime(audio.duration);
	});

	let lastSavedAt = 0;
	audio.addEventListener("timeupdate", () => {
		checkSingleParagraphPause();
		if (audio.duration) {
			const pct = (audio.currentTime / audio.duration) * 100;
			if (!seek.matches(":active")) seek.value = String(pct);
		}
		if (tCur) tCur.textContent = formatTime(audio.currentTime);
		// Paragraph tracking
		const idx = findParagraphIdxAt(audio.currentTime);
		if (idx !== activeParaIdx) {
			activeParaIdx = idx;
			activeWordIdx = -1;
			highlightParagraph(idx);
		}
		// Per-word tracking within the active paragraph.
		if (idx >= 0) {
			const wIdx = findWordIdxAt(idx, audio.currentTime);
			if (wIdx !== activeWordIdx) {
				activeWordIdx = wIdx;
				highlightWord(idx, wIdx);
			}
		}
		// Resume save (every ~5s) — both the cold-boot LS slot and the
		// in-session per-slug map (so browser back resumes correctly).
		if (performance.now() - lastSavedAt > 5000) {
			lastSavedAt = performance.now();
			saveResume(current.slug, audio.currentTime);
			rememberPosition(current.slug, audio.currentTime, audio.duration ?? null);
		}
		drawWaveformCanvas();
	});

	// ── Boot ────────────────────────────────────────────────────────────
	bindMediaSessionActions();
	renderQueueTitle();
	setQueueLabel();
	applyAutoplayUi();
	applyScrubberCollapsed();
	applyScrollUnlock();
	// Seed history state on the initial entry so popstate can detect when the
	// user navigates back to it (vs a separate site entry).
	history.replaceState({ listen: true, slug: current.slug }, "", location.pathname + location.search);
	// Browser back → if returning to another in-listen-mode entry, swap the
	// track in place (no full reload). Falls through to the default browser
	// behaviour (full navigation) when the entry is not a listen entry.
	window.addEventListener("popstate", (e) => {
		const st = e.state as { listen?: boolean; slug?: string } | null;
		const pathSlug = location.pathname.replace(/^\/listen\//, "");
		if (st?.listen && pathSlug && pathSlug !== current.slug) {
			clearTransitionState();
			// Save outgoing position so a forward-nav back to it later resumes too.
			rememberPosition(current.slug, audio.currentTime, audio.duration ?? null);
			const wasPlaying = !audio.paused;
			// Re-resolve playlist context from the URL we are returning to.
			try {
				const id = new URLSearchParams(location.search).get("pl");
				const p = getPlaylist(id);
				playlist = p && p.slugs.includes(pathSlug) ? p : null;
				if (p && !p.slugs.includes(pathSlug)) stripPlFromUrl();
			} catch {
				playlist = null;
			}
			renderQueueTitle();
			refreshNeighbours(pathSlug);
			setQueueLabel();
			showTrackPulse({
				displayId: formatDisplayId(pathSlug),
				title: titleFor(pathSlug, pathSlug),
				description: null,
			});
			const resumeAt = sessionPositions.get(pathSlug);
			void loadTrack(pathSlug, {
				autoplayAfterLoad: wasPlaying,
				resumeAt,
				description: null,
			});
			if (queueDrawer && !queueDrawer.hidden) renderQueue();
		}
	});
	setQueueLabel();
	const resumeAt = loadResume(current.slug) ?? undefined;
	// Titles map is bundled (audioTitles.generated.ts), so we can refresh
	// header + neighbours synchronously — no fetch round-trip.
	if (audioTitles[current.slug]) {
		current.title = audioTitles[current.slug];
		renderHeader();
		setMediaSessionMetadata();
	}
	refreshNeighbours(current.slug);
	setQueueLabel();
	void loadTrack(current.slug, {
		autoplayAfterLoad: false,
		resumeAt,
		description: current.description,
	});
}
