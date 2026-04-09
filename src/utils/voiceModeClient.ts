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

/** Ensure the Opus file exists (manifest alone is not enough). */
async function opusAssetExists(opusUrl: string): Promise<boolean> {
	let res = await fetch(opusUrl, { method: "HEAD", cache: "no-cache" });
	if (res.ok) return true;
	if (res.status === 405) {
		res = await fetch(opusUrl, {
			headers: { Range: "bytes=0-0" },
			cache: "no-cache",
		});
		return res.ok || res.status === 206;
	}
	return false;
}

const LS_PREFIX = "voice:";
const PUNCT_ONLY = /^[.,;:!?'"''""\-–—)\]]+$/;
const LEADING_PUNCT = /^['"''"([\-–—]+$/;
const WRAPPED_ATTR = "data-voice-wrapped";

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
		const words = tt.textContent?.trim().split(/\s+/) || [];
		if (words.length <= 1) {
			tt.classList.add("voice-word");
			continue;
		}
		const frag = document.createDocumentFragment();
		words.forEach((w, i) => {
			if (i > 0) frag.appendChild(document.createTextNode(" "));
			const s = document.createElement("span");
			s.className = "voice-word tooltip-text";
			s.setAttribute(
				"data-tooltip-content",
				tt.getAttribute("data-tooltip-content") || "",
			);
			s.textContent = w;
			frag.appendChild(s);
		});
		tt.parentNode?.replaceChild(frag, tt);
	}

	const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
		acceptNode(node) {
			if (!node.textContent?.trim()) return NodeFilter.FILTER_REJECT;
			if (node.parentElement?.classList.contains("voice-word"))
				return NodeFilter.FILTER_REJECT;
			if (node.parentElement?.closest(".voice-skip"))
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
		const parts = text.split(/(\s+|—)/);
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
		if (PUNCT_ONLY.test(txt)) {
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
		target.scrollIntoView({ behavior: "smooth", block: "center" });
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
	if (v === "1" || v === "true") updateUrlParam("voice", null);
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
	const audio = document.getElementById(
		"voice-audio",
	) as HTMLAudioElement | null;
	const bar = document.getElementById("voice-bar");
	const playBtn = document.getElementById("voice-play");
	const prevBtn = document.getElementById("voice-prev");
	const nextBtn = document.getElementById("voice-next");
	const seek = document.getElementById(
		"voice-seek",
	) as HTMLInputElement | null;
	const timeEl = document.getElementById("voice-time");
	const segEl = document.getElementById("voice-segment");
	const exitBtn = document.getElementById("voice-exit");
	const focusToggle = document.getElementById(
		"voice-focus-toggle",
	) as HTMLButtonElement | null;
	if (
		!audio ||
		!bar ||
		!playBtn ||
		!prevBtn ||
		!nextBtn ||
		!seek ||
		!timeEl ||
		!exitBtn
	)
		return;

	let manifest: VoiceManifest | null = null;
	let article: Element | null = null;
	let focusAllowed = true;
	let lastParagraphIdx = -1;
	let ready = false;
	let pauseAfterParagraphIdx = -1;
	let userScrolledAway = false;

	/** Same-origin /audio/{slug} in dev; prod uses PUBLIC_AUDIO_BASE_URL (no trailing slash), e.g. https://hear.wordsofthebuddha.org */
	const audioRoot = import.meta.env.PUBLIC_AUDIO_BASE_URL as string | undefined;
	const base = audioRoot
		? `${audioRoot.replace(/\/$/, "")}/${encodeURIComponent(discourseId)}`
		: `/audio/${encodeURIComponent(discourseId)}`;
	const lsKey = `${LS_PREFIX}${discourseId}`;

	function readLs(): { position?: number; rate?: number } {
		try {
			const raw = localStorage.getItem(lsKey);
			if (!raw) return {};
			return JSON.parse(raw) as { position?: number; rate?: number };
		} catch {
			return {};
		}
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
		}
		if (!article.hasAttribute(WRAPPED_ATTR)) {
			article
				.querySelectorAll<HTMLElement>(
					"p.english-paragraph[data-paragraph-number]",
				)
				.forEach((p) => wrapVoiceWords(p));
			article.setAttribute(WRAPPED_ATTR, "1");
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
		bar.classList.toggle("hidden", !on);
		if (on) {
			updateUrlParam("voice", "1");
			updateUrlParam("viz", null);
			ensureArticle();
			injectButtons();
		} else {
			updateUrlParam("voice", null);
			document.documentElement.classList.remove("voice-immersive");
			clearWordHighlights(article);
			clearParagraphHighlights(article);
			removeParagraphPlayButtons(article);
			lastParagraphIdx = -1;
			pauseAfterParagraphIdx = -1;
			userScrolledAway = false;
		}
	}

	function resetUserScroll(): void {
		userScrolledAway = false;
	}

	function scrollToCurrent(): void {
		if (!manifest || !article || !bar) return;
		const idx = findParagraphIndexAtTime(manifest, audio.currentTime);
		const block = manifest.paragraphs[idx];
		if (!block) return;
		const pEl = article.querySelector(
			`p.english-paragraph[data-paragraph-number="${block.id}"]`,
		);
		if (pEl) scrollIntoViewIfNeeded(pEl, bar);
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
		const wordEl = wi >= 0 && spans[wi] ? spans[wi] : null;
		if (wordEl) wordEl.classList.add("voice-word-active");

		if (!audio.paused && bar) {
			// If user scrolled away but then scrolled back to see the active paragraph, resume
			if (userScrolledAway && pEl && isInViewport(pEl, bar)) {
				userScrolledAway = false;
			}

			if (!userScrolledAway) {
				const paragraphChanged = idx !== lastParagraphIdx;
				lastParagraphIdx = idx;
				if (paragraphChanged) {
					scrollIntoViewIfNeeded(wordEl || pEl, bar);
				} else if (wordEl) {
					const rect = wordEl.getBoundingClientRect();
					const barTop = bar.getBoundingClientRect().top;
					if (rect.bottom > barTop - 40 || rect.top < 40)
						scrollIntoViewIfNeeded(wordEl, bar);
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
		timeEl.textContent = `${formatTime(t)} / ${formatTime(d)}`;
		if (d > 0) seek.value = String((t / d) * 100);
		const pi = findParagraphIndexAtTime(manifest, t);
		if (segEl)
			segEl.textContent = `¶ ${pi + 1} / ${manifest.paragraphs.length}`;
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

	function onTimeUpdate(): void {
		checkSingleParaPause();
		syncUi();
		writeLs();
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
		pauseAfterParagraphIdx = -1;
		resetUserScroll();
		const idx = findParagraphIndexAtTime(manifest, audio.currentTime);
		const next = Math.max(
			0,
			Math.min(manifest.paragraphs.length - 1, idx + delta),
		);
		audio.currentTime = manifest.paragraphs[next].start;
		lastParagraphIdx = -1;
		syncUi();
	}

	function seekToParagraphById(
		paragraphId: number,
		singleOnly: boolean,
	): void {
		if (!manifest) return;
		const idx = manifest.paragraphs.findIndex((p) => p.id === paragraphId);
		if (idx < 0) return;
		resetUserScroll();
		audio.currentTime = manifest.paragraphs[idx].start;
		lastParagraphIdx = -1;
		pauseAfterParagraphIdx = singleOnly ? idx : -1;
		syncUi();
		if (audio.paused) audio.play().catch(() => {});
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
		if (audio.paused) {
			resetUserScroll();
			audio.play().catch(() => {});
		} else {
			audio.pause();
		}
	}

	// bootstrap — show Listen only when manifest + opus both exist and manifest is usable
	void (async () => {
		const fail = (): void => {
			stripVoiceUrlIfNoAudio();
		};
		try {
			const res = await fetch(`${base}.manifest.json`, {
				cache: "no-cache",
			});
			if (!res.ok) {
				fail();
				return;
			}
			const data: unknown = await res.json();
			if (!isValidVoiceManifest(data)) {
				fail();
				return;
			}
			const opusUrl = `${base}.opus`;
			if (!(await opusAssetExists(opusUrl))) {
				fail();
				return;
			}
			manifest = data;
		} catch {
			fail();
			return;
		}
		audio.src = `${base}.opus`;
		ready = true;
		const saved = readLs();
		const allowedRates = [0.75, 1, 1.25];
		if (typeof saved.rate === "number" && saved.rate > 0) {
			const nearest = allowedRates.reduce((best, x) =>
				Math.abs(x - saved.rate!) < Math.abs(best - saved.rate!) ? x : best,
			);
			audio.playbackRate = nearest;
		}
		document
			.querySelectorAll(".voice-speed button[data-rate]")
			.forEach((b) => {
				const r = Number((b as HTMLButtonElement).dataset.rate);
				b.classList.toggle(
					"voice-rate-active",
					Math.abs(r - audio.playbackRate) < 0.01,
				);
			});
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
		playBtn.textContent = "❚❚";
		playBtn.setAttribute("aria-label", "Pause");
		playBtn.setAttribute("title", "Pause");
	});
	audio.addEventListener("pause", () => {
		playBtn.textContent = "▶";
		playBtn.setAttribute("aria-label", "Play");
		playBtn.setAttribute("title", "Play");
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
		setVoiceMode(on);
		if (on) {
			syncUi();
			audio.play().catch(() => {});
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

	seek.addEventListener("input", () => {
		if (!manifest?.duration && !audio.duration) return;
		const d = audio.duration || manifest!.duration || 0;
		audio.currentTime = (Number(seek.value) / 100) * d;
		lastParagraphIdx = -1;
		pauseAfterParagraphIdx = -1;
		resetUserScroll();
		syncUi();
	});

	document.querySelectorAll(".voice-speed button[data-rate]").forEach((b) => {
		b.addEventListener("click", () => {
			const r = Number((b as HTMLButtonElement).dataset.rate);
			if (!Number.isFinite(r)) return;
			audio.playbackRate = r;
			document
				.querySelectorAll(".voice-speed button[data-rate]")
				.forEach((x) => x.classList.remove("voice-rate-active"));
			b.classList.add("voice-rate-active");
			writeLs();
			(b as HTMLElement).blur();
		});
	});

	if (focusToggle) {
		updateFocusToggleLabel();
		focusToggle.addEventListener("click", () => {
			setFocus(!focusAllowed);
			focusToggle.blur();
		});
	}

	exitBtn.addEventListener("click", () => {
		setVoiceMode(false);
		audio.pause();
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
				audio.pause();
				setVoiceMode(false);
			} else {
				setVoiceMode(true);
				syncUi();
				audio.play().catch(() => {});
			}
			return;
		}

		if (!inVoice) return;

		if (e.key === " ") {
			e.preventDefault();
			togglePlayPause();
		}
	});

	window.addEventListener("beforeunload", writeLs);
}
