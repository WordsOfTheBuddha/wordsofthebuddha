import {
	LEARNING_ACTIVITY_KEY,
	applyLearningFlush,
	emptyLearningActivity,
	localDayKey,
	recordLearningDay,
	sanitizeLearningActivity,
	seedLearningDaysFromReads,
	shouldFlushLearningActivity,
	type LearningActivityBuffer,
} from "./learningActivity";

const ENGAGE_MS = 60_000;
const SCROLL_RATIO = 0.5;

function storage(): Storage | null {
	if (typeof localStorage === "undefined") return null;
	return localStorage;
}

export function readLearningActivityBuffer(): LearningActivityBuffer {
	const store = storage();
	if (!store) return emptyLearningActivity();
	try {
		const raw = store.getItem(LEARNING_ACTIVITY_KEY);
		if (!raw) return emptyLearningActivity();
		return sanitizeLearningActivity(JSON.parse(raw));
	} catch {
		return emptyLearningActivity();
	}
}

export function writeLearningActivityBuffer(
	buffer: LearningActivityBuffer,
): void {
	const store = storage();
	if (!store) return;
	try {
		store.setItem(LEARNING_ACTIVITY_KEY, JSON.stringify(buffer));
	} catch {
		/* quota / private mode */
	}
}

/** Record today's engaged reading and optionally flush to the account. */
export function noteLearningEngagement(): LearningActivityBuffer {
	const current = readLearningActivityBuffer();
	const { buffer } = recordLearningDay(current, localDayKey());
	writeLearningActivityBuffer(buffer);
	return buffer;
}

/**
 * Merge the local day buffer into the signed-in account.
 * No-ops when signed out. At most ~1 write/day while continuously signed in,
 * plus a full merge whenever pendingSync is set (e.g. after anonymous reading).
 */
export async function flushLearningActivity(): Promise<{
	signedIn: boolean;
	dayCount: number;
	days: Record<string, true>;
} | null> {
	const local = readLearningActivityBuffer();
	if (!shouldFlushLearningActivity(local)) {
		// Nothing to upload; caller may still use the local day count.
		return {
			signedIn: Boolean(local.lastFlushedDay),
			dayCount: Object.keys(local.days).length,
			days: local.days,
		};
	}

	try {
		const response = await fetch("/api/learning/activity", {
			method: "POST",
			credentials: "same-origin",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ days: Object.keys(local.days) }),
		});
		if (response.status === 401) {
			return {
				signedIn: false,
				dayCount: Object.keys(local.days).length,
				days: local.days,
			};
		}
		if (!response.ok) return null;
		const data = (await response.json()) as {
			success?: boolean;
			signedIn?: boolean;
			days?: Record<string, true>;
			dayCount?: number;
		};
		if (!data.success || !data.signedIn) {
			return {
				signedIn: false,
				dayCount: Object.keys(local.days).length,
				days: local.days,
			};
		}
		const remoteDays =
			data.days && typeof data.days === "object" ? data.days : {};
		const next = applyLearningFlush(local, remoteDays, localDayKey());
		writeLearningActivityBuffer(next);
		return {
			signedIn: true,
			dayCount:
				typeof data.dayCount === "number"
					? data.dayCount
					: Object.keys(next.days).length,
			days: next.days,
		};
	} catch {
		return null;
	}
}

function contentScrollProgress(): number {
	const content =
		document.querySelector("article") || document.querySelector("main");
	if (!content) return 0;
	const top = (content as HTMLElement).offsetTop;
	const height = (content as HTMLElement).offsetHeight;
	if (height <= 0) return 0;
	const viewportBottom = window.scrollY + window.innerHeight;
	return Math.min(1, Math.max(0, (viewportBottom - top) / height));
}

/**
 * Seed the local buffer from historical mark-as-read timestamps (local TZ),
 * credit today as a signed-in reading day, then flush to the account.
 * Safe to call on Review Room load and right after sign-in.
 */
export async function syncLearningDaysFromReadPages(
	pages: Record<string, unknown> | null | undefined,
): Promise<{
	signedIn: boolean;
	dayCount: number;
	days: Record<string, true>;
} | null> {
	// Visiting the Review Room / signing in counts as the first day.
	noteLearningEngagement();
	const seeded = seedLearningDaysFromReads(
		readLearningActivityBuffer(),
		pages,
	);
	writeLearningActivityBuffer(seeded);
	return flushLearningActivity();
}

/**
 * On discourse pages (where Mark as read exists): count a learning day after
 * 60s on the page or scrolling halfway through the article. Flushes when signed in.
 */
export function initDiscourseLearningActivity(): void {
	if (typeof window === "undefined") return;
	if ((window as Window & { __learningActivityInit?: boolean }).__learningActivityInit) {
		return;
	}
	(window as Window & { __learningActivityInit?: boolean }).__learningActivityInit =
		true;

	const started = Date.now();
	let recorded = false;

	const maybeRecord = () => {
		if (recorded) return;
		const longEnough = Date.now() - started >= ENGAGE_MS;
		const scrolled = contentScrollProgress() >= SCROLL_RATIO;
		if (!longEnough && !scrolled) return;
		recorded = true;
		noteLearningEngagement();
		void flushLearningActivity();
		window.removeEventListener("scroll", onScroll);
	};

	const onScroll = () => {
		maybeRecord();
	};

	window.addEventListener("scroll", onScroll, { passive: true });
	window.setTimeout(maybeRecord, ENGAGE_MS);
	// Catch already-scrolled restores (bfcache / anchor).
	window.setTimeout(maybeRecord, 250);
}
