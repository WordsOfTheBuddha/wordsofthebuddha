import assert from "node:assert/strict";
import { after, afterEach, before, describe, it } from "node:test";
import { goToSearchQuery } from "./searchGatewayClient";
import type { DiscourseSuggestEntry } from "./discourseIdSuggest";

const entries: DiscourseSuggestEntry[] = [
	{
		slug: "mn10",
		title: "Satipaṭṭhānasutta - Establishments of Mindfulness",
		referenceOnly: false,
	},
];

describe("goToSearchQuery", () => {
	const assigned: string[] = [];
	const previousLocation = globalThis.location;

	before(() => {
		(globalThis as { location: { assign: (href: string) => void } }).location = {
			assign(href: string) {
				assigned.push(href);
			},
		};
	});

	afterEach(() => {
		assigned.length = 0;
	});

	after(() => {
		(globalThis as { location: Location }).location = previousLocation;
	});

	it("navigates to a unique discourse ID", () => {
		goToSearchQuery("MN 10", entries);
		assert.deepEqual(assigned, ["/mn10"]);
	});

	it("sends non-ID queries to search", () => {
		goToSearchQuery("mettā", entries);
		assert.deepEqual(assigned, ["/search?q=mett%C4%81"]);
	});

	it("calls onEmptyQuery instead of navigating", () => {
		let empty = 0;
		goToSearchQuery("  ", entries, () => {
			empty += 1;
		});
		assert.equal(empty, 1);
		assert.deepEqual(assigned, []);
	});
});
