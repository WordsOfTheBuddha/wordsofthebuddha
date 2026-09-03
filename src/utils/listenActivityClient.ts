import {
	LISTEN_ACTIVITY_KEY,
	LISTEN_ENGAGE_SECONDS,
	applyListenFlush,
	emptyListenActivity,
	ensureMinListenSeconds,
	isListenComplete,
	listenProgressDelta,
	recordListenSeconds,
	sanitizeListenActivity,
	shouldFlushListenActivity,
	type ListenActivityBuffer,
} from "./listenActivity";
import { localDayKey } from "./learningActivity";
import {
	flushLearningActivity,
	noteLearningEngagement,
} from "./learningActivityClient";
import { normalizeDiscourseSlug } from "./reviewRoomStats";

const READ_ITEMS_KEY = "offlineReadItems";

function storage(): Storage | null {
	if (typeof localStorage === "undefined") return null;
	return localStorage;
}

export function readListenActivityBuffer(): ListenActivityBuffer {
	const store = storage();
	if (!store) return emptyListenActivity();
	try {
		const raw = store.getItem(LISTEN_ACTIVITY_KEY);
		if (!raw) return emptyListenActivity();
		return sanitizeListenActivity(JSON.parse(raw));
	} catch {
		return emptyListenActivity();
	}
}

export function writeListenActivityBuffer(buffer: ListenActivityBuffer): void {
	const store = storage();
	if (!store) return;
	try {
		store.setItem(LISTEN_ACTIVITY_KEY, JSON.stringify(buffer));
	} catch {
		/* quota / private mode */
	}
}

/** Persist audio-progress seconds for a discourse (local buffer). */
export function noteListenSeconds(
	slug: string,
	deltaSeconds: number,
): ListenActivityBuffer {
	const key = normalizeDiscourseSlug(slug);
	const current = readListenActivityBuffer();
	const { buffer } = recordListenSeconds(current, key, deltaSeconds);
	writeListenActivityBuffer(buffer);
	return buffer;
}

/** Ensure a slug's stored seconds are at least `seconds` (completion backfill). */
export function noteListenAtLeast(
	slug: string,
	seconds: number,
): ListenActivityBuffer {
	const key = normalizeDiscourseSlug(slug);
	const current = readListenActivityBuffer();
	const { buffer } = ensureMinListenSeconds(current, key, seconds);
	writeListenActivityBuffer(buffer);
	return buffer;
}

/**
 * Merge the local listen buffer into the signed-in account.
 * No-ops when signed out. Batched — not called on every timeupdate.
 */
export async function flushListenActivity(): Promise<{
	signedIn: boolean;
	totalSeconds: number;
} | null> {
	const local = readListenActivityBuffer();
	if (!shouldFlushListenActivity(local, localDayKey())) {
		return {
			signedIn: Boolean(local.lastFlushedDay),
			totalSeconds: local.totalSeconds,
		};
	}

	try {
		const response = await fetch("/api/learning/listen", {
			method: "POST",
			credentials: "same-origin",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ bySlug: local.bySlug }),
		});
		if (response.status === 401) {
			return {
				signedIn: false,
				totalSeconds: local.totalSeconds,
			};
		}
		if (!response.ok) return null;
		const data = (await response.json()) as {
			success?: boolean;
			signedIn?: boolean;
			bySlug?: Record<string, number>;
			totalSeconds?: number;
		};
		if (!data.success || !data.signedIn) {
			return {
				signedIn: false,
				totalSeconds: local.totalSeconds,
			};
		}
		const remote = {
			bySlug:
				data.bySlug && typeof data.bySlug === "object" ? data.bySlug : {},
			totalSeconds:
				typeof data.totalSeconds === "number"
					? data.totalSeconds
					: local.totalSeconds,
		};
		const next = applyListenFlush(local, remote, localDayKey());
		writeListenActivityBuffer(next);
		return {
			signedIn: true,
			totalSeconds: next.totalSeconds,
		};
	} catch {
		return null;
	}
}

function writeOfflineRead(slug: string): void {
	const key = normalizeDiscourseSlug(slug);
	if (!key) return;
	const store = storage();
	if (!store) return;
	try {
		const items = JSON.parse(
			store.getItem(READ_ITEMS_KEY) || '{"pages":{}}',
		) as { pages?: Record<string, number> };
		const pages = items.pages && typeof items.pages === "object" ? items.pages : {};
		if (pages[key]) return;
		pages[key] = Math.floor(Date.now() / 60000);
		store.setItem(READ_ITEMS_KEY, JSON.stringify({ ...items, pages }));
	} catch {
		/* ignore */
	}
}

/**
 * Mark a discourse read from listen completion.
 * Always writes the offline cache; POSTs when signed in.
 */
export async function markDiscourseReadFromListen(slug: string): Promise<void> {
	const key = normalizeDiscourseSlug(slug);
	if (!key) return;
	writeOfflineRead(key);
	try {
		const response = await fetch(`/api/read/${encodeURIComponent(key)}`, {
			method: "POST",
			credentials: "same-origin",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ isRead: true }),
		});
		// 401 = anonymous; local write already done.
		if (!response.ok && response.status !== 401) {
			/* keep local */
		}
	} catch {
		/* offline — local write stands */
	}
}

