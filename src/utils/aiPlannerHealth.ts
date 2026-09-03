/**
 * In-process health / cooldown for Ask planner models.
 *
 * Free OpenRouter models often 429 or time out in bursts. Remembering that for
 * a few minutes lets later Asks skip dead models and reach a working one faster.
 * State is per Node process (lost on cold start) — good enough for latency.
 */

/** Failures inside this window count toward a cooldown. */
export const PLANNER_FAILURE_WINDOW_MS = 5 * 60_000;
/** How long to skip a model after it trips. */
export const PLANNER_COOLDOWN_MS = 10 * 60_000;
/** Failures required inside the window before cooldown. */
export const PLANNER_FAILURES_BEFORE_COOLDOWN = 2;

export interface PlannerModelHealthEntry {
	/** Recent failure timestamps (ms). */
	failures: number[];
	/** Skip until this time (ms), if set. */
	cooldownUntil?: number;
}

export type PlannerHealthClock = () => number;

export interface PlannerModelHealthStore {
	get(modelId: string): PlannerModelHealthEntry | undefined;
	set(modelId: string, entry: PlannerModelHealthEntry): void;
	delete(modelId: string): void;
	clear(): void;
}

function normalizeModelId(modelId: string): string {
	return modelId.trim();
}

function pruneFailures(
	failures: readonly number[],
	now: number,
	windowMs: number,
): number[] {
	const cut = now - windowMs;
	return failures.filter((at) => at >= cut);
}

/**
 * Errors that mean “this model is unhealthy right now” (retry another).
 * Auth / bad-request failures are not recorded — they won’t clear on their own.
 */
export function shouldRecordPlannerFailure(error: unknown): boolean {
	const status =
		typeof error === "object" &&
		error &&
		"status" in error &&
		typeof (error as { status?: unknown }).status === "number"
			? (error as { status: number }).status
			: 0;
	if (status === 401 || status === 400) return false;
	if (
		status === 403 ||
		status === 404 ||
		status === 408 ||
		status === 429 ||
		status === 502 ||
		status === 503
	) {
		return true;
	}
	const message = error instanceof Error ? error.message : String(error || "");
	if (error instanceof DOMException && error.name === "TimeoutError") return true;
	return /timeout|aborted|AbortError|rate.?limit|RESOURCE_EXHAUSTED|unavailable|overloaded|temporar/i.test(
		message,
	);
}

export class PlannerModelHealth {
	private readonly store: PlannerModelHealthStore;
	private readonly now: PlannerHealthClock;
	private readonly failureWindowMs: number;
	private readonly cooldownMs: number;
	private readonly failuresBeforeCooldown: number;

	constructor(options?: {
		store?: PlannerModelHealthStore;
		now?: PlannerHealthClock;
		failureWindowMs?: number;
		cooldownMs?: number;
		failuresBeforeCooldown?: number;
	}) {
		this.store = options?.store ?? createMemoryHealthStore();
		this.now = options?.now ?? (() => Date.now());
		this.failureWindowMs = options?.failureWindowMs ?? PLANNER_FAILURE_WINDOW_MS;
		this.cooldownMs = options?.cooldownMs ?? PLANNER_COOLDOWN_MS;
		this.failuresBeforeCooldown =
			options?.failuresBeforeCooldown ?? PLANNER_FAILURES_BEFORE_COOLDOWN;
	}

	clear(): void {
		this.store.clear();
	}

	/** True while the model is inside an active cooldown. */
	isExcluded(modelId: string): boolean {
		const id = normalizeModelId(modelId);
		if (!id) return false;
		const entry = this.store.get(id);
		if (!entry?.cooldownUntil) return false;
		const now = this.now();
		if (now >= entry.cooldownUntil) {
			this.store.delete(id);
			return false;
		}
		return true;
	}

	/** Milliseconds left on cooldown, or 0. */
	cooldownRemainingMs(modelId: string): number {
		const id = normalizeModelId(modelId);
		const entry = this.store.get(id);
		if (!entry?.cooldownUntil) return 0;
		return Math.max(0, entry.cooldownUntil - this.now());
	}

	recordSuccess(modelId: string): void {
		const id = normalizeModelId(modelId);
		if (!id) return;
		this.store.delete(id);
	}

	recordFailure(modelId: string, error: unknown): void {
		const id = normalizeModelId(modelId);
		if (!id || !shouldRecordPlannerFailure(error)) return;
		const now = this.now();
		const prev = this.store.get(id);
		const failures = pruneFailures(
			[...(prev?.failures || []), now],
			now,
			this.failureWindowMs,
		);
		const entry: PlannerModelHealthEntry = { failures };
		if (failures.length >= this.failuresBeforeCooldown) {
			entry.cooldownUntil = now + this.cooldownMs;
			entry.failures = [];
		}
		this.store.set(id, entry);
	}
}

export function createMemoryHealthStore(): PlannerModelHealthStore {
	const map = new Map<string, PlannerModelHealthEntry>();
	return {
		get: (id) => map.get(id),
		set: (id, entry) => {
			map.set(id, entry);
		},
		delete: (id) => {
			map.delete(id);
		},
		clear: () => {
			map.clear();
		},
	};
}

/** Process-wide health used by Ask rewrite routing. */
export const plannerModelHealth = new PlannerModelHealth();
