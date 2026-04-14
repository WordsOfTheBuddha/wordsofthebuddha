/**
 * Voice mode client: manifest sync, word highlights, localStorage, immersive UI.
 */

export type VoiceWord = { w: string; s: number; e: number };
export type VoiceParagraph = {
	id: number;
	start: number;
	end: number;
	words: VoiceWord[];
};
export type VoiceManifest = {
	version: number;
	textHash: string;
	audioHash?: string | null;
	voice: string;
	generatedAt: string | null;
	duration: number | null;
	paragraphs: VoiceParagraph[];
};

function isValidVoiceManifest(v: unknown): v is VoiceManifest {
	if (!v || typeof v !== "object") return false;
	const m = v as Record<string, unknown>;
	if (typeof m.version !== "number") return false;
	if (!Array.isArray(m.paragraphs) || m.paragraphs.length === 0) return false;
	return true;
}

/** Base URL for `{base}.manifest.json` and `{base}.webm` (no file suffix). */
function voiceAudioBase(discourseId: string): string {
	const audioRoot = import.meta.env.PUBLIC_AUDIO_BASE_URL as string | undefined;
	return audioRoot
		? `${audioRoot.replace(/\/$/, "")}/${encodeURIComponent(discourseId)}`
		: `/audio/${encodeURIComponent(discourseId)}`;
}

/**
 * Single GET manifest + validate + HEAD .webm. Deduplicates concurrent callers
 * (e.g. safety-net probe shares work with voice init).
 */
const voiceManifestLoadBySlug = new Map<string, Promise<VoiceManifest | null>>();

export function loadVoiceManifestForDiscourse(
	discourseId: string,
): Promise<VoiceManifest | null> {
	const hit = voiceManifestLoadBySlug.get(discourseId);
	if (hit) return hit;
	const base = voiceAudioBase(discourseId);
	const p = (async (): Promise<VoiceManifest | null> => {
		try {
			// Default cache: manifest path is stable per slug; .webm uses ?h= cache bust.
			const res = await fetch(`${base}.manifest.json`);
			if (!res.ok) return null;
			const data: unknown = await res.json();
			if (!isValidVoiceManifest(data)) return null;
			const audioUrl = `${base}.webm`;
			if (!(await audioAssetExists(audioUrl))) return null;
			return data;
		} catch {
			return null;
		}
	})();
	voiceManifestLoadBySlug.set(discourseId, p);
	return p;
}

/** Ensure the audio file exists (manifest alone is not enough). */
async function audioAssetExists(url: string): Promise<boolean> {
	let res = await fetch(url, { method: "HEAD" });
	if (res.ok) return true;
	if (res.status === 405) {
		res = await fetch(url, {
			headers: { Range: "bytes=0-0" },
		});
		return res.ok || res.status === 206;
	}
	return false;
}

/**
 * Stable slug URLs on R2 use long-lived immutable caching; regenerated audio must
 * not reuse the same cache entry as an older file. Query string busts CDN/browser
 * caches while the origin still serves `/{slug}.webm`.
 */
function voiceWebmUrl(base: string, m: VoiceManifest): string {
	// Prefer audioHash so immutable audio refreshes when the actual audio bytes change.
	// Fall back for older manifests that do not include audioHash.
	const h =
		(typeof m.audioHash === "string" && m.audioHash) ||
		(typeof m.textHash === "string" && m.textHash) ||
		(typeof m.generatedAt === "string" && m.generatedAt) ||
		`v${m.version}`;
	return `${base}.webm?h=${encodeURIComponent(h)}`;
}

