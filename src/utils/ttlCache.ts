export interface TtlCache<T> {
	get(key: string): T | null;
	set(key: string, value: T): void;
	delete(key: string): void;
	deleteByPrefix(prefix: string): void;
	clear(): void;
}

/** True when a timestamp is recent enough to trust for a short-lived read. */
export function isWithinTtl(at: number, ttlMs: number, now = Date.now()): boolean {
	return at > 0 && now - at < ttlMs;
}

/**
 * Small in-process TTL cache for display-only Firestore views. Entries are
 * dropped lazily on read, so a short TTL bounds staleness without timers.
 */
export function createTtlCache<T>(options: {
	ttlMs?: number;
	clock?: () => number;
} = {}): TtlCache<T> {
	const ttlMs = options.ttlMs ?? 3000;
	const clock = options.clock ?? Date.now;
	const store = new Map<string, { at: number; value: T }>();

	return {
		get(key: string): T | null {
			const hit = store.get(key);
			if (!hit) return null;
			if (clock() - hit.at >= ttlMs) {
				store.delete(key);
				return null;
			}
			return hit.value;
		},
		set(key: string, value: T): void {
			store.set(key, { at: clock(), value });
		},
		delete(key: string): void {
			store.delete(key);
		},
		deleteByPrefix(prefix: string): void {
			for (const key of [...store.keys()]) {
				if (key.startsWith(prefix)) store.delete(key);
			}
		},
		clear(): void {
			store.clear();
		},
	};
}