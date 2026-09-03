/** Local + remote buffer for minutes spent listening to discourses. */

export const LISTEN_ACTIVITY_KEY = "listen-activity-v1";

export type ListenActivityBuffer = {
	/** Seconds of audio progress per discourse slug (audio-time, not wall-clock). */
	bySlug: Record<string, number>;
	/** Sum of bySlug; kept for cheap reads. */
	totalSeconds: number;
	/** True when local has changes not yet acknowledged by the server. */
	pendingSync: boolean;
	/** Local day of the last successful signed-in flush. */
	lastFlushedDay?: string;
};

export type ListenActivitySummary = {
	bySlug: Record<string, number>;
	totalSeconds: number;
};

const MAX_SLUGS = 4000;
/** Ignore currentTime jumps larger than this (seek / track swap). */
export const LISTEN_SEEK_JUMP_S = 2.5;
/** Count a discourse complete near the end (or on `ended`). */
export const LISTEN_COMPLETE_RATIO = 0.95;
/** Credit a learning day after this much real audio progress in a session. */
export const LISTEN_ENGAGE_SECONDS = 60;

export function emptyListenActivity(): ListenActivityBuffer {
	return { bySlug: {}, totalSeconds: 0, pendingSync: false };
}

function sanitizeSlug(raw: unknown): string | null {
	if (typeof raw !== "string") return null;
	const slug = raw.replace(/^\/+/, "").split("?")[0].split("#")[0].trim();
	if (!slug || slug.length > 80) return null;
	if (!/^[a-z0-9][a-z0-9._-]*$/i.test(slug)) return null;
	return slug;
}

/** Non-negative seconds at 0.1s precision (keeps timeupdate deltas alive). */
function sanitizeSeconds(raw: unknown): number {
	if (typeof raw !== "number" || !Number.isFinite(raw) || raw < 0) return 0;
	return Math.round(raw * 10) / 10;
}

export function sanitizeBySlug(raw: unknown): Record<string, number> {
	const out: Record<string, number> = {};
	if (!raw || typeof raw !== "object") return out;
	for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
		const slug = sanitizeSlug(key);
		const seconds = sanitizeSeconds(value);
		if (!slug || seconds <= 0) continue;
		out[slug] = seconds;
		if (Object.keys(out).length >= MAX_SLUGS) break;
	}
	return out;
}

export function sumListenSeconds(bySlug: Record<string, number>): number {
	let total = 0;
	for (const seconds of Object.values(bySlug)) {
		total += sanitizeSeconds(seconds);
	}
	return total;
}

export function sanitizeListenActivity(raw: unknown): ListenActivityBuffer {
	if (!raw || typeof raw !== "object") return emptyListenActivity();
	const record = raw as Record<string, unknown>;
	const bySlug = sanitizeBySlug(record.bySlug);
	const totalFromMap = sumListenSeconds(bySlug);
	const totalSeconds = Math.max(
		totalFromMap,
		sanitizeSeconds(record.totalSeconds),
	);
	const lastFlushedDay =
		typeof record.lastFlushedDay === "string" &&
		/^\d{4}-\d{2}-\d{2}$/.test(record.lastFlushedDay)
			? record.lastFlushedDay
			: undefined;
	return {
		bySlug,
		totalSeconds: totalFromMap > 0 ? totalFromMap : totalSeconds,
		pendingSync: record.pendingSync === true,
		...(lastFlushedDay ? { lastFlushedDay } : {}),
	};
}

/** Per-slug max (listening only grows), then recompute total. */
export function mergeListenBySlug(
	left: Record<string, number>,
	right: Record<string, number>,
): Record<string, number> {
	const out: Record<string, number> = { ...left };
	for (const [slug, seconds] of Object.entries(right)) {
		const key = sanitizeSlug(slug);
		const value = sanitizeSeconds(seconds);
		if (!key || value <= 0) continue;
		out[key] = Math.max(out[key] || 0, value);
		if (Object.keys(out).length >= MAX_SLUGS) break;
	}
	return out;
}

export function toListenSummary(
	bySlug: Record<string, number>,
): ListenActivitySummary {
	const clean = sanitizeBySlug(bySlug);
	return { bySlug: clean, totalSeconds: sumListenSeconds(clean) };
}

