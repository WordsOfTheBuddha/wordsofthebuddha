import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	createInflightSlot,
	resetInflightSlot,
	shareInflight,
} from "./shareInflight";

describe("shareInflight", () => {
	it("runs the factory once when callers overlap", async () => {
		let calls = 0;
		const slot = createInflightSlot<{ n: number }>();
		const factory = async () => {
			calls += 1;
			await new Promise((resolve) => setTimeout(resolve, 20));
			return { n: calls };
		};
		const [a, b, c] = await Promise.all([
			shareInflight(slot, factory),
			shareInflight(slot, factory),
			shareInflight(slot, factory),
		]);
		assert.equal(calls, 1);
		assert.equal(a, b);
		assert.equal(b, c);
		assert.equal(a.n, 1);
	});

	it("reuses the cached value after the first success", async () => {
		let calls = 0;
		const slot = createInflightSlot<number>();
		const first = await shareInflight(slot, () => {
			calls += 1;
			return 7;
		});
		const second = await shareInflight(slot, () => {
			calls += 1;
			return 8;
		});
		assert.equal(first, 7);
		assert.equal(second, 7);
		assert.equal(calls, 1);
	});

	it("retries after a failed factory", async () => {
		let calls = 0;
		const slot = createInflightSlot<string>();
		await assert.rejects(
			shareInflight(slot, async () => {
				calls += 1;
				throw new Error("boom");
			}),
			/boom/,
		);
		const value = await shareInflight(slot, () => {
			calls += 1;
			return "ok";
		});
		assert.equal(value, "ok");
		assert.equal(calls, 2);
	});

	it("does not write a stale result after reset", async () => {
		const slot = createInflightSlot<string>();
		let finishFirst!: (value: string) => void;
		let started = false;
		const first = shareInflight(
			slot,
			() =>
				new Promise<string>((resolve) => {
					finishFirst = resolve;
					started = true;
				}),
		);
		while (!started) {
			await new Promise((resolve) => setImmediate(resolve));
		}
		resetInflightSlot(slot);
		const second = shareInflight(slot, async () => "fresh");
		finishFirst("stale");
		assert.equal(await second, "fresh");
		assert.equal(await first, "stale");
		assert.equal(slot.value, "fresh");
	});
});