const OFFLINE_READ_SYNC_CAP = 100;

/**
 * Push locally cached mark-as-read pages (e.g. from anonymous listen
 * completion) up to the signed-in account. Best-effort; capped.
 */
export async function flushOfflineReadPages(): Promise<number> {
	const store = storage();
	if (!store) return 0;
	let pages: Record<string, number> = {};
	try {
		const items = JSON.parse(
			store.getItem(READ_ITEMS_KEY) || '{"pages":{}}',
		) as { pages?: Record<string, number> };
		if (items.pages && typeof items.pages === "object") pages = items.pages;
	} catch {
		return 0;
	}
	const slugs = Object.keys(pages)
		.map((slug) => normalizeDiscourseSlug(slug))
		.filter(Boolean)
		.slice(0, OFFLINE_READ_SYNC_CAP);
	if (slugs.length === 0) return 0;

	let synced = 0;
	for (const slug of slugs) {
		try {
			const response = await fetch(`/api/read/${encodeURIComponent(slug)}`, {
				method: "POST",
				credentials: "same-origin",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ isRead: true }),
			});
			if (response.status === 401) return synced;
			if (response.ok) synced += 1;
		} catch {
			break;
		}
	}
	return synced;
}

export type ListenTrackingSession = {
	/** Call from audio `timeupdate` while playing. */
	onTimeUpdate: (opts: {
		slug: string;
		currentTime: number;
		duration: number;
		hasParagraphRange: boolean;
		paused: boolean;
	}) => void;
	/**
	 * Flush remaining progress for the current track.
	 * Pass `ended: true` only for natural completion (`audio.ended`).
	 * Leaving mid-track (advance / pagehide) must omit `ended` so we don't
	 * mark unfinished discourses as read.
	 */
	onTrackBoundary: (opts: {
		slug: string;
		currentTime: number;
		duration: number;
		hasParagraphRange: boolean;
		ended?: boolean;
	}) => void;
	/** Flush pending seconds + remote merge. */
	flush: () => void;
	/** Reset progress cursor when the track source changes. */
	resetCursor: () => void;
};

/**
 * Session helper for listen-mode: accumulate minutes, credit learning days
 * after {@link LISTEN_ENGAGE_SECONDS}, and mark full discourses read.
 */
export function createListenTrackingSession(): ListenTrackingSession {
	let lastTime = Number.NaN;
	let sessionSeconds = 0;
	let engaged = false;
	const markedSlugs = new Set<string>();
	let flushTimer: number | null = null;

	const scheduleFlush = () => {
		if (flushTimer != null) return;
		flushTimer = window.setTimeout(() => {
			flushTimer = null;
			void flushListenActivity();
		}, 4000);
	};

	const maybeEngage = () => {
		if (engaged || sessionSeconds < LISTEN_ENGAGE_SECONDS) return;
		engaged = true;
		noteLearningEngagement();
		void flushLearningActivity();
	};

	const maybeComplete = (opts: {
		slug: string;
		currentTime: number;
		duration: number;
		hasParagraphRange: boolean;
		ended?: boolean;
	}) => {
		const key = normalizeDiscourseSlug(opts.slug);
		if (!key || markedSlugs.has(key)) return;
		if (
			!isListenComplete({
				currentTime: opts.currentTime,
				duration: opts.duration,
				hasParagraphRange: opts.hasParagraphRange,
				ended: opts.ended,
			})
		) {
			return;
		}
		markedSlugs.add(key);
		void markDiscourseReadFromListen(key);
	};

	return {
		resetCursor() {
			lastTime = Number.NaN;
		},
		onTimeUpdate(opts) {
			if (opts.paused) {
				lastTime = opts.currentTime;
				return;
			}
			const delta = listenProgressDelta(lastTime, opts.currentTime);
			lastTime = opts.currentTime;
			if (delta > 0) {
				noteListenSeconds(opts.slug, delta);
				sessionSeconds += delta;
				maybeEngage();
				scheduleFlush();
			}
			maybeComplete(opts);
		},
		onTrackBoundary(opts) {
			const delta = listenProgressDelta(lastTime, opts.currentTime);
			if (delta > 0) {
				noteListenSeconds(opts.slug, delta);
				sessionSeconds += delta;
				maybeEngage();
			}
			// On natural end, credit at least currentTime so a finished
			// discourse always contributes minutes even if ticks were lost.
			if (opts.ended && opts.currentTime > 0) {
				noteListenAtLeast(opts.slug, opts.currentTime);
			}
			lastTime = Number.NaN;
			maybeComplete(opts);
			void flushListenActivity();
			if (opts.ended || engaged) void flushLearningActivity();
		},
		flush() {
			if (flushTimer != null) {
				window.clearTimeout(flushTimer);
				flushTimer = null;
			}
			void flushListenActivity();
		},
	};
}
