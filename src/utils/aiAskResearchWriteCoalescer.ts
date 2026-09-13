export interface CoalescedJobRecord {
	reasoning?: string;
	progressNote?: string;
}

export interface JobWriteCoalescer<T extends CoalescedJobRecord> {
	/** Queues the record's current reasoning text; flushed at most once per interval. */
	queueReasoning(): void;
	/** Queues a progress note; the latest note wins at flush time. */
	queueProgressNote(note: string): void;
	/** Queues a patch factory evaluated at flush time. */
	queue(patch: () => Partial<T> | null): void;
	/** Cancels the pending timer and awaits all queued writes. */
	flush(): Promise<void>;
	/** Drops queued writes and prevents scheduling. Call after the terminal write. */
	dispose(): void;
}

const DEFAULT_INTERVAL_MS = 1500;

/**
 * Coalesces high-frequency research job stream writes (reasoning deltas,
 * progress notes) into at most one Firestore write per interval. Patches are
 * merged last-wins at flush time so the latest state is always persisted.
 */
export function createJobWriteCoalescer<T extends CoalescedJobRecord>(options: {
	getRecord: () => T;
	write: (record: T, patch: Partial<T>) => Promise<unknown>;
	intervalMs?: number;
	onError?: (error: unknown) => void;
	setTimer?: (handler: () => void, ms: number) => ReturnType<typeof setTimeout>;
	clearTimer?: (handle: ReturnType<typeof setTimeout>) => void;
}): JobWriteCoalescer<T> {
	const intervalMs = options.intervalMs ?? DEFAULT_INTERVAL_MS;
	const setTimer =
		options.setTimer ?? ((handler, ms) => setTimeout(handler, ms));
	const clearTimer = options.clearTimer ?? ((handle) => clearTimeout(handle));
	const pending: Array<() => Partial<T> | null> = [];
	let timer: ReturnType<typeof setTimeout> | null = null;
	let chain: Promise<void> = Promise.resolve();
	let disposed = false;

	const drain = async (): Promise<void> => {
		if (pending.length === 0) return;
		const merged: Record<string, unknown> = {};
		while (pending.length > 0) {
			const next = pending.shift();
			if (!next) continue;
			let patch: Partial<T> | null = null;
			try {
				patch = next();
			} catch (error) {
				options.onError?.(error);
				continue;
			}
			if (!patch) continue;
			for (const [key, value] of Object.entries(patch)) {
				if (value === undefined) continue;
				merged[key] = value;
			}
		}
		if (Object.keys(merged).length === 0) return;
		try {
			await options.write(options.getRecord(), merged as Partial<T>);
		} catch (error) {
			options.onError?.(error);
		}
	};

	const runDrain = (): Promise<void> => {
		chain = chain.then(drain, drain);
		return chain;
	};

	const schedule = (): void => {
		if (disposed || timer) return;
		timer = setTimer(() => {
			timer = null;
			void runDrain();
		}, intervalMs);
	};

	const queue = (patch: () => Partial<T> | null): void => {
		if (disposed) return;
		pending.push(patch);
		schedule();
	};

	return {
		queueReasoning: () => {
			queue(() => {
				const record = options.getRecord();
				const reasoning =
					typeof record.reasoning === "string" ? record.reasoning : "";
				return reasoning ? ({ reasoning } as Partial<T>) : null;
			});
		},
		queueProgressNote: (note: string) => {
			const clean = note.trim();
			if (!clean) return;
			queue(() => ({ progressNote: clean }) as Partial<T>);
		},
		queue,
		flush: async () => {
			if (timer) {
				clearTimer(timer);
				timer = null;
			}
			await runDrain();
		},
		dispose: () => {
			if (timer) {
				clearTimer(timer);
				timer = null;
			}
			pending.length = 0;
			disposed = true;
		},
	};
}