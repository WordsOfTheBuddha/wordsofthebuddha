/** Local + remote buffer for “days spent learning”. */

import { expandSlugToDiscourseIds } from "./slugDiscourseCount";

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
	if (dayCount === 1) return "Learning on 1 day";
	return `Learning on ${dayCount} days`;
}

/** Category + unit under the Review Room learning-days stat. */
export function learningDaysStatKind(): string {
	return "Learning";
}

export function learningDaysStatUnit(): string {
	return "days";
}

/** Consecutive engaged days ending today, or yesterday if today is still empty. */
export function currentLearningStreak(
	days: Record<string, true> | null | undefined,
	today: string = localDayKey(),
): number {
	const map = days || {};
	const todayKey = sanitizeDayKey(today) || localDayKey();
	let cursor = map[todayKey] ? todayKey : shiftLocalDayKey(todayKey, -1);
	if (!cursor || !map[cursor]) return 0;
	let count = 0;
	while (cursor && map[cursor]) {
		count += 1;
		cursor = shiftLocalDayKey(cursor, -1);
	}
	return count;
}

export function currentLearningStreakLabel(dayCount: number): string {
	if (dayCount <= 0) return "";
	return dayCount === 1 ? "1-day streak" : `${dayCount}-day streak`;
}

/** A one-day run is just today (or yesterday); a streak starts at two days. */
export const LEARNING_STREAK_MIN = 2;

export function shouldShowLearningStreak(dayCount: number): boolean {
	return dayCount >= LEARNING_STREAK_MIN;
}

export type LearningDayDot = {
	key: string;
	active: boolean;
	/** Discourses marked as read on this local calendar day. */
	reads: number;
	/** Audio-progress seconds credited to this local calendar day. */
	listenSeconds: number;
};

/** GitHub-style fill: idle, some activity, busy (>=3 reads), fullest (>=10). */
export type LearningDayEmphasis = "none" | "some" | "more" | "most";

/** Shift a local calendar day by `delta` days (negative = past). */
export function shiftLocalDayKey(dayKey: string, delta: number): string | null {
	const key = sanitizeDayKey(dayKey);
	if (!key) return null;
	const [year, month, day] = key.split("-").map(Number);
	const date = new Date(year, month - 1, day);
	date.setDate(date.getDate() + delta);
	return localDayKey(date);
}

/** Dashboard activity grid: 30 days in even rows of 10. */
export const LEARNING_DAY_STRIP_LENGTH = 30;
export const LEARNING_DAY_STRIP_ROW = 10;

/**
 * Oldest → newest strip of the last `length` local calendar days.
 * Used for a quiet GitHub-style activity grid on the dashboard.
 */
export function recentLearningDayStrip(
	days: Record<string, true> | null | undefined,
	length = LEARNING_DAY_STRIP_LENGTH,
	endDay: string = localDayKey(),
): LearningDayDot[] {
	const end = sanitizeDayKey(endDay) || localDayKey();
	const startOffset = -(Math.max(1, length) - 1);
	const out: LearningDayDot[] = [];
	for (let offset = startOffset; offset <= 0; offset++) {
		const key = shiftLocalDayKey(end, offset);
		if (!key) continue;
		out.push({
			key,
			active: Boolean(days?.[key]),
			reads: 0,
			listenSeconds: 0,
		});
	}
	return out;
}

/** Split the strip into even rows (10 days each by default). */
export function groupLearningDayStrip(
	dots: readonly LearningDayDot[],
	rowSize = LEARNING_DAY_STRIP_ROW,
): LearningDayDot[][] {
	const size = Math.max(1, Math.floor(rowSize));
	const rows: LearningDayDot[][] = [];
	for (let i = 0; i < dots.length; i += size) {
		rows.push(dots.slice(i, i + size));
	}
	return rows;
}

/**
 * Dashboard grid display: chronological last-N days, but when every active day
 * sits in a contiguous block at the end (new reader or returning after a gap),
 * left-align that block so the streak starts top-left instead of bottom-right.
 */
export function learningDayStripForDisplay(
	dots: readonly LearningDayDot[],
): LearningDayDot[] {
	if (dots.length === 0) return [];
	const activeIndices: number[] = [];
	for (let i = 0; i < dots.length; i++) {
		if (dots[i]?.active) activeIndices.push(i);
	}
	if (activeIndices.length === 0) return [...dots];

	const first = activeIndices[0]!;
	const last = activeIndices[activeIndices.length - 1]!;
	const contiguous = last - first + 1 === activeIndices.length;
	const suffix = first > 0 && contiguous && last === dots.length - 1;
	if (!suffix) return [...dots];

	const active = dots.filter((dot) => dot.active);
	const inactive = dots.filter((dot) => !dot.active);
	return [...active, ...inactive];
}