/**
 * Add audio-progress seconds for a slug. `deltaSeconds` should already be
 * seek-filtered (small forward steps only). Fractional deltas are kept —
 * flooring here would drop every `timeupdate` tick (~0.25s).
 */
export function recordListenSeconds(
	buffer: ListenActivityBuffer,
	slug: string,
	deltaSeconds: number,
): { buffer: ListenActivityBuffer; added: number } {
	const key = sanitizeSlug(slug);
	const delta = sanitizeSeconds(deltaSeconds);
	if (!key || delta <= 0) return { buffer, added: 0 };
	const prev = buffer.bySlug[key] || 0;
	const bySlug = {
		...buffer.bySlug,
		[key]: sanitizeSeconds(prev + delta),
	};
	return {
		buffer: {
			...buffer,
			bySlug,
			totalSeconds: sumListenSeconds(bySlug),
			pendingSync: true,
		},
		added: delta,
	};
}

/**
 * Raise a slug's total to at least `seconds` (e.g. on natural `ended`, when
 * we know playback reached that position). Does not lower an existing value.
 */
export function ensureMinListenSeconds(
	buffer: ListenActivityBuffer,
	slug: string,
	seconds: number,
): { buffer: ListenActivityBuffer; raised: boolean } {
	const key = sanitizeSlug(slug);
	const min = sanitizeSeconds(seconds);
	if (!key || min <= 0) return { buffer, raised: false };
	const prev = buffer.bySlug[key] || 0;
	if (prev >= min) return { buffer, raised: false };
	const bySlug = { ...buffer.bySlug, [key]: min };
	return {
		buffer: {
			...buffer,
			bySlug,
			totalSeconds: sumListenSeconds(bySlug),
			pendingSync: true,
		},
		raised: true,
	};
}

export function applyListenFlush(
	local: ListenActivityBuffer,
	remote: ListenActivitySummary,
	flushedDay: string,
): ListenActivityBuffer {
	const bySlug = mergeListenBySlug(local.bySlug, remote.bySlug);
	return {
		bySlug,
		totalSeconds: sumListenSeconds(bySlug),
		pendingSync: false,
		lastFlushedDay: flushedDay,
	};
}

export function shouldFlushListenActivity(
	buffer: ListenActivityBuffer,
	today: string,
): boolean {
	if (buffer.totalSeconds <= 0 && Object.keys(buffer.bySlug).length === 0) {
		return false;
	}
	if (buffer.pendingSync) return true;
	return buffer.lastFlushedDay !== today;
}

/**
 * True when playback has reached the end of a full discourse (not a
 * paragraph excerpt). Prefer the `ended` event; ratio is a resume fallback.
 */
export function isListenComplete(opts: {
	currentTime: number;
	duration: number;
	hasParagraphRange: boolean;
	ended?: boolean;
}): boolean {
	if (opts.hasParagraphRange) return false;
	if (opts.ended) return true;
	const duration = opts.duration;
	const time = opts.currentTime;
	if (!Number.isFinite(duration) || duration <= 0) return false;
	if (!Number.isFinite(time) || time <= 0) return false;
	return time / duration >= LISTEN_COMPLETE_RATIO;
}

/** Forward audio progress only; drops seeks and rewinds. */
export function listenProgressDelta(
	previousTime: number,
	currentTime: number,
	maxJump: number = LISTEN_SEEK_JUMP_S,
): number {
	if (!Number.isFinite(previousTime) || !Number.isFinite(currentTime)) {
		return 0;
	}
	const delta = currentTime - previousTime;
	if (delta <= 0 || delta > maxJump) return 0;
	return delta;
}

export type ListenStatDisplay = {
	value: string;
	label: string;
};

/** Overview tile copy. Null when under one full minute. */
export function formatListenStat(
	totalSeconds: number,
): ListenStatDisplay | null {
	const minutes = Math.floor(sanitizeSeconds(totalSeconds) / 60);
	if (minutes < 1) return null;
	if (minutes < 60) {
		return {
			value: String(minutes),
			label: minutes === 1 ? "min listened" : "mins listened",
		};
	}
	const hours = Math.floor(minutes / 60);
	const rem = minutes % 60;
	return {
		value: rem === 0 ? `${hours}h` : `${hours}h ${rem}m`,
		label: "listened",
	};
}
