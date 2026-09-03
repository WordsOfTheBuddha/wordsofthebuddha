import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	buildAiDiscourseCatalogEntries,
	formatAiDiscourseCatalogLine,
	formatAiDiscourseCatalogPromptBlock,
	shouldIncludeInAiDiscourseCatalog,
} from "./aiDiscourseCatalog";

describe("shouldIncludeInAiDiscourseCatalog", () => {
	it("includes priority-tagged discourses outside DN/MN/Snp", () => {
		assert.equal(
			shouldIncludeInAiDiscourseCatalog({
				slug: "sn22.82",
				title: "Puṇṇama sutta - The Full Moon Night",
				priority: 2,
			}),
			true,
		);
	});

	it("includes all MN / DN / Snp even without priority", () => {
		assert.equal(
			shouldIncludeInAiDiscourseCatalog({
				slug: "mn109",
				title: "Mahāpuṇṇama sutta - The Longer Discourse on the Full-Moon Night",
			}),
			true,
		);
		assert.equal(
			shouldIncludeInAiDiscourseCatalog({ slug: "dn22", title: "DN" }),
			true,
		);
		assert.equal(
			shouldIncludeInAiDiscourseCatalog({
				slug: "snp4.13",
				title: "Mahābyūha sutta - The Greater Discourse on the Array of Views",
			}),
			true,
		);
	});

	it("excludes unprioritized SN / AN", () => {
		assert.equal(
			shouldIncludeInAiDiscourseCatalog({
				slug: "sn22.87",
				title: "Vakkali sutta - Vakkali",
			}),
			false,
		);
		assert.equal(
			shouldIncludeInAiDiscourseCatalog({ slug: "an3.40", title: "x" }),
			false,
		);
	});
});

describe("buildAiDiscourseCatalogEntries", () => {
	it("formats ID | Pāli | English and sorts", () => {
		const entries = buildAiDiscourseCatalogEntries([
			{
				slug: "sn22.82",
				title: "Puṇṇama sutta - The Full Moon Night",
				priority: 1.2,
			},
			{
				slug: "mn109",
				title: "Mahāpuṇṇama sutta - The Longer Discourse on the Full-Moon Night",
			},
		]);
		assert.deepEqual(
			entries.map((entry) => formatAiDiscourseCatalogLine(entry)),
			[
				"MN 109 | Mahāpuṇṇama sutta | The Longer Discourse on the Full-Moon Night",
				"SN 22.82 | Puṇṇama sutta | The Full Moon Night",
			],
		);
		const block = formatAiDiscourseCatalogPromptBlock(entries);
		assert.match(block, /Do not invent nearby IDs/);
		assert.match(block, /SN 22\.82 \| Puṇṇama sutta/);
	});
});

describe("aiQueryRewrite prompt", () => {
	it("tells the model not to invent nearby IDs", async () => {
		const { AI_REWRITE_SYSTEM_PROMPT } = await import("./aiQueryRewrite");
		assert.match(AI_REWRITE_SYSTEM_PROMPT, /Known discourses list/);
		assert.match(AI_REWRITE_SYSTEM_PROMPT, /never invent a nearby number/);
	});
});
