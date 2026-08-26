import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { waitForServiceWorkerControl } from "./waitForServiceWorkerControl";

describe("waitForServiceWorkerControl", () => {
	it("returns true immediately when a controller already exists", async () => {
		const sw = {
			controller: { postMessage() {} },
			getRegistration: () => new Promise<never>(() => {}),
		};
		const result = await waitForServiceWorkerControl(sw, 10_000);
		assert.equal(result, true);
	});

	it("times out instead of hanging when no worker is registered", async () => {
		const sw = {
			controller: null,
			getRegistration: () => Promise.resolve(null),
			addEventListener() {},
		};
		const started = Date.now();
		const result = await waitForServiceWorkerControl(sw, 40);
		assert.equal(result, false);
		assert.ok(Date.now() - started < 1000);
	});

	it("still times out if getRegistration never settles", async () => {
		const sw = {
			controller: null,
			getRegistration: () => new Promise<never>(() => {}),
			addEventListener() {},
		};
		const result = await waitForServiceWorkerControl(sw, 40);
		assert.equal(result, false);
	});

	it("resolves true on controllerchange before the timeout", async () => {
		const listeners: Array<() => void> = [];
		const sw = {
			controller: null as { postMessage: (message: unknown) => void } | null,
			getRegistration: () => Promise.resolve(null),
			addEventListener(_type: string, listener: EventListenerOrEventListenerObject) {
				const fn =
					typeof listener === "function"
						? listener
						: listener.handleEvent.bind(listener);
				listeners.push(() => fn(new Event("controllerchange")));
			},
		};
		const pending = waitForServiceWorkerControl(sw, 10_000);
		queueMicrotask(() => {
			sw.controller = { postMessage() {} };
			for (const fire of listeners) fire();
		});
		assert.equal(await pending, true);
	});
});
