/**
 * Hash deep links (`/dn15#the-chain-of-causation`, `/dn21#73-85`).
 *
 * Opening those URLs in a new tab loads the page in the background. A smooth
 * scroll started there is discarded, and Safari also resets scroll position
 * on the load event after `history.replaceState` during DOMContentLoaded.
 * A reload or a same-tab click runs while the tab is visible, so the jump
 * sticks. Initial alignment is instant, then repeated once the tab is shown.
 */

/** Paragraph hashes sit this far below the top of the viewport. */
export const PARAGRAPH_HASH_OFFSET_PX = 100;

/** How close a target must be to its reading line to count as aligned. */
export const HASH_ALIGN_TOLERANCE_PX = 48;

const LOAD_RETRY_DELAYS_MS = [0, 50, 300, 1000];
/** How long a late browser fragment scroll may still be corrected. */
const SCROLL_CORRECTION_WINDOW_MS = 1500;
const MAX_SCROLL_CORRECTIONS = 4;

export function hashScrollBehavior(animate: boolean): ScrollBehavior {
	if (!animate) return "auto";
	const reduceMotion = window.matchMedia?.(
		"(prefers-reduced-motion: reduce)",
	)?.matches;
	if (reduceMotion) return "auto";
	if (document.visibilityState !== "visible") return "auto";
	return "smooth";
}

/**
 * True when `el` is on the reading line. A zero box means layout has not run
 * (typical in a background tab), which is not "already at the target".
 */
export function isHashTargetAligned(el: HTMLElement, offsetPx: number): boolean {
	const rect = el.getBoundingClientRect();
	if (rect.width === 0 && rect.height === 0) return false;
	if (Math.abs(rect.top - offsetPx) <= HASH_ALIGN_TOLERANCE_PX) return true;
	const desiredTop = rect.top + window.scrollY - offsetPx;
	return desiredTop <= 0 && window.scrollY <= 8;
}

export interface InitialHashScrollOptions {
	align: () => void;
	aligned: () => boolean;
	/** Test hook. Production waits out the browser's post-load scroll reset. */
	loadRetryDelaysMs?: number[];
}

/**
 * Jump to the current hash now, and again if that jump is dropped.
 *
 * Later passes no-op once the target is in place, or once the reader scrolls.
 * A scroll that only the browser performed (fragment navigation, often short
 * of the reading line) is corrected. Becoming visible realigns a background
 * tab, which the reader cannot have scrolled.
 */
export function scheduleInitialHashScroll(
	options: InitialHashScrollOptions,
): () => void {
	let cancelled = false;
	let readerMoved = false;
	const timers: number[] = [];
	const later = (fn: () => void, ms: number) => {
		timers.push(window.setTimeout(fn, ms));
	};

	// A non-zero scrollY is not enough to mean the reader moved: the browser's
	// own fragment scroll also sets it, often a few pixels off our reading line.
	const onReaderMove = () => {
		readerMoved = true;
	};
	const onKey = (event: KeyboardEvent) => {
		if (
			event.key === "ArrowDown" ||
			event.key === "ArrowUp" ||
			event.key === "PageDown" ||
			event.key === "PageUp" ||
			event.key === "Home" ||
			event.key === "End" ||
			event.key === " "
		) {
			readerMoved = true;
		}
	};
	window.addEventListener("wheel", onReaderMove, { passive: true });
	window.addEventListener("touchmove", onReaderMove, { passive: true });
	window.addEventListener("pointerdown", onReaderMove, { passive: true });
	window.addEventListener("keydown", onKey);

	let correcting = false;
	const pass = () => {
		if (cancelled || readerMoved) return;
		if (options.aligned()) return;
		correcting = true;
		options.align();
		correcting = false;
	};

	const onLoad = () => {
		for (const ms of options.loadRetryDelaysMs ?? LOAD_RETRY_DELAYS_MS) {
			later(pass, ms);
		}
	};

	const onPageShow = () => pass();

	let onVisible: (() => void) | null = null;
	if (document.visibilityState !== "visible") {
		onVisible = () => {
			if (document.visibilityState !== "visible") return;
			document.removeEventListener("visibilitychange", onVisible!);
			onVisible = null;
			pass();
			later(pass, 0);
		};
		document.addEventListener("visibilitychange", onVisible);
	}

	// Fresh navigations apply the URL fragment after our first jump, which
	// leaves a new tab at the top when that fragment scroll is dropped. A
	// scroll the reader didn't cause, inside this window, is put back.
	let scrollCorrections = 0;
	const onScroll = () => {
		if (correcting || readerMoved || scrollCorrections >= MAX_SCROLL_CORRECTIONS) {
			return;
		}
		if (options.aligned()) return;
		scrollCorrections += 1;
		pass();
	};
	window.addEventListener("scroll", onScroll, { passive: true });
	later(() => {
		window.removeEventListener("scroll", onScroll);
	}, SCROLL_CORRECTION_WINDOW_MS);

	pass();
	window.requestAnimationFrame(() => {
		window.requestAnimationFrame(pass);
	});

	if (document.readyState === "complete") onLoad();
	else window.addEventListener("load", onLoad, { once: true });

	window.addEventListener("pageshow", onPageShow, { once: true });

	const fontsReady = document.fonts?.ready;
	if (fontsReady) {
		fontsReady.then(() => {
			if (performance.now() > SCROLL_CORRECTION_WINDOW_MS) return;
			pass();
		}).catch(() => {});
	}

	return () => {
		cancelled = true;
		for (const id of timers) window.clearTimeout(id);
		window.removeEventListener("scroll", onScroll);
		window.removeEventListener("wheel", onReaderMove);
		window.removeEventListener("touchmove", onReaderMove);
		window.removeEventListener("pointerdown", onReaderMove);
		window.removeEventListener("keydown", onKey);
		window.removeEventListener("load", onLoad);
		window.removeEventListener("pageshow", onPageShow);
		if (onVisible) document.removeEventListener("visibilitychange", onVisible);
	};
}
