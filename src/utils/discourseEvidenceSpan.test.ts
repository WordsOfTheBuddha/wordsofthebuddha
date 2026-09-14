import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import {
	buildEvidenceSpanBySlug,
	discourseEvidenceReadLabels,
	evidenceSpanForRequest,
	parseDiscourseEvidenceSpan,
	sliceDiscourseTextForSpan,
} from "./discourseEvidenceSpan";

describe("discourseEvidenceSpan", () => {
	it("parses a constituent range id", () => {
		assert.deepEqual(parseDiscourseEvidenceSpan("an1.485-494"), {
			label: "AN 1.485–494",
			start: "1.485",
			end: "1.494",
		});
	});

	it("maps a named sub-range onto its parent file", () => {
		const span = evidenceSpanForRequest("AN 1.485–494", "an1.394-574");
		assert.equal(span?.start, "1.485");
		assert.equal(span?.end, "1.494");
		assert.equal(evidenceSpanForRequest("an1.394-574", "an1.394-574"), null);
	});

	it("slices the recollections passage out of an1.394-574", () => {
		const body = readFileSync(
			"src/content/references/sujato/an/an1.394-574.md",
			"utf8",
		);
		const span = parseDiscourseEvidenceSpan("an1.485-494");
		assert.ok(span);
		const sliced = sliceDiscourseTextForSpan(body, span);
		assert.match(sliced, /recollection of the Buddha/i);
		assert.match(sliced, /recollection of peace/i);
		assert.doesNotMatch(sliced, /finger-snap/i);
		assert.doesNotMatch(sliced, /first absorption/i);
	});

	it("builds span and read labels for revise evidence", () => {
		const hits = [{ slug: "an1.394-574" }, { slug: "snp1.8" }];
		const spans = buildEvidenceSpanBySlug(
			["an1.485-494", "snp1.8"],
			hits,
			(hit, id) =>
				hit.slug === id ||
				evidenceSpanForRequest(id, hit.slug) !== null,
		);
		assert.deepEqual(spans, {
			"an1.394-574": {
				label: "AN 1.485–494",
				start: "1.485",
				end: "1.494",
			},
		});
		assert.deepEqual(
			discourseEvidenceReadLabels(
				["an1.485-494", "snp1.8"],
				hits,
				(hit, id) =>
					hit.slug === id ||
					evidenceSpanForRequest(id, hit.slug) !== null,
			),
			["AN 1.485–494", "SNP 1.8"],
		);
	});
});
