/** Local + remote buffer for “days spent learning”. */

export const LEARNING_ACTIVITY_KEY = "learning-activity-v1";

export type LearningActivityBuffer = {
	/** Local calendar days with engaged reading, keyed as YYYY-MM-DD. */
	days: Record<string, true>;
	/** True when local has changes not yet acknowledged by the server. */
	pendingSync: boolean;
	/** Local day of the last successful signed-in flush. */
	lastFlushedDay?: string;
};

export type LearningActivitySummary = {
	days: Record<string, true>;
	dayCount: number;
};

const MAX_DAY_KEYS = 4000;

export function localDayKey(date: Date = new Date()): string {
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, "0");
	const day = String(date.getDate()).padStart(2, "0");
	return `${year}-${month}-${day}`;
}

export function emptyLearningActivity(): LearningActivityBuffer {
	return { days: {}, pendingSync: false };
}

export function sanitizeDayKey(raw: unknown): string | null {
	if (typeof raw !== "string") return null;
	const key = raw.trim();
	const match = key.match(/^(\d{4})-(\d{2})-(\d{2})$/);
	if (!match) return null;
	const year = Number(match[1]);
	const month = Number(match[2]);
	const day = Number(match[3]);
	if (month < 1 || month > 12 || day < 1 || day > 31) return null;
	const probe = new Date(year, month - 1, day);
	if (
		probe.getFullYear() !== year ||
		probe.getMonth() !== month - 1 ||
		probe.getDate() !== day
	) {
		return null;
	}
	return key;
}

export function sanitizeDaysMap(raw: unknown): Record<string, true> {
	const out: Record<string, true> = {};
	if (!raw || typeof raw !== "object") return out;
	for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
		const day = sanitizeDayKey(key);
		if (!day) continue;
		if (value === true || value === 1 || value === "1") out[day] = true;
		if (Object.keys(out).length >= MAX_DAY_KEYS) break;
	}
	return out;
}

export function sanitizeLearningActivity(raw: unknown): LearningActivityBuffer {
	if (!raw || typeof raw !== "object") return emptyLearningActivity();
	const record = raw as Record<string, unknown>;
	const days = sanitizeDaysMap(record.days);
	const lastFlushedDay = sanitizeDayKey(record.lastFlushedDay) || undefined;
	return {
		days,
		pendingSync: record.pendingSync === true,
		...(lastFlushedDay ? { lastFlushedDay } : {}),
	};
}

export function countLearningDays(
	days: Record<string, true> | null | undefined,
): number {
	if (!days) return 0;
	return Object.keys(days).length;
}

export function toLearningSummary(
	days: Record<string, true>,
): LearningActivitySummary {
	return { days, dayCount: countLearningDays(days) };
}

/** Union of day maps; newest keys win only in the sense of presence. */
export function mergeLearningDays(
	left: Record<string, true>,
	right: Record<string, true>,
): Record<string, true> {
	return { ...left, ...right };
}

/**
 * Mark today as a learning day. Idempotent for the same local day.
 * Returns the updated buffer and whether this call newly set the day.
 */
export function recordLearningDay(
	buffer: LearningActivityBuffer,
	day: string = localDayKey(),
): { buffer: LearningActivityBuffer; newlyRecorded: boolean } {
	const key = sanitizeDayKey(day);
	if (!key) return { buffer, newlyRecorded: false };
	if (buffer.days[key]) {
		return { buffer, newlyRecorded: false };
	}
	return {
		buffer: {
			...buffer,
			days: { ...buffer.days, [key]: true },
			pendingSync: true,
		},
		newlyRecorded: true,
	};
}

/** After a successful server merge, adopt the union and clear the pending flag. */
export function applyLearningFlush(
	local: LearningActivityBuffer,
	remoteDays: Record<string, true>,
	flushedDay: string = localDayKey(),
): LearningActivityBuffer {
	const day = sanitizeDayKey(flushedDay) || localDayKey();
	return {
		days: mergeLearningDays(local.days, remoteDays),
		pendingSync: false,
		lastFlushedDay: day,
	};
}

export function shouldFlushLearningActivity(
	buffer: LearningActivityBuffer,
	today: string = localDayKey(),
): boolean {
	if (countLearningDays(buffer.days) === 0) return false;
	if (buffer.pendingSync) return true;
	const todayKey = sanitizeDayKey(today);
	if (!todayKey) return false;
	return buffer.lastFlushedDay !== todayKey;
}

export function learningDaysLabel(dayCount: number): string {
	if (dayCount <= 0) return "";
	if (dayCount === 1) return "Reading on 1 day";
	return `Reading on ${dayCount} days`;
}

export type LearningDayDot = {
	key: string;
	active: boolean;
};

/** Shift a local calendar day by `delta` days (negative = past). */
export function shiftLocalDayKey(dayKey: string, delta: number): string | null {
	const key = sanitizeDayKey(dayKey);
	if (!key) return null;
	const [year, month, day] = key.split("-").map(Number);
	const date = new Date(year, month - 1, day);
	date.setDate(date.getDate() + delta);
	return localDayKey(date);
}

/**
 * Oldest → newest strip of the last `length` local calendar days.
 * Used for a quiet GitHub-style activity row on the dashboard.
 */
export function recentLearningDayStrip(
	days: Record<string, true> | null | undefined,
	length = 28,
	endDay: string = localDayKey(),
): LearningDayDot[] {
	const end = sanitizeDayKey(endDay) || localDayKey();
	const startOffset = -(Math.max(1, length) - 1);
	const out: LearningDayDot[] = [];
	for (let offset = startOffset; offset <= 0; offset++) {
		const key = shiftLocalDayKey(end, offset);
		if (!key) continue;
		out.push({ key, active: Boolean(days?.[key]) });
	}
	return out;
}

const MINUTE_MS = 60_000;

/**
 * Derive learning-day keys from mark-as-read timestamps (`pages` map values
 * are minutes since epoch). Uses the runtime's local calendar so a Review Room
 * visit in the reader's browser backfills the days they actually marked.
 */
export function learningDaysFromReadMinutes(
	pages: Record<string, unknown> | null | undefined,
	dayKeyFn: (ms: number) => string = (ms) => localDayKey(new Date(ms)),
): Record<string, true> {
	const out: Record<string, true> = {};
	if (!pages) return out;
	for (const raw of Object.values(pages)) {
		if (typeof raw !== "number" || !Number.isFinite(raw) || raw <= 0) continue;
		const day = sanitizeDayKey(dayKeyFn(raw * MINUTE_MS));
		if (!day) continue;
		out[day] = true;
		if (Object.keys(out).length >= MAX_DAY_KEYS) break;
	}
	return out;
}

/** Merge historical mark-as-read days into a learning buffer. */
export function seedLearningDaysFromReads(
	buffer: LearningActivityBuffer,
	pages: Record<string, unknown> | null | undefined,
	dayKeyFn?: (ms: number) => string,
): LearningActivityBuffer {
	const fromReads = learningDaysFromReadMinutes(pages, dayKeyFn);
	if (Object.keys(fromReads).length === 0) return buffer;
	const days = mergeLearningDays(buffer.days, fromReads);
	const added = Object.keys(days).length > Object.keys(buffer.days).length;
	if (!added) return buffer;
	return { ...buffer, days, pendingSync: true };
}
