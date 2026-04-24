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
	nextDisplayId: string | null;
	prevSlug: string | null;
	prevTitle: string | null;
	prevDisplayId: string | null;
};

const LS_AUTOPLAY = "listen:autoplay";
const LS_RESUME = "listen:resume";
const LS_SPEED = "listen:speed";
const RESUME_TTL_MS = 24 * 60 * 60 * 1000;
const PREV_RESTART_THRESHOLD_S = 3;

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

function formatSpeedLabel(rate: number): string {
	// "1×", "1.25×", "0.75×" — strip trailing zeros only when already showing decimals.
	const s = rate.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
	return `${s}×`;
}

function titleFor(slug: string, fallback: string): string {
	return audioTitles[slug] ?? fallback;
}

type TrackMeta = {
	slug: string;
	title: string;
	displayId: string;
	description: string | null;
};

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
	// Words from the manifest carry punctuation in-token (e.g. "Bhikkhus,").
	// Pure-punctuation tokens (rare) don't get a leading space.
	const isPunctOnly = (s: string): boolean => /^[,.;:!?]+$/.test(s);
	// Only honour `lineSizes` when the count matches (paragraph endpoint may
	// drift from manifest tokenization on edge cases — fall back to flat).
	const useLines =
		!!lineSizes &&
		lineSizes.length > 1 &&
		lineSizes.reduce((a, b) => a + b, 0) === words.length;
	let nextBreakAt = useLines ? lineSizes![0] : -1;
	let lineCursor = 0;
	for (let i = 0; i < words.length; i++) {
		const w = words[i];
		if (i === nextBreakAt) {
			parent.appendChild(document.createElement("br"));
			lineCursor++;
			nextBreakAt += lineSizes![lineCursor];
		} else if (i > 0 && !isPunctOnly(w.w)) {
			parent.appendChild(document.createTextNode(" "));
		}
		const span = document.createElement("span");
		span.className = "listen-word";
		span.dataset.w = String(i);
		span.textContent = w.w;
		parent.appendChild(span);
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
	const tCur = document.getElementById("listen-time-current");
	const tTot = document.getElementById("listen-time-total");
	const titleEl = document.getElementById("listen-title");
	const displayIdEl = document.getElementById("listen-display-id");
	const stage = document.querySelector<HTMLElement>(".listen-stage");
	const autoplayToggle = document.getElementById(
		"listen-autoplay-toggle",
	) as HTMLInputElement | null;
	const queueLabel = document.getElementById("listen-queue-label");
	const queueChip = document.getElementById("listen-queue-chip");
	const modeSwitch = document.getElementById(
		"listen-mode-switch",
	) as HTMLAnchorElement | null;
	const speedCycleBtn = document.getElementById(
		"listen-speed-cycle",
	) as HTMLButtonElement | null;
	const speedLabel = document.getElementById("listen-speed-label");
	const collapseBtn = document.getElementById(
		"listen-collapse-btn",
	) as HTMLButtonElement | null;
	const transportEl = document.querySelector<HTMLElement>(".listen-transport");
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

	let current: TrackMeta = {
		slug: initial.slug,
		title: initial.title,
		displayId: initial.displayId,
		description: initial.description,
	};
	let manifest: VoiceManifest | null = null;
	let activeParaIdx = -1;
	let activeWordIdx = -1;
	let autoplay = loadAutoplay();
	let speed = loadSpeed();
	if (autoplayToggle) autoplayToggle.checked = autoplay;

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
				displayId: initial.nextDisplayId ?? formatDisplayId(initial.nextSlug),
			}
			: null,
		prev: initial.prevSlug
			? {
				slug: initial.prevSlug,
				title: initial.prevTitle ?? initial.prevSlug,
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
				? { slug: ns, title: titleFor(ns, ns), displayId: formatDisplayId(ns) }
				: null,
			prev: ps
				? { slug: ps, title: titleFor(ps, ps), displayId: formatDisplayId(ps) }
				: null,
		};
	}

	function setQueueLabel(): void {
		if (!queueLabel) return;
		// Autoplay off → there is no "next" in the playback sense, so the chip
		// becomes a manual browse affordance (still opens the same drawer).
		if (!autoplay) {
			queueLabel.textContent = "Browse";
			queueChip?.setAttribute("title", "Browse queue");
			queueChip?.setAttribute("aria-label", "Browse queue");
			queueChip?.removeAttribute("disabled");
			return;
		}
		if (neighbours.next) {
			queueLabel.textContent = `Up next · ${neighbours.next.displayId}`;
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
		playBtn?.setAttribute("aria-label", playing ? "Pause" : "Play");
	}

	function renderHeader(): void {
		if (titleEl) titleEl.textContent = current.title;
		if (displayIdEl) displayIdEl.textContent = current.displayId;
		document.title = `Listen · ${current.displayId} ${current.title}`;
		if (modeSwitch) modeSwitch.href = `/${current.slug}${playlistQuery()}`;
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
		for (const p of m.paragraphs) {
			const el = document.createElement("p");
			el.className = "listen-paragraph";
			el.dataset.paraId = String(p.id);
			el.dataset.paragraphNumber = String(p.id);
			const lineSizes = p.lineSizes && p.lineSizes.length > 1 ? p.lineSizes : undefined;
			if (lineSizes) {
				el.classList.add("listen-paragraph--verse");
			}
			renderWordSpans(el, p.words, lineSizes);
			stage.appendChild(el);
		}
		activeParaIdx = -1;
		activeWordIdx = -1;
		stage.scrollTop = 0;
	}

	function highlightParagraph(idx: number): void {
		if (!stage) return;
		const all = stage.querySelectorAll(".listen-paragraph");
		all.forEach((el, i) => {
			el.classList.toggle("is-active", i === idx);
		});
		const active = all[idx];
		if (active instanceof HTMLElement) {
			active.scrollIntoView({ behavior: "smooth", block: "center" });
		}
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

		// Keep the active word in view. Two complications:
		//   1. .listen-transport is `position: sticky; bottom: 0` *inside* the
		//      stage scroll container, so it overlays the bottom of the visible
		//      area — words behind it are visually hidden even though they're
		//      within stage.getBoundingClientRect().
		//   2. Word changes fire on timeupdate, not on every layout reflow, so
		//      we must check on every word change (not only paragraph change).
		// Solution: subtract the transport's height from the safe bottom edge,
		// add a small line-height buffer at the top.
		const transport = document.querySelector(".listen-transport");
		const transportH =
			transport instanceof HTMLElement ? transport.getBoundingClientRect().height : 0;
		const stageRect = stage.getBoundingClientRect();
		const wordRect = span.getBoundingClientRect();
		const topMargin = Math.max(48, wordRect.height * 1.5);
		const bottomMargin = transportH + Math.max(24, wordRect.height);
		const hiddenBelow = wordRect.bottom > stageRect.bottom - bottomMargin;
		const hiddenAbove = wordRect.top < stageRect.top + topMargin;
		if (hiddenBelow || hiddenAbove) {
			// scrollIntoView on the span uses { block: "center" } against the
			// nearest scroll ancestor (= stage). That centers the word in the
			// raw stage rect, which is *above* the transport bar — so add a
			// follow-up nudge to push it clear of the transport when it lands
			// in the bottom half.
			span.scrollIntoView({ behavior: "smooth", block: "center" });
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
		opts: { autoplayAfterLoad: boolean; resumeAt?: number },
	): Promise<void> {
		// Update header optimistically. Title source priority:
		//   1. audioTitles bundled map (build-time slug → title)
		//   2. neighbours map (build-time prev/next)
		//   3. manifest.title (Phase 1 schema extension — may override later)
		//   4. slug (last-resort fallback)
		current = { ...current, slug };
		current.displayId = formatDisplayId(slug);
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
		if (m.slug) current.slug = m.slug;
		renderHeader();
		setMediaSessionMetadata();
		renderParagraphs(m);

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

	async function advanceTo(slug: string): Promise<void> {
		// Capture the OUTGOING position so a later browser-back lands the
		// listener back where they were, not at 0.
		rememberPosition(current.slug, audio.currentTime, audio.duration ?? null);
		refreshNeighbours(slug);
		setQueueLabel();
		// Push a new history entry so the browser back button returns to the
		// previous discourse (in-listen-mode navigation). The state object lets
		// us distinguish our own entries from external navigations in popstate.
		history.pushState({ listen: true, slug }, "", `/listen/${slug}${playlistQuery()}`);
		showTrackPulse(formatDisplayId(slug), titleFor(slug, slug));
		const resumeAt = sessionPositions.get(slug);
		await loadTrack(slug, { autoplayAfterLoad: true, resumeAt });
		// Refresh drawer contents if it happens to be open.
		if (queueDrawer && !queueDrawer.hidden) renderQueue();
	}

	/**
	 * Brief overlay announcing the new track. Triggered on `advanceTo` (queue
	 * tap, autoplay, prev/next-discourse). Auto-dismisses; respects
	 * prefers-reduced-motion via CSS.
	 */
	let pulseTimer: number | null = null;
	function showTrackPulse(displayId: string, title: string): void {
		const el = document.getElementById("listen-track-pulse");
		const idEl = document.getElementById("listen-track-pulse-id");
		const titleEl = document.getElementById("listen-track-pulse-title");
		if (!el || !idEl || !titleEl) return;
		idEl.textContent = displayId;
		titleEl.textContent = title;
		el.setAttribute("aria-hidden", "false");
		el.classList.add("is-visible");
		if (pulseTimer !== null) clearTimeout(pulseTimer);
		pulseTimer = window.setTimeout(() => {
			el.classList.remove("is-visible");
			el.setAttribute("aria-hidden", "true");
			pulseTimer = null;
		}, 1800);
	}

	async function onNext(): Promise<void> {
		if (!manifest) return;
		// Within-track: jump to next paragraph if available.
		const i = activeParaIdx >= 0 ? activeParaIdx : findParagraphIdxAt(audio.currentTime);
		if (i + 1 < manifest.paragraphs.length) {
			audio.currentTime = manifest.paragraphs[i + 1].start;
			if (audio.paused) {
				try { await audio.play(); } catch {}
			}
			return;
		}
		// At end → next discourse if autoplay on.
		if (autoplay && neighbours.next) {
			await advanceTo(neighbours.next.slug);
		}
	}

	async function onPrev(): Promise<void> {
		if (!manifest) return;
		const i = activeParaIdx >= 0 ? activeParaIdx : findParagraphIdxAt(audio.currentTime);
		const para = manifest.paragraphs[i];
		const offsetIntoPara = para ? audio.currentTime - para.start : 0;
		// >3s in: restart current paragraph (YT semantics).
		if (offsetIntoPara > PREV_RESTART_THRESHOLD_S) {
			audio.currentTime = para.start;
			if (audio.paused) { try { await audio.play(); } catch {} }
			return;
		}
		if (i > 0) {
			audio.currentTime = manifest.paragraphs[i - 1].start;
			if (audio.paused) { try { await audio.play(); } catch {} }
			return;
		}
		// First paragraph + ≤3s + autoplay on → previous discourse, paragraph 1.
		if (autoplay && neighbours.prev) {
			await advanceTo(neighbours.prev.slug);
		}
	}

	// ── Wire DOM events ─────────────────────────────────────────────────
	playBtn.addEventListener("click", () => {
		if (audio.paused) {
			audio.play().catch((e) => console.warn("listen-mode: play() denied", e));
		} else {
			audio.pause();
		}
	});
	nextBtn.addEventListener("click", () => void onNext());
	prevBtn.addEventListener("click", () => void onPrev());

	seek.addEventListener("input", () => {
		const pct = Number(seek.value);
		if (!Number.isFinite(pct) || !audio.duration) return;
		audio.currentTime = (pct / 100) * audio.duration;
	});

	autoplayToggle?.addEventListener("change", () => {
		autoplay = !!autoplayToggle.checked;
		saveAutoplay(autoplay);
		setQueueLabel();
	});

	queueChip?.addEventListener("click", () => {
		// Phase 2.4: tapping the queue chip opens the queue drawer.
		// Falls back to direct-advance only when there's nothing to show.
		if (queueDrawer && queueScrim && queueList) {
			openQueueDrawer();
		} else if (neighbours.next) {
			void advanceTo(neighbours.next.slug);
		}
	});

	// ── Queue drawer (Phase 2.4) ────────────────────────────────────────
	// We show the current track at slot ~3 from the top so the user sees a
	// few "before" rows for context, and the bulk of the visible drawer is
	// dedicated to upcoming tracks. The drawer is scrollable, so the
	// "after" window can be generous.
	const QUEUE_BEFORE_N = 3;
	const QUEUE_AFTER_N = 47;

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
			after = [...slugs.slice(0, QUEUE_BEFORE_N + QUEUE_AFTER_N + 1)];
		} else {
			before = [...slugs.slice(Math.max(0, i - QUEUE_BEFORE_N), i)];
			cur = slugs[i];
			after = [...slugs.slice(i + 1, i + 1 + QUEUE_AFTER_N)];
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
			markerEl.className = "listen-queue-item-marker";
			// Show "Now" for the current row; otherwise show the
			// per-discourse duration if known. Both occupy the same slot
			// so layout stays consistent.
			const dur = audioDurations[it.slug];
			if (it.kind === "current") {
				markerEl.textContent = "Now";
			} else if (typeof dur === "number") {
				markerEl.textContent = formatDurationShort(dur);
				markerEl.classList.add("listen-queue-item-marker--duration");
			} else {
				markerEl.textContent = "";
			}
			btn.appendChild(idEl);
			btn.appendChild(titleEl);
			btn.appendChild(markerEl);
			btn.addEventListener("click", () => {
				closeQueueDrawer();
				if (it.kind === "current") return;
				void advanceTo(it.slug);
			});
			li.appendChild(btn);
			queueList.appendChild(li);
		}
		wireReorderHandlers();
		updateQueueStats(slugs);
		if (queueResetBtn) queueResetBtn.hidden = !hasCustomOrder();
		// Scroll the current item to the top of the drawer (it's already
		// near the top per QUEUE_BEFORE_N=3, but reset scroll explicitly so
		// re-opens always start at the same anchor).
		queueList.scrollTop = 0;
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
			const d = audioDurations[s];
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

	queueScrim?.addEventListener("click", closeQueueDrawer);
	queueCloseBtn?.addEventListener("click", closeQueueDrawer);
	queueResetBtn?.addEventListener("click", resetQueueOrder);

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

	// ── Collapse toggle (hides the options row) ─────────────────────────
	collapseBtn?.addEventListener("click", () => {
		const collapsed = transportEl?.classList.toggle("is-collapsed");
		const expanded = !collapsed;
		collapseBtn.setAttribute("aria-expanded", expanded ? "true" : "false");
		collapseBtn.setAttribute(
			"aria-label",
			expanded ? "Collapse extra controls" : "Show extra controls",
		);
		collapseBtn.setAttribute(
			"title",
			expanded ? "Collapse extra controls" : "Show extra controls",
		);
	});

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

		if (e.key === " ") {
			e.preventDefault();
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
		if (e.key === "Escape") {
			e.preventDefault();
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
		setPlayIcon(false);
		if (autoplay && neighbours.next) {
			void advanceTo(neighbours.next.slug);
		}
	});
	audio.addEventListener("loadedmetadata", () => {
		if (tTot) tTot.textContent = formatTime(audio.duration);
	});

	let lastSavedAt = 0;
	audio.addEventListener("timeupdate", () => {
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
	});

	// ── Boot ────────────────────────────────────────────────────────────
	bindMediaSessionActions();
	renderQueueTitle();
	setQueueLabel();
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
			showTrackPulse(formatDisplayId(pathSlug), titleFor(pathSlug, pathSlug));
			const resumeAt = sessionPositions.get(pathSlug);
			void loadTrack(pathSlug, { autoplayAfterLoad: wasPlaying, resumeAt });
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
	void loadTrack(current.slug, { autoplayAfterLoad: false, resumeAt });
}