const LS_PREFIX = "voice:";
/** Discrete speeds for the voice bar (+/−); browsers clamp `playbackRate` if unsupported. */
const VOICE_PLAYBACK_RATES = [0.75, 1, 1.25, 1.5] as const;
const PUNCT_ONLY = /^[.,;:!?'"''""\-–—)\]]+$/;
const LEADING_PUNCT = /^['"''"([\-–—]+$/;
const WRAPPED_ATTR = "data-voice-wrapped";

function normalizeForWordAlignment(text: string): string {
	return text
		.trim()
		.toLowerCase()
		.replace(/…/g, "...")
		.replace(/[‘’]/g, "'")
		.replace(/[“”]/g, '"');
}

function buildWordIndexMap(
	block: VoiceParagraph,
	spans: Element[],
): number[] {
	const map: number[] = new Array(block.words.length).fill(-1);
	const spanWords = spans.map((s) => normalizeForWordAlignment(s.textContent || ""));
	let j = 0;

	for (let i = 0; i < block.words.length; i++) {
		const target = normalizeForWordAlignment(block.words[i]?.w || "");
		if (!target) {
			map[i] = j < spanWords.length ? j : -1;
			continue;
		}

		while (j < spanWords.length && !spanWords[j]) j++;
		if (j >= spanWords.length) break;

		const cur = spanWords[j];
		if (cur === target) {
			map[i] = j;
			j += 1;
			continue;
		}

		const next = j + 1 < spanWords.length ? spanWords[j + 1] : "";
		if (next && `${cur}${next}` === target) {
			// Manifest has one token, DOM has split token (e.g. "restrained" + "...").
			map[i] = j;
			j += 2;
			continue;
		}

		// Fallback: keep progress moving to avoid freezing highlight on hard mismatches.
		map[i] = j;
		j += 1;
	}

	for (let i = 1; i < map.length; i++) {
		if (map[i] < 0) map[i] = map[i - 1];
	}
	if (map.length > 0 && map[0] < 0) map[0] = 0;

	return map;
}

function formatTime(sec: number): string {
	if (!Number.isFinite(sec) || sec < 0) return "0:00";
	const m = Math.floor(sec / 60);
	const s = Math.floor(sec % 60);
	return `${m}:${s.toString().padStart(2, "0")}`;
}

/** Detect which English article is currently visible based on CSS class state. */
function getVisibleEnglishArticle(): Element | null {
	const isSplit =
		document.documentElement.classList.contains("split") &&
		document.documentElement.classList.contains("pali-on");
	if (isSplit) {
		const p1 = document.getElementById("panel1");
		if (p1) return p1;
	}
	return (
		document.querySelector("article.interleaved-article") ||
		document.querySelector("article.md-content")
	);
}

function wrapVoiceWords(root: Element): void {
	// Mark superscript footnotes (e.g. ^[1]^) so the tree walker skips them
	root.querySelectorAll<HTMLElement>("sup").forEach((sup) => {
		sup.classList.add("voice-skip");
	});

	const tooltips = root.querySelectorAll<HTMLElement>(".tooltip-text");
	for (const tt of tooltips) {
		if (tt.closest(".collapse-toggle")) continue;
		const words = tt.textContent?.trim().split(/\s+/) || [];
		if (words.length <= 1) {
			tt.classList.add("voice-word");
			continue;
		}
		// Keep tooltip wrapper intact for continuous underline;
		// insert voice-word spans inside it.
		const frag = document.createDocumentFragment();
		words.forEach((w, i) => {
			if (i > 0) frag.appendChild(document.createTextNode(" "));
			const s = document.createElement("span");
			s.className = "voice-word";
			s.textContent = w;
			frag.appendChild(s);
		});
		tt.textContent = "";
		tt.appendChild(frag);
	}

	const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
		acceptNode(node) {
			if (!node.textContent?.trim()) return NodeFilter.FILTER_REJECT;
			if (node.parentElement?.classList.contains("voice-word"))
				return NodeFilter.FILTER_REJECT;
			if (node.parentElement?.closest(".voice-skip"))
				return NodeFilter.FILTER_REJECT;
			if (node.parentElement?.closest(".collapse-toggle"))
				return NodeFilter.FILTER_REJECT;
			return NodeFilter.FILTER_ACCEPT;
		},
	});
	const textNodes: Text[] = [];
	while (walker.nextNode()) {
		if (walker.currentNode.nodeType === Node.TEXT_NODE)
			textNodes.push(walker.currentNode as Text);
	}
	for (const node of textNodes) {
		const text = node.textContent;
		if (!text) continue;
		const frag = document.createDocumentFragment();
		const parts = text.split(/(\s+|—|\.{3}|…)/);
		for (const part of parts) {
			if (!part) continue;
			if (/^\s+$/.test(part)) frag.appendChild(document.createTextNode(part));
			else {
				const s = document.createElement("span");
				s.className = "voice-word";
				s.textContent = part;
				frag.appendChild(s);
			}
		}
		node.parentNode?.replaceChild(frag, node);
	}

	mergePunctuation(root);
}

function mergePunctuation(root: Element): void {
	const words = Array.from(root.querySelectorAll(".voice-word"));
	for (let i = words.length - 1; i >= 0; i--) {
		const el = words[i];
		const txt = el.textContent || "";
		if (!txt.trim()) continue;
		if (PUNCT_ONLY.test(txt) && txt !== "..." && txt !== "…") {
			const prev = i > 0 ? words[i - 1] : null;
			if (prev) {
				prev.textContent = (prev.textContent || "") + txt;
				removeNodePreservingWhitespace(el);
				words.splice(i, 1);
				continue;
			}
		}
		if (LEADING_PUNCT.test(txt)) {
			const next = i < words.length - 1 ? words[i + 1] : null;
			if (next) {
				next.textContent = txt + (next.textContent || "");
				removeNodePreservingWhitespace(el);
				words.splice(i, 1);
			}
		}
	}
}

function removeNodePreservingWhitespace(el: Element): void {
	const prev = el.previousSibling;
	const next = el.nextSibling;
	if (
		prev?.nodeType === Node.TEXT_NODE &&
		next?.nodeType === Node.TEXT_NODE &&
		/^\s+$/.test(prev.textContent || "") &&
		/^\s+$/.test(next.textContent || "")
	) {
		next.remove();
	}
	el.remove();
}

function clearWordHighlights(article: Element | null): void {
	article?.querySelectorAll(".voice-word-active").forEach((el) => {
		el.classList.remove("voice-word-active");
	});
}

function clearParagraphHighlights(article: Element | null): void {
	article?.querySelectorAll(".voice-paragraph-active").forEach((el) => {
		el.classList.remove("voice-paragraph-active");
	});
}

/** Bisect on start times: find last paragraph whose start <= t. */
function findParagraphIndexAtTime(m: VoiceManifest, t: number): number {
	const blocks = m.paragraphs;
	if (!blocks.length) return 0;
	let lo = 0;
	let hi = blocks.length;
	while (lo < hi) {
		const mid = (lo + hi) >> 1;
		if (blocks[mid].start <= t) lo = mid + 1;
		else hi = mid;
	}
	return Math.max(0, lo - 1);
}

/** Bisect on start times: find last word whose start <= t. */
function findWordIndexInParagraph(block: VoiceParagraph, t: number): number {
	const words = block.words;
	if (!words.length) return -1;
	let lo = 0;
	let hi = words.length;
	while (lo < hi) {
		const mid = (lo + hi) >> 1;
		if (words[mid].s <= t) lo = mid + 1;
		else hi = mid;
	}
	return Math.max(0, lo - 1);
}

function scrollIntoViewIfNeeded(target: Element, barEl: Element): void {
	const rect = target.getBoundingClientRect();
	const barRect = barEl.getBoundingClientRect();
	const viewBottom = barRect.top;
	const margin = 80;
	if (rect.top < margin || rect.bottom > viewBottom - margin) {
		// Avoid `smooth`: over long distances browsers can spend 10s+ animating one jump,
		// which matches toggling Focus or seeking deep into a discourse.
		target.scrollIntoView({ behavior: "auto", block: "center" });
	}
}

/** Check whether an element is fully within the visible viewport above the bar. */
function isInViewport(el: Element, barEl: Element): boolean {
	const rect = el.getBoundingClientRect();
	const barTop = barEl.getBoundingClientRect().top;
	return rect.top >= 0 && rect.bottom <= barTop;
}

