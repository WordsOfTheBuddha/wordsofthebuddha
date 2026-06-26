import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import {
	expandHtmlTemplate,
	isInlineVerseLineTemplate,
	orderedContentKeys,
	segmentsToParagraphs,
} from "./import-sc-bilara.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CACHE_DIR = path.join(__dirname, "../.cache/bilara-data");

function loadFixture(id) {
	const rootDir = path.join(CACHE_DIR, "root/pli/ms/sutta");
	const stack = [rootDir];
	while (stack.length) {
		const dir = stack.pop();
		for (const name of readdirSync(dir)) {
			const full = path.join(dir, name);
			if (statSync(full).isDirectory()) stack.push(full);
			else if (name === `${id}_root-pli-ms.json`) {
				const segments = JSON.parse(readFileSync(full, "utf-8"));
				const htmlPath = full
					.replace("root/pli/ms/sutta", "html/pli/ms/sutta")
					.replace("_root-pli-ms.json", "_html.json");
				const html = JSON.parse(readFileSync(htmlPath, "utf-8"));
				return { segments, html };
			}
		}
	}
	throw new Error(`fixture not found: ${id}`);
}

test("inline verse-line template is not treated as a paragraph boundary", () => {
	const tpl = "<span class='verse-line'>{}</span>";
	assert.equal(isInlineVerseLineTemplate(tpl), true);
	const { open, close } = expandHtmlTemplate(tpl);
	assert.equal(open, "");
	assert.equal(close, "");
});

test("sn4.3 gāthā lines merge into two verse paragraphs", () => {
	const { segments, html } = loadFixture("sn4.3");
	const paragraphs = segmentsToParagraphs(segments, html);
	const verseBlocks = paragraphs.filter((p) => p.includes("Saṁsaraṁ"));
	assert.equal(verseBlocks.length, 1);
	assert.match(verseBlocks[0], /Saṁsaraṁ dīghamaddhānaṁ,\nvaṇṇaṁ katvā/);
	assert.match(verseBlocks[0], /Alaṁ te tena pāpima,\nnihato tvamasi antaka\./);

	const secondVerse = paragraphs.find((p) => p.includes("Ye ca kāyena"));
	assert.ok(secondVerse);
	assert.match(secondVerse, /Ye ca kāyena vācāya,\nmanasā ca susaṁvutā;/);
	assert.match(secondVerse, /na te mārassa baddhagū”ti\./);
});

test("sn49.1-12 uddāna gāthā keeps all four lines", () => {
	const { segments, html } = loadFixture("sn49.1-12");
	const paragraphs = segmentsToParagraphs(segments, html);
	const uddana = paragraphs.find((p) => p.includes("Cha pācīnato ninnā"));
	assert.ok(uddana, "uddāna gāthā should include first line");
	assert.match(uddana, /Cha pācīnato ninnā,/);
	assert.match(uddana, /cha ninnā ca samuddato;/);
	assert.match(uddana, /Dvete cha dvādasa honti,/);
	assert.match(uddana, /vaggo tena pavuccatīti\./);
});

test("snp1.3 verse discourse preserves all segment text", () => {
	const { segments, html } = loadFixture("snp1.3");
	const segmentCount = orderedContentKeys(segments).length;
	const paragraphs = segmentsToParagraphs(segments, html);
	const mergedText = paragraphs.join("\n\n");
	for (const key of orderedContentKeys(segments)) {
		const segment = segments[key]
			.replace(/\*\*(.+?)\*\*/g, "$1")
			.replace(/\*(.+?)\*/g, "$1")
			.replace(/_(.+?)_/g, "$1")
			.replace(/#\d+/g, "")
			.replace(/\s+/g, " ")
			.trim();
		if (!segment || /^(Paṭhama|Dutiya)\./.test(segment)) continue;
		assert.ok(
			mergedText.includes(segment),
			`missing segment text (${key}): ${segment.slice(0, 40)}`,
		);
	}
	assert.ok(paragraphs.length < segmentCount, "verses should merge segments");
});
