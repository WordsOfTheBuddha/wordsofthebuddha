import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildAiLibraryHints } from "./aiLibraryHints";

describe("buildAiLibraryHints", () => {
	it("includes curated Pāli pairs and optional catalog titles", () => {
		const text = buildAiLibraryHints({
			topicTitles: ["Mindfulness", "Dependent Co-arising"],
			qualityTitles: ["anger", "diligence"],
			personEntries: [
				{ slug: "ananda", title: "Venerable Ānanda" },
				{ slug: "sakka-lord-of-the-gods", title: "Sakka, Lord of the Gods" },
			],
			discourseCatalogBlock:
				"Known discourses in this library\nSN 22.82 | Puṇṇama sutta | The Full Moon Night",
		});
		assert.match(text, /kodha=anger/);
		assert.match(text, /Mindfulness/);
		assert.match(text, /anger/);
		assert.match(text, /topics\/qualities\/similes\/persons/);
		assert.match(text, /ananda=Venerable Ānanda/);
		assert.match(text, /personSlugs/);
		assert.match(text, /SN 22\.82 \| Puṇṇama sutta/);
	});
});