function updateUrlParam(key: string, value: string | null): void {
	const u = new URL(location.href);
	if (value === null) {
		u.searchParams.delete(key);
	} else {
		u.searchParams.set(key, value);
	}
	history.replaceState(
		history.state,
		"",
		`${u.pathname}${u.search}${u.hash}`,
	);
}

function stripVoiceUrlIfNoAudio(): void {
	const v = new URLSearchParams(location.search).get("voice");
	if (v === "1" || v === "true") {
		updateUrlParam("voice", null);
		document.dispatchEvent(new CustomEvent("voiceParamChanged"));
	}
}

const PLAY_SVG = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.8" stroke="currentColor" width="16" height="16"><path stroke-linecap="round" stroke-linejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 0 1 0 1.972l-11.54 6.347a1.125 1.125 0 0 1-1.667-.986V5.653Z"/></svg>`;
const PLAY_PAUSE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.8" stroke="currentColor" width="16" height="16"><path stroke-linecap="round" stroke-linejoin="round" d="M21 7.5V18M15 7.5V18M3 16.811V8.69c0-.864.933-1.406 1.683-.977l7.108 4.061a1.125 1.125 0 0 1 0 1.954l-7.108 4.061A1.125 1.125 0 0 1 3 16.811Z"/></svg>`;

function injectParagraphPlayButtons(
	article: Element,
	onPlayFrom: (pNum: number) => void,
	onPlaySingle: (pNum: number) => void,
): void {
	article
		.querySelectorAll<HTMLElement>(
			"p.english-paragraph[data-paragraph-number]",
		)
		.forEach((p) => {
			if (p.querySelector(".voice-para-actions")) return;
			p.style.position = "relative";
			const wrap = document.createElement("span");
			wrap.className = "voice-para-actions";

			const btnSingle = document.createElement("button");
			btnSingle.type = "button";
			btnSingle.className = "voice-para-btn voice-para-single";
			btnSingle.setAttribute("aria-label", "Play this paragraph only");
			btnSingle.title = "Play this paragraph only";
			btnSingle.innerHTML = PLAY_PAUSE_SVG;

			const btnFrom = document.createElement("button");
			btnFrom.type = "button";
			btnFrom.className = "voice-para-btn voice-para-from";
			btnFrom.setAttribute("aria-label", "Play from here");
			btnFrom.title = "Play from here";
			btnFrom.innerHTML = PLAY_SVG;

			btnSingle.addEventListener("click", (e) => {
				e.stopPropagation();
				const pNum = Number(p.dataset.paragraphNumber);
				if (Number.isFinite(pNum)) onPlaySingle(pNum);
			});
			btnFrom.addEventListener("click", (e) => {
				e.stopPropagation();
				const pNum = Number(p.dataset.paragraphNumber);
				if (Number.isFinite(pNum)) onPlayFrom(pNum);
			});

			wrap.appendChild(btnSingle);
			wrap.appendChild(btnFrom);
			p.insertBefore(wrap, p.firstChild);
		});
}

function removeParagraphPlayButtons(article: Element | null): void {
	article?.querySelectorAll(".voice-para-actions").forEach((b) => b.remove());
}