const MINUTE_MS = 60_000;

function activitySlugKey(raw: string): string {
	return raw.replace(/^\/+/, "").split("?")[0].split("#")[0].trim().toLowerCase();
}

/** Count mark-as-read timestamps per local calendar day (unique slugs, earliest stamp). */
export function readsByDayFromReadMinutes(
	pages: Record<string, unknown> | null | undefined,
	dayKeyFn: (ms: number) => string = (ms) => localDayKey(new Date(ms)),
): Record<string, number> {
	const earliestBySlug: Record<string, { day: string; minutes: number }> = {};
	if (!pages) return {};
	for (const [rawSlug, raw] of Object.entries(pages)) {
		if (typeof raw !== "number" || !Number.isFinite(raw) || raw <= 0) continue;
		const day = sanitizeDayKey(dayKeyFn(raw * MINUTE_MS));
		if (!day) continue;
		const fileSlug = activitySlugKey(rawSlug) || rawSlug;
		for (const id of expandSlugToDiscourseIds(fileSlug)) {
			const prev = earliestBySlug[id];
			if (!prev || raw < prev.minutes) {
				earliestBySlug[id] = { day, minutes: raw };
			}
		}
	}
	const out: Record<string, number> = {};
	for (const { day } of Object.values(earliestBySlug)) {
		out[day] = (out[day] || 0) + 1;
	}
	return out;
}

export function withLearningDayActivity(
	dots: readonly LearningDayDot[],
	readsByDay: Record<string, number> | null | undefined,
	listenSecondsByDay: Record<string, number> | null | undefined,
): LearningDayDot[] {
	return dots.map((dot) => ({
		...dot,
		reads: Math.max(0, Math.floor(readsByDay?.[dot.key] || 0)),
		listenSeconds: Math.max(0, listenSecondsByDay?.[dot.key] || 0),
	}));
}

/** Last-N-day strip with suffix-streak display + per-day read/listen detail. */
export function overviewLearningDayStrip(
	days: Record<string, true> | null | undefined,
	readsByDay: Record<string, number> | null | undefined,
	listenSecondsByDay: Record<string, number> | null | undefined,
	endDay?: string,
): LearningDayDot[] {
	return withLearningDayActivity(
		learningDayStripForDisplay(recentLearningDayStrip(days, undefined, endDay)),
		readsByDay,
		listenSecondsByDay,
	);
}

export function learningDayEmphasis(
	dot: Pick<LearningDayDot, "active" | "reads">,
): LearningDayEmphasis {
	const reads = dot.reads || 0;
	if (reads >= 10) return "most";
	if (reads >= 3) return "more";
	if (dot.active || reads > 0) return "some";
	return "none";
}

export function formatLearningDayDate(dayKey: string): string {
	const key = sanitizeDayKey(dayKey);
	if (!key) return "";
	const [year, month, day] = key.split("-").map(Number);
	const date = new Date(year, month - 1, day);
	return date.toLocaleDateString("en-GB", {
		weekday: "short",
		day: "numeric",
		month: "short",
	});
}

function listenMinutesLabel(seconds: number): string {
	const minutes = Math.floor(Math.max(0, seconds) / 60);
	if (minutes < 1) return "";
	return minutes === 1 ? "1 min listened" : `${minutes} mins listened`;
}

function readsLabel(reads: number): string {
	if (reads <= 0) return "";
	return reads === 1 ? "1 discourse read" : `${reads} discourses read`;
}

/**
 * Hover/tap copy for a day with activity. Empty when the cell should stay quiet.
 */
export function learningDayDetailLabel(dot: LearningDayDot): string {
	const emphasis = learningDayEmphasis(dot);
	if (emphasis === "none") return "";
	const parts = [readsLabel(dot.reads), listenMinutesLabel(dot.listenSeconds)].filter(
		Boolean,
	);
	const activity =
		parts.length > 0 ? parts.join(", ") : "Engaged with the teachings";
	const date = formatLearningDayDate(dot.key);
	return date ? `${date}: ${activity}` : activity;
}

export function learningDayDotClassName(dot: LearningDayDot): string {
	const emphasis = learningDayEmphasis(dot);
	if (emphasis === "none") return "learning-day-dot";
	return `learning-day-dot active ${emphasis}`;
}

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
