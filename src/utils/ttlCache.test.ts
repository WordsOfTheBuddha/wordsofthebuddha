import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createTtlCache, isWithinTtl } from "./ttlCache";

describe("ttl cache", () => {
	it("returns fresh entries and expires them after the ttl", () => {
		let now = 1_000;
		const cache = createTtlCache<string>({ ttlMs: 50, clock: () => now });
		cache.set("a", "first");
		assert.equal(cache.get("a"), "first");
		now += 49;
		assert.equal(cache.get("a"), "first");
		now += 1;
		assert.equal(cache.get("a"), null);
	});

	it("deletes entries by key and prefix", () => {
		const cache = createTtlCache<number>({ ttlMs: 1_000 });
		cache.set("day_u|u|0|1.2.3.4", 1);
		cache.set("day_u|u|0|5.6.7.8", 2);
		cache.set("other", 3);
		cache.delete("other");
		assert.equal(cache.get("other"), null);
		cache.deleteByPrefix("day_u|");
		assert.equal(cache.get("day_u|u|0|1.2.3.4"), null);
		assert.equal(cache.get("day_u|u|0|5.6.7.8"), null);
	});

	it("overwrites an existing key", () => {
		const cache = createTtlCache<number>({ ttlMs: 1_000 });
		cache.set("a", 1);
		cache.set("a", 2);
		assert.equal(cache.get("a"), 2);
	});

	it("clear drops everything", () => {
		const cache = createTtlCache<number>({ ttlMs: 1_000 });
		cache.set("a", 1);
		cache.clear();
		assert.equal(cache.get("a"), null);
	});
});

describe("isWithinTtl", () => {
	it("accepts fresh timestamps and rejects stale or missing ones", () => {
		assert.equal(isWithinTtl(0, 6_000, 10_000), false);
		assert.equal(isWithinTtl(5_000, 6_000, 10_000), true);
		assert.equal(isWithinTtl(4_000, 6_000, 10_000), false);
		assert.equal(isWithinTtl(10_000, 6_000, 10_000), true);
	});

	it("defaults to Date.now", () => {
		assert.equal(isWithinTtl(Date.now(), 60_000), true);
	});
});