export function initVoiceMode(
	discourseId: string,
	triggerBtn: HTMLElement,
): void {
	const audioEl = document.getElementById("voice-audio");
	const bar = document.getElementById("voice-bar");
	const playBtn = document.getElementById("voice-play");
	const prevBtn = document.getElementById("voice-prev");
	const nextBtn = document.getElementById("voice-next");
	const seek = document.getElementById(
		"voice-seek",
	) as HTMLInputElement | null;
	const timeEl = document.getElementById("voice-time");
	const speedDown = document.getElementById("voice-speed-down") as HTMLButtonElement | null;
	const speedLabel = document.getElementById("voice-speed-label") as HTMLSpanElement | null;
	const speedUp = document.getElementById("voice-speed-up") as HTMLButtonElement | null;
	const exitBtn = document.getElementById("voice-exit");
	const minimizeBtn = document.getElementById(
		"voice-minimize",
	) as HTMLButtonElement | null;
	const focusToggle = document.getElementById(
		"voice-focus-toggle",
	) as HTMLButtonElement | null;
	// Sequential guards; instanceof narrows for closure bodies (not only linear code).
	if (!(audioEl instanceof HTMLAudioElement)) return;
	const audio = audioEl;
	if (!bar) return;
	if (!playBtn) return;
	if (!prevBtn) return;
	if (!nextBtn) return;
	if (!seek) return;
	if (!timeEl) return;
	if (!exitBtn) return;

	const voiceBar = bar;
	const voiceSeek = seek;
	const voiceTimeEl = timeEl;

	/* ——— Debug overlay (activated via ?voicedebug=1) ——— */
	const VOICE_DEBUG = new URLSearchParams(location.search).get("voicedebug") === "1";
	let debugEl: HTMLElement | null = null;
	const debugLog: string[] = [];

	function initDebugOverlay(): void {
		if (!VOICE_DEBUG) return;
		debugEl = document.createElement("div");
		debugEl.id = "voice-debug-overlay";
		debugEl.style.cssText =
			"position:fixed;top:0;left:0;right:0;z-index:9999;max-height:45vh;" +
			"overflow-y:auto;background:rgba(0,0,0,0.88);color:#0f0;font:11px/1.4 monospace;" +
			"padding:6px 8px;pointer-events:auto;-webkit-overflow-scrolling:touch;" +
			"white-space:pre-wrap;word-break:break-all;";
		document.body.appendChild(debugEl);
	}

	function dbg(msg: string): void {
		if (!VOICE_DEBUG) return;
		const ts = (performance.now() / 1000).toFixed(2);
		const line = `[${ts}] ${msg}`;
		debugLog.push(line);
		if (debugLog.length > 80) debugLog.shift();
		if (debugEl) debugEl.textContent = debugLog.join("\n");
	}

	function dbgState(label: string): void {
		if (!VOICE_DEBUG) return;
		const b = audio.buffered;
		const ranges: string[] = [];
		for (let i = 0; i < b.length; i++) {
			ranges.push(`${b.start(i).toFixed(1)}-${b.end(i).toFixed(1)}`);
		}
		dbg(
			`${label} | t=${audio.currentTime.toFixed(2)} dur=${(audio.duration || 0).toFixed(1)}` +
			` ready=${audio.readyState} net=${audio.networkState}` +
			` paused=${audio.paused} bufRanges=[${ranges.join(",")}]` +
			` pFB=${pausedForBuffering} isBuf=${isBuffering}` +
			` actx=${audioCtx?.state ?? "none"}`,
		);
	}

	initDebugOverlay();
	/* ——— end debug overlay ——— */

	let manifest: VoiceManifest | null = null;
	let article: Element | null = null;
	let focusAllowed = true;
	let lastParagraphIdx = -1;
	let ready = false;
	let pauseAfterParagraphIdx = -1;
	let userScrolledAway = false;
	let rafId = 0;
	let isBuffering = false;
	let pausedForBuffering = false;
	let bufferResumeTime = 0;
	let bufferTimeoutId: number | null = null;
	let lastPausePosition = 0; // For detecting browser-initiated position resets
	const paragraphWordIndexMap = new Map<number, number[]>();

	/* ——— iOS Audio Session activation via Web Audio API ——— */
	// On iOS (Safari & Chrome/WKWebView), the <audio> element can report
	// readyState=4, fire 'playing', and advance currentTime — yet produce no
	// audible output because the hardware audio session hasn't been activated.
	// Routing the element through an AudioContext via createMediaElementSource()
	// forces the audio session active. The source node MUST be created after
	// AudioContext is running — creating it while suspended routes audio to a
	// dead output that stays dead even after a later resume.
	// Audio is fetched as a blob: URL (same-origin) to avoid iOS CORS Range
	// request issues that silently break MediaElementSource at buffer boundaries.
	let audioCtx: AudioContext | null = null;
	let audioSourceNode: MediaElementAudioSourceNode | null = null;
	let analyserNode: AnalyserNode | null = null;

	/** Periodically check AnalyserNode for silence while audio is supposedly playing. */
	let silenceCheckId: number | null = null;
	function startSilenceMonitor(): void {
		if (!VOICE_DEBUG || !analyserNode || silenceCheckId !== null) return;
		const buf = new Uint8Array(analyserNode.frequencyBinCount);
		silenceCheckId = window.setInterval(() => {
			if (audio.paused || !analyserNode) {
				stopSilenceMonitor();
				return;
			}
			analyserNode.getByteFrequencyData(buf);
			const max = buf.reduce((a, b) => Math.max(a, b), 0);
			if (max === 0 && audio.currentTime > 0.1) {
				dbg(`⚠ SILENCE detected at t=${audio.currentTime.toFixed(2)} (analyser max=0)`);
			}
		}, 1000);
	}
	function stopSilenceMonitor(): void {
		if (silenceCheckId !== null) {
			clearInterval(silenceCheckId);
			silenceCheckId = null;
		}
	}

	function ensureAudioContext(): Promise<void> {
		// Already wired up — nothing to do.
		if (audioSourceNode) return Promise.resolve();
		const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
		if (!Ctx) return Promise.resolve();
		if (!audioCtx) {
			try {
				audioCtx = new Ctx();
				dbg(`AudioContext created, state=${audioCtx.state}`);
			} catch (e) {
				dbg(`AudioContext error: ${e}`);
				return Promise.resolve();
			}
		}
		const resumeP = audioCtx.state === "suspended"
			? audioCtx.resume()
			: Promise.resolve();
		return resumeP.then(() => {
			// Now that AudioContext is running, wire the <audio> element through it.
			if (audioCtx && !audioSourceNode) {
				try {
					audioSourceNode = audioCtx.createMediaElementSource(audio);
					// Route: source → analyser → destination
					if (VOICE_DEBUG) {
						analyserNode = audioCtx.createAnalyser();
						analyserNode.fftSize = 256;
						audioSourceNode.connect(analyserNode);
						analyserNode.connect(audioCtx.destination);
					} else {
						audioSourceNode.connect(audioCtx.destination);
					}
					// On iOS, playing from t=0 after connecting MediaElementSource
					// is always silent — the decode pipeline isn't re-initialized
					// through the new AudioContext route. A micro-seek forces iOS
					// to re-init the pipeline so audio is audible immediately.
					if (audio.currentTime < 0.01) {
						audio.currentTime = 0.001;
					} else {
						audio.currentTime = audio.currentTime;
					}
					dbg(`MediaElementSource connected (actx=${audioCtx.state}), nudged t=${audio.currentTime.toFixed(3)}, blob=${!audio.hasAttribute("crossorigin")}`);
				} catch (e) {
					dbg(`MediaElementSource error: ${e}`);
				}
			}
		}).catch(() => {});
	}
	/* ——— end iOS Audio Session ——— */

	const base = voiceAudioBase(discourseId);
	const lsKey = `${LS_PREFIX}${discourseId}`;

	function readLs(): { position?: number; rate?: number; speed?: number } {
		try {
			const raw = localStorage.getItem(lsKey);
			if (!raw) return {};
			return JSON.parse(raw) as {
				position?: number;
				rate?: number;
				speed?: number;
			};
		} catch {
			return {};
		}
	}

	function updateSpeedButtons(): void {
		if (!speedLabel) return;
		const rates = VOICE_PLAYBACK_RATES;
		speedLabel.textContent = `${audio.playbackRate.toFixed(2).replace(/\.00$/, "").replace(/\.50$/, ".5")}×`;
		const idx = rates.findIndex((r) => Math.abs(r - audio.playbackRate) < 0.01);
		speedDown?.classList.toggle("voice-speed-adj--hidden", idx <= 0);
		speedUp?.classList.toggle("voice-speed-adj--hidden", idx >= rates.length - 1);
	}

	function writeLs(): void {
		try {
			localStorage.setItem(
				lsKey,
				JSON.stringify({
					position: audio.currentTime,
					paragraphId:
						manifest?.paragraphs[
							findParagraphIndexAtTime(manifest, audio.currentTime)
						]?.id,
					manifestVersion: manifest?.version,
					speed: audio.playbackRate,
				}),
			);
		} catch {
			/* ignore */
		}
	}

	function ensureArticle(): void {
		if (!manifest) return;
		const current = getVisibleEnglishArticle();
		if (!current) return;
		if (current !== article) {
			if (article) {
				clearWordHighlights(article);
				clearParagraphHighlights(article);
			}
			article = current;
			paragraphWordIndexMap.clear();
		}
		if (!article.hasAttribute(WRAPPED_ATTR)) {
			article
				.querySelectorAll<HTMLElement>(
					"p.english-paragraph[data-paragraph-number]",
				)
				.forEach((p) => wrapVoiceWords(p));
			article.setAttribute(WRAPPED_ATTR, "1");
			paragraphWordIndexMap.clear();
		}
	}

	function injectButtons(): void {
		if (!article) return;
		injectParagraphPlayButtons(
			article,
			(pNum) => seekToParagraphById(pNum, false),
			(pNum) => seekToParagraphById(pNum, true),
		);
	}

	function setVoiceMode(on: boolean): void {
		document.documentElement.classList.toggle("voice-mode", on);
		triggerBtn.setAttribute("aria-pressed", on ? "true" : "false");
		voiceBar.classList.toggle("hidden", !on);
		if (on) {
			updateUrlParam("voice", "1");
			updateUrlParam("viz", null);
			document.dispatchEvent(new CustomEvent("voiceParamChanged"));
			ensureArticle();
			injectButtons();
		} else {
			voiceBar
				.querySelector("details.voice-shortcuts-details")
				?.removeAttribute("open");
			updateUrlParam("voice", null);
			document.dispatchEvent(new CustomEvent("voiceParamChanged"));
			document.documentElement.classList.remove("voice-immersive");
			document.documentElement.classList.remove("voice-bar-minimized");
			minimizeBtn?.setAttribute("aria-expanded", "true");
			minimizeBtn?.setAttribute("aria-label", "Minimize player");
			minimizeBtn?.setAttribute("title", "Minimize player");
			clearWordHighlights(article);
			clearParagraphHighlights(article);
			removeParagraphPlayButtons(article);
			lastParagraphIdx = -1;
			pauseAfterParagraphIdx = -1;
			userScrolledAway = false;
		}
	}

	function setBarMinimized(min: boolean): void {
		document.documentElement.classList.toggle("voice-bar-minimized", min);
		minimizeBtn?.setAttribute("aria-expanded", min ? "false" : "true");
		minimizeBtn?.setAttribute("aria-label", min ? "Expand player" : "Minimize player");
		minimizeBtn?.setAttribute("title", min ? "Expand player" : "Minimize player");
	}

	function resetUserScroll(): void {
		userScrolledAway = false;
	}

	function scrollToCurrent(): void {
		if (!manifest || !article) return;
		const idx = findParagraphIndexAtTime(manifest, audio.currentTime);
		const block = manifest.paragraphs[idx];
		if (!block) return;
		const pEl = article.querySelector(
			`p.english-paragraph[data-paragraph-number="${block.id}"]`,
		);
		if (pEl) scrollIntoViewIfNeeded(pEl, voiceBar);
	}

	function updateHighlight(t: number): void {
		if (!manifest) return;
		ensureArticle();
		const idx = findParagraphIndexAtTime(manifest, t);
		const block = manifest.paragraphs[idx];
		clearWordHighlights(article);
		clearParagraphHighlights(article);
		if (!block || !article) return;
		const pEl = article.querySelector(
			`p.english-paragraph[data-paragraph-number="${block.id}"]`,
		);
		if (!pEl) return;
		pEl.classList.add("voice-paragraph-active");
		const wi = findWordIndexInParagraph(block, t);
		const spans = pEl.querySelectorAll(".voice-word");
		let spanIndex = wi;
		let indexMap = paragraphWordIndexMap.get(block.id);
		if (!indexMap) {
			indexMap = buildWordIndexMap(block, Array.from(spans));
			paragraphWordIndexMap.set(block.id, indexMap);
		}
		if (wi >= 0 && indexMap[wi] !== undefined && indexMap[wi] >= 0) {
			spanIndex = indexMap[wi];
		}
		const wordEl = spanIndex >= 0 && spans[spanIndex] ? spans[spanIndex] : null;
		if (wordEl) wordEl.classList.add("voice-word-active");

		if (!audio.paused) {
			// If user scrolled away but then scrolled back to see the active paragraph, resume
			if (userScrolledAway && pEl && isInViewport(pEl, voiceBar)) {
				userScrolledAway = false;
			}

			if (!userScrolledAway) {
				const paragraphChanged = idx !== lastParagraphIdx;
				lastParagraphIdx = idx;
				if (paragraphChanged) {
					scrollIntoViewIfNeeded(wordEl || pEl, voiceBar);
				} else if (wordEl) {
					const rect = wordEl.getBoundingClientRect();
					const barTop = voiceBar.getBoundingClientRect().top;
					if (rect.bottom > barTop - 40 || rect.top < 40)
						scrollIntoViewIfNeeded(wordEl, voiceBar);
				}
			} else {
				lastParagraphIdx = idx;
			}
		} else {
			lastParagraphIdx = idx;
		}
	}

	function syncUi(): void {
		if (!manifest) return;
		const d = audio.duration || manifest.duration || 0;
		const t = audio.currentTime;
		voiceTimeEl.textContent = `${formatTime(t)} / ${formatTime(d)}`;
		if (d > 0) voiceSeek.value = String((t / d) * 100);
		updateHighlight(t);
	}

	function checkSingleParaPause(): void {
		if (pauseAfterParagraphIdx < 0 || !manifest || audio.paused) return;
		const block = manifest.paragraphs[pauseAfterParagraphIdx];
		if (!block) return;
		if (audio.currentTime >= block.end) {
			audio.pause();
			pauseAfterParagraphIdx = -1;
			syncUi();
		}
	}

	/* ——— Buffering indicator ——— */
	function setBuffering(on: boolean): void {
		if (!playBtn) return;
		isBuffering = on;
		if (on) {
			playBtn.classList.add("voice-play-buffering");
			playBtn.setAttribute("aria-label", "Buffering…");
		} else {
			playBtn.classList.remove("voice-play-buffering");
			// Restore correct label based on paused state
			if (audio.paused) {
				playBtn.textContent = "▶";
				playBtn.setAttribute("aria-label", "Play");
				playBtn.setAttribute("title", "Play");
			} else {
				playBtn.textContent = "❚❚";
				playBtn.setAttribute("aria-label", "Pause");
				playBtn.setAttribute("title", "Pause");
			}
		}
	}

	/** Pause the audio to prevent phantom currentTime advance while buffering.
	 *  Records position so we can resume from the right spot. */
	function enterBufferingPause(): void {
		if (pausedForBuffering || audio.paused) return;
		bufferResumeTime = audio.currentTime;
		pausedForBuffering = true;
		audio.pause(); // will fire 'pause' event — guarded by pausedForBuffering flag
		setBuffering(true);
		dbgState("enterBufferingPause");
		// Safety timeout: if the browser never fires canplaythrough/playing,
		// resume anyway after 15 s (by then, most of the file should be downloaded).
		if (bufferTimeoutId !== null) clearTimeout(bufferTimeoutId);
		bufferTimeoutId = window.setTimeout(() => {
			bufferTimeoutId = null;
			dbg("bufferTimeout fired");
			if (pausedForBuffering) exitBufferingPause();
		}, 15_000);
	}

	/** Resume from a buffering pause — seek back to saved position and play. */
	function exitBufferingPause(): void {
		if (!pausedForBuffering) return;
		pausedForBuffering = false;
		if (bufferTimeoutId !== null) { clearTimeout(bufferTimeoutId); bufferTimeoutId = null; }
		setBuffering(false);
		// Seek back to where we were when buffering started (currentTime may have
		// drifted during the phantom-play window before we paused).
		audio.currentTime = bufferResumeTime;
		ensureAudioContext().then(() => audio.play().catch(() => {}));
	}

	function clearBufferingState(): void {
		pausedForBuffering = false;
		if (bufferTimeoutId !== null) { clearTimeout(bufferTimeoutId); bufferTimeoutId = null; }
		setBuffering(false);
	}

	/* ——— rAF-based sync loop: runs at display refresh rate during playback ——— */
	function startRafLoop(): void {
		if (rafId) return;
		const tick = (): void => {
			checkSingleParaPause();
			syncUi();
			if (!audio.paused) rafId = requestAnimationFrame(tick);
			else rafId = 0;
		};
		rafId = requestAnimationFrame(tick);
	}

	function stopRafLoop(): void {
		if (rafId) { cancelAnimationFrame(rafId); rafId = 0; }
	}

	function onTimeUpdate(): void {
		// rAF loop handles visual sync during playback; timeupdate handles
		// persistence and immersive-mode gating so it still fires at low frequency.
		if (audio.paused) {
			checkSingleParaPause();
			syncUi();
		}
		// Don't save a phantom position while iOS is silently buffering
		if (!isBuffering) writeLs();
		if (
			focusAllowed &&
			!audio.paused &&
			audio.currentTime >= 10 &&
			document.documentElement.classList.contains("voice-mode") &&
			!document.documentElement.classList.contains("voice-immersive")
		) {
			document.documentElement.classList.add("voice-immersive");
		}
	}

	function seekToParagraph(delta: number): void {
		if (!manifest) return;
		const idx = findParagraphIndexAtTime(manifest, audio.currentTime);
		const targetIdx = Math.max(
			0,
			Math.min(manifest.paragraphs.length - 1, idx + delta),
		);
		seekToParagraphById(manifest.paragraphs[targetIdx].id, true);
	}

	function seekToParagraphById(
		paragraphId: number,
		singleOnly: boolean,
	): void {
		if (!manifest) return;
		const idx = manifest.paragraphs.findIndex((p) => p.id === paragraphId);
		if (idx < 0) return;
		const targetTime = manifest.paragraphs[idx].start;
		resetUserScroll();
		clearBufferingState();
		lastParagraphIdx = -1;
		lastPausePosition = 0; // Clear to prevent false reset detection during seeks
		pauseAfterParagraphIdx = singleOnly ? idx : -1;

		// On mobile browsers, playing immediately after setting currentTime can race
		// with seek resolution and mangle the first syllables of the target paragraph.
		const settleSeekThenPlay = (): void => {
			// After seek settles, verify the browser actually landed close to the target.
			// Mobile OGG decoders may land at a nearby granule boundary instead of the
			// exact time requested.  If off by > 150 ms, try one corrective re-seek.
			const drift = audio.currentTime - targetTime;
			if (Math.abs(drift) > 0.15) {
				audio.addEventListener("seeked", () => {
					syncUi();
					if (audio.paused) { ensureAudioContext().then(() => audio.play().catch(() => {})); }
				}, { once: true });
				audio.currentTime = targetTime;
				return;
			}
			syncUi();
			if (audio.paused) { ensureAudioContext().then(() => audio.play().catch(() => {})); }
		};

		if (Math.abs(audio.currentTime - targetTime) < 0.02) {
			settleSeekThenPlay();
			return;
		}

		audio.pause();
		let settled = false;
		const onSettled = (): void => {
			if (settled) return;
			settled = true;
			settleSeekThenPlay();
		};

		audio.addEventListener("seeked", onSettled, { once: true });
		audio.currentTime = targetTime;
		window.setTimeout(onSettled, 300);
	}

	function updateFocusToggleLabel(): void {
		if (!focusToggle) return;
		focusToggle.textContent = focusAllowed ? "Focus: On" : "Focus: Off";
		focusToggle.setAttribute(
			"title",
			focusAllowed
				? "Focus on: dim surrounding text"
				: "Focus off: show full page",
		);
		focusToggle.setAttribute("aria-label", focusAllowed ? "Focus on" : "Focus off");
		focusToggle.classList.toggle("voice-rate-active", focusAllowed);
	}

	function setFocus(on: boolean): void {
		focusAllowed = on;
		updateFocusToggleLabel();
		if (!on) {
			document.documentElement.classList.remove("voice-immersive");
		}
		resetUserScroll();
		scrollToCurrent();
	}

	function togglePlayPause(): void {
		pauseAfterParagraphIdx = -1;
		dbgState("togglePlayPause");
		if (pausedForBuffering) {
			// Cancel buffering wait and stay paused
			clearBufferingState();
			audio.currentTime = bufferResumeTime;
			syncUi();
			return;
		}
		if (audio.paused) {
			resetUserScroll();
			ensureAudioContext().then(() => audio.play().catch(() => {}));
		} else {
			audio.pause();
		}
	}

	// bootstrap — show Listen only when manifest + webm both exist (shared single GET per slug)
	void (async () => {
		const fail = (): void => {
			stripVoiceUrlIfNoAudio();
		};
		const data = await loadVoiceManifestForDiscourse(discourseId);
		if (!data) {
			fail();
			return;
		}
		manifest = data;
		const webmUrl = voiceWebmUrl(base, manifest);
		// Fetch entire audio as blob for same-origin playback.
		// On iOS WKWebView, crossorigin + createMediaElementSource() causes audio
		// to go silent at buffer boundaries when the browser issues new CORS Range
		// requests. A blob: URL is same-origin, eliminating CORS during playback.
		let usedBlob = false;
		try {
			const res = await fetch(webmUrl);
			if (res.ok) {
				const blob = await res.blob();
				audio.src = URL.createObjectURL(blob);
				audio.removeAttribute("crossorigin");
				usedBlob = true;
				dbg(`bootstrap: blob ready ${(blob.size / 1024).toFixed(0)}KB`);
			}
		} catch { /* fall through to CDN URL */ }
		if (!usedBlob) {
			audio.src = webmUrl;
			audio.preload = "auto";
			dbg(`bootstrap: CDN fallback src=${webmUrl.slice(-40)} preload=auto`);
		}
		ready = true;
		const saved = readLs();
		const allowedRates = VOICE_PLAYBACK_RATES;
		const savedRate =
			typeof saved.rate === "number"
				? saved.rate
				: typeof saved.speed === "number"
					? saved.speed
					: undefined;
		if (typeof savedRate === "number" && savedRate > 0) {
			const nearest = allowedRates.reduce((best, x) =>
				Math.abs(x - savedRate) < Math.abs(best - savedRate) ? x : best,
			);
			audio.playbackRate = nearest;
		}
		updateSpeedButtons();
		if (typeof saved.position === "number" && saved.position > 0) {
			audio.addEventListener(
				"loadedmetadata",
				() => {
					audio.currentTime = Math.min(
						saved.position!,
						audio.duration || 1e9,
					);
				},
				{ once: true },
			);
		}
		triggerBtn.classList.remove("hidden");

		const urlVoice = new URLSearchParams(location.search).get("voice");
		if (urlVoice === "1" || urlVoice === "true") {
			setVoiceMode(true);
			syncUi();
			playBtn.focus();
		}
	})();

	audio.addEventListener("timeupdate", onTimeUpdate);
	audio.addEventListener("play", () => {
		dbgState("EVENT:play");
		playBtn.textContent = "❚❚";
		playBtn.setAttribute("aria-label", "Pause");
		playBtn.setAttribute("title", "Pause");
	});
	audio.addEventListener("playing", () => {
		dbgState("EVENT:playing");
		// Detect CORS re-validation position reset on iOS: after pause at t=7.47,
		// iOS may re-fetch crossorigin audio and auto-resume from t=0.
		// Restore the position the user was at.
		if (lastPausePosition > 1 && audio.currentTime < 0.5) {
			dbg(`Position reset detected, restoring to ${lastPausePosition.toFixed(2)}`);
			audio.currentTime = lastPausePosition;
			lastPausePosition = 0;
		}
		clearBufferingState();
		startRafLoop();
		startSilenceMonitor();
	});
	audio.addEventListener("waiting", () => {
		dbgState("EVENT:waiting");
		stopRafLoop();
		enterBufferingPause();
	});
	audio.addEventListener("stalled", () => {
		dbgState("EVENT:stalled");
		if (audio.readyState < 3) {
			stopRafLoop();
			enterBufferingPause();
		}
	});
	audio.addEventListener("canplaythrough", () => {
		dbgState("EVENT:canplaythrough");
		if (pausedForBuffering) exitBufferingPause();
	});
	audio.addEventListener("canplay", () => {
		dbgState("EVENT:canplay");
	});
	audio.addEventListener("loadeddata", () => {
		dbgState("EVENT:loadeddata");
	});
	audio.addEventListener("loadedmetadata", () => {
		dbgState("EVENT:loadedmetadata");
	});
	audio.addEventListener("suspend", () => {
		dbgState("EVENT:suspend");
	});
	audio.addEventListener("error", () => {
		const e = audio.error;
		dbg(`EVENT:error code=${e?.code} msg=${e?.message}`);
		if (e?.code === 4 && audio.crossOrigin) {
			dbg(`CORS/format error — check R2 AllowedHeaders includes Range`);
		}
	});
	audio.addEventListener("pause", () => {
		dbgState("EVENT:pause");
		stopSilenceMonitor();
		if (pausedForBuffering) return;
		if (audio.currentTime > 0) lastPausePosition = audio.currentTime;
		clearBufferingState();
		playBtn.textContent = "▶";
		playBtn.setAttribute("aria-label", "Play");
		playBtn.setAttribute("title", "Play");
		stopRafLoop();
		syncUi();
	});

	// User-initiated exits (exit button, Escape, 'V' toggle) call setVoiceMode(false)
	// + audio.pause(). Make sure our buffering state is always fully cleared on exit.
	exitBtn.addEventListener("click", () => {
		clearBufferingState();
		setVoiceMode(false);
		audio.pause();
	});

	audio.addEventListener("ended", () => {
		if (!document.documentElement.classList.contains("voice-mode")) return;
		document.dispatchEvent(
			new CustomEvent("voicePlaybackComplete", {
				bubbles: true,
				detail: { slug: discourseId },
			}),
		);
	});

	function onUserScroll(): void {
		if (
			!audio.paused &&
			document.documentElement.classList.contains("voice-mode")
		) {
			userScrolledAway = true;
			if (focusAllowed) {
				focusAllowed = false;
				updateFocusToggleLabel();
				document.documentElement.classList.remove("voice-immersive");
			}
		}
	}
	window.addEventListener("wheel", onUserScroll, { passive: true });
	window.addEventListener("touchmove", onUserScroll, { passive: true });

	document.addEventListener("layoutChanged", () => {
		if (!document.documentElement.classList.contains("voice-mode")) return;
		const prev = article;
		ensureArticle();
		if (article && article !== prev) {
			removeParagraphPlayButtons(prev);
			injectButtons();
			lastParagraphIdx = -1;
			syncUi();
		}
	});

	triggerBtn.addEventListener("click", () => {
		if (!ready || !manifest) return;
		const on = !document.documentElement.classList.contains("voice-mode");
		dbgState(`triggerBtn: turning ${on ? "ON" : "OFF"}`);
		if (!on) clearBufferingState();
		setVoiceMode(on);
		if (on) {
			syncUi();
			ensureAudioContext().then(() => audio.play().catch(() => {}));
		} else {
			audio.pause();
		}
		triggerBtn.blur();
	});

	playBtn.addEventListener("click", () => {
		togglePlayPause();
		playBtn.blur();
	});

	prevBtn.addEventListener("click", () => {
		seekToParagraph(-1);
		prevBtn.blur();
	});
	nextBtn.addEventListener("click", () => {
		seekToParagraph(1);
		nextBtn.blur();
	});

	voiceSeek.addEventListener("input", () => {
		if (!manifest?.duration && !audio.duration) return;
		const d = audio.duration || manifest!.duration || 0;
		audio.currentTime = (Number(voiceSeek.value) / 100) * d;
		lastParagraphIdx = -1;
		pauseAfterParagraphIdx = -1;
		resetUserScroll();
		syncUi();
	});

	/** After playbackRate change on mobile, the browser may internally re-seek
	 *  to a nearby OGG granule boundary, shifting audio.currentTime. This
	 *  restores the position to what it should be. */
	function reAnchorAfterRateChange(savedTime: number): void {
		const check = (): void => {
			const drift = audio.currentTime - savedTime;
			if (Math.abs(drift) > 0.15) {
				audio.currentTime = savedTime;
			}
		};
		// Small delay to let the browser process the rate change internally
		window.setTimeout(check, 80);
	}

	if (speedDown) {
		speedDown.addEventListener("click", () => {
			const rates = VOICE_PLAYBACK_RATES;
			const idx = rates.findIndex((r) => Math.abs(r - audio.playbackRate) < 0.01);
			if (idx > 0) {
				const savedTime = audio.currentTime;
				audio.playbackRate = rates[idx - 1];
				updateSpeedButtons();
				writeLs();
				reAnchorAfterRateChange(savedTime);
			}
			speedDown.blur();
		});
	}

	if (speedUp) {
		speedUp.addEventListener("click", () => {
			const rates = VOICE_PLAYBACK_RATES;
			const idx = rates.findIndex((r) => Math.abs(r - audio.playbackRate) < 0.01);
			if (idx < rates.length - 1) {
				const savedTime = audio.currentTime;
				audio.playbackRate = rates[idx + 1];
				updateSpeedButtons();
				writeLs();
				reAnchorAfterRateChange(savedTime);
			}
			speedUp.blur();
		});
	}

	if (focusToggle) {
		updateFocusToggleLabel();
		focusToggle.addEventListener("click", () => {
			setFocus(!focusAllowed);
			focusToggle.blur();
		});
	}

	minimizeBtn?.addEventListener("click", () => {
		const min = !document.documentElement.classList.contains(
			"voice-bar-minimized",
		);
		setBarMinimized(min);
		minimizeBtn.blur();
	});

	document.addEventListener("keydown", (e) => {
		const active = document.activeElement as HTMLElement | null;
		const activeTag = active?.tagName.toLowerCase();
		const isRangeSlider =
			activeTag === "input" &&
			(active as HTMLInputElement)?.type === "range";
		const isInputFocused =
			!isRangeSlider &&
			(activeTag === "input" ||
				activeTag === "textarea" ||
				activeTag === "select" ||
				active?.isContentEditable);
		if (isInputFocused) return;

		const inVoice =
			document.documentElement.classList.contains("voice-mode");

		if (e.key === "Escape" && inVoice) {
			exitBtn.click();
			return;
		}

		if (
			e.key.toLowerCase() === "v" &&
			!e.ctrlKey &&
			!e.metaKey &&
			!e.altKey &&
			ready
		) {
			e.preventDefault();
			if (inVoice) {
				clearBufferingState();
				audio.pause();
				setVoiceMode(false);
			} else {
				setVoiceMode(true);
				syncUi();
				ensureAudioContext().then(() => audio.play().catch(() => {}));
			}
			return;
		}

		if (!inVoice) return;

		const seekFocused = active?.id === "voice-seek";
		if (
			(e.key === "ArrowLeft" || e.key === "ArrowRight") &&
			!seekFocused
		) {
			e.preventDefault();
			seekToParagraph(e.key === "ArrowLeft" ? -1 : 1);
			return;
		}

		if (e.key === " ") {
			e.preventDefault();
			togglePlayPause();
		}
	});

	window.addEventListener("beforeunload", writeLs);
}
