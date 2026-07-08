import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	getReferencePostsForDiscourseScopes,
	getReferencePostsForTag,
} from "./referencePostsForPage";

describe("referencePostsForPage", () => {
	it("includes sn45.4 under book scope but not under formless tag", () => {
		const enFormless = new Set([
			"mn26",
			"mn64",
			"mn77",
			"mn111",
			"mn121",
			"mn43",
			"mn102",
			"an9.36",
			"mn25",
			"mn106",
			"mn52",
			"an11.9",
			"an9.24",
			"mn6",
			"mn31",
			"mn137",
			"mn140",
			"iti51",
			"iti72",
			"iti73",
			"sn45.180",
			"snp5.6",
			"snp5.14",
			"an3.76",
			"an3.77",
			"an7.44",
		]);

		const byScope = getReferencePostsForDiscourseScopes(
			enFormless,
			enFormless,
		).map((entry) => entry.slug);
		const byTag = getReferencePostsForTag("formless", enFormless).map(
			(entry) => entry.slug,
    );

		assert.ok(
			byScope.includes("sn45.4"),
			"book-scope ref list still includes sn45.4",
		);
		assert.ok(
			!byTag.includes("sn45.4"),
			"tag-scoped ref list must not include sn45.4",
		);
	});
});
