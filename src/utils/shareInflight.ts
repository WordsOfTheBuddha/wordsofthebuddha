/**
 * Share one in-flight async factory across overlapping callers.
 *
 * `value ??= await factory()` is not race-safe: every waiter sees `value` as
 * still null and starts another factory. Ask runs many searches in parallel, so
 * that pattern used to inflate Fuse + normalized body maps many times and OOM
 * the Vercel function.
 */
export type InflightSlot<T> = {
	value: T | null;
	promise: Promise<T> | null;
};

export function createInflightSlot<T>(): InflightSlot<T> {
	return { value: null, promise: null };
}

export function resetInflightSlot<T>(slot: InflightSlot<T>): void {
	slot.value = null;
	slot.promise = null;
}

export function shareInflight<T>(
	slot: InflightSlot<T>,
	factory: () => T | Promise<T>,
): Promise<T> {
	if (slot.value !== null) return Promise.resolve(slot.value);
	if (slot.promise) return slot.promise;
	const created = Promise.resolve()
		.then(factory)
		.then((value) => {
			if (slot.promise === created) {
				slot.value = value;
			}
			return value;
		})
		.catch((error) => {
			if (slot.promise === created) {
				slot.promise = null;
			}
			throw error;
		});
	slot.promise = created;
	return created;
}
