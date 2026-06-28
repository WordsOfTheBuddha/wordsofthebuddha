#!/usr/bin/env node
/**
 * Batch curation helper for catalog YAML drafts.
 *
 * Usage:
 *   node scripts/curate-catalog-draft.mjs --collection an4 [--batch-size 10] [--batch 0]
 *   node scripts/curate-catalog-draft.mjs --collection an4 --write
 *   node scripts/curate-catalog-draft.mjs --collection an4 --write --slug an4.2
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import matter from "gray-matter";
import { buildSujatoMarkdown } from "./lib/sujato-frontmatter.mjs";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const REF_ONLY_PATH = join(ROOT, "src/utils/referenceOnlyRoutes.ts");
const SUJATO_ROOT = join(ROOT, "src/content/references/sujato");
const CATALOG_ROOT = join(ROOT, "src/content/catalog");
const QUALITIES_PATH = join(ROOT, "src/data/qualities.json");
const THEMES_PATH = join(ROOT, "src/data/themes.json");

const RUBRIC_PATH = join(ROOT, "docs/catalog-curation.md");

function loadRefOnlyRoutes() {
	const raw = readFileSync(REF_ONLY_PATH, "utf8");
	const match = raw.match(/referenceOnlyRoutes = (\[[\s\S]*?\]) as const/);
	return match ? JSON.parse(match[1]) : [];
}

function loadQualitiesData() {
	return JSON.parse(readFileSync(QUALITIES_PATH, "utf8"));
}

function loadThemesData() {
	return JSON.parse(readFileSync(THEMES_PATH, "utf8"));
}

function buildQualityMatchers(qualitiesData) {
	const matchers = [];
	const all = [
		...qualitiesData.positive,
		...qualitiesData.negative,
		...qualitiesData.neutral,
	];
	for (const q of all) {
		matchers.push({ quality: q, pattern: new RegExp(`\\b${escapeRe(q)}\\b`, "i") });
	}
	for (const [quality, synonyms] of Object.entries(qualitiesData.qualities ?? {})) {
		for (const syn of synonyms) {
			if (syn.startsWith("Context:") || syn.startsWith("Supported") || syn.startsWith("Leads") || syn.startsWith("Opposite") || syn.startsWith("[")) continue;
			if (syn.length < 3) continue;
			matchers.push({ quality, pattern: new RegExp(`\\b${escapeRe(syn)}\\b`, "i") });
		}
	}
	return matchers;
}

function escapeRe(s) {
	return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const THEME_RULES = [
	{ theme: "story", patterns: [/\bking\b|\bqueen\b|\bprince\b|\bdeva\b|\bbrahmin\b|\bhouseholder\b|narrative|account of|once the|one time/i] },
	{ theme: "urgency", patterns: [/\bdeath\b|impermanen|urgent|swiftly|before long|limited time/i] },
	{ theme: "recollection of the Buddha", patterns: [/realized one|tathāgata|awakened buddha|worthy one/i] },
	{ theme: "directly knowing", patterns: [/directly know|direct knowledge|experiential|see for yourself/i] },
	{ theme: "training guideline", patterns: [/should develop|should practice|meditat|jhāna|immersion|\beffort\b|striving|training/i] },
	{ theme: "cultivating discernment", patterns: [/on the one hand|two kinds|contrasts|distinguish|compare|versus|not the other|similar to/i] },
	{ theme: "inspiration", patterns: [/inspire|confidence|faith|joy|gladness|encourag/i] },
	{ theme: "inquisitiveness", patterns: [/investigate|inquire|curious|question|examine/i] },
	{ theme: "principle", patterns: [/four things|four principles|four factors|four kinds|four types|four persons|four ways|four modes|four bases|four foundations|four assemblies|four yokes|four floods|four bonds|four pots|four lamps|four efforts|four nutriment/i] },
	{ theme: "wisdom", patterns: [/understand|wisdom|insight|discern|comprehend|penetrat|knowledge|\bview\b/i] },
];

function inferThemes(text) {
	const scores = new Map();
	for (const { theme, patterns } of THEME_RULES) {
		for (const p of patterns) {
			if (p.test(text)) scores.set(theme, (scores.get(theme) ?? 0) + 1);
		}
	}
	const sorted = [...scores.entries()].sort((a, b) => b[1] - a[1]);
	if (!sorted.length) return ["principle"];
	const top = sorted[0][0];
	const second = sorted[1]?.[0];
	if (second && sorted[1][1] >= sorted[0][1] * 0.7) return [top, second];
	return [top];
}

function inferQualities(text, matchers, max = 6) {
	const scores = new Map();
	for (const { quality, pattern } of matchers) {
		const hits = (text.match(new RegExp(pattern.source, "gi")) ?? []).length;
		if (hits) scores.set(quality, (scores.get(quality) ?? 0) + hits);
	}
	const sorted = [...scores.entries()].sort((a, b) => b[1] - a[1]);
	const picked = sorted.slice(0, max).map(([q]) => q);

	const fallbacks = [
		[/ignorance|unknowing/i, "delusion"],
		[/ethical|virtue|morality|sīla|noble ethics/i, "ethical conduct"],
		[/immersion|samādhi|collected/i, "collectedness"],
		[/wisdom|discernment|paññ/i, "wisdom"],
		[/freedom|liberation|release|vimutti/i, "liberation"],
		[/sensual pleasure|sensuality/i, "sensual desire"],
		[/craving|greed|attachment|thirst/i, "craving"],
		[/view(?!ing)/i, "wrong view"],
		[/effort|striving|strive/i, "right effort"],
		[/faith|confidence/i, "faith"],
		[/mindful/i, "mindfulness"],
		[/harm|injure|violence/i, "harm"],
		[/conceit|arrogance|pride/i, "conceit"],
		[/anger|hate|ill will/i, "ill will"],
		[/realized one|awakened|buddha/i, "recollection of the Buddha"],
	];
	for (const [pattern, quality] of fallbacks) {
		if (pattern.test(text) && !picked.includes(quality)) picked.push(quality);
	}

	if (picked.length < 2) picked.push("wisdom");
	return [...new Set(picked)].slice(0, max);
}

function cleanLine(s) {
	return s.replace(/\s+/g, " ").trim();
}

function extractFourItems(body) {
	const items = [];
	const lines = body.split("\n").map(cleanLine).filter(Boolean);

	// Inline list after "What four?" on same or next line
	const whatFourIdx = lines.findIndex((l) => /^what four\??$/i.test(l));
	if (whatFourIdx !== -1) {
		for (let i = whatFourIdx + 1; i < Math.min(whatFourIdx + 4, lines.length); i++) {
			const line = lines[i];
			if (/^and what|^these are/i.test(line)) break;
			if (line.length >= 8 && line.length <= 120) {
				items.push(line.replace(/\.$/, ""));
			}
		}
	}

	if (items.length >= 2) return [...new Set(items)].slice(0, 4);

	for (const line of lines) {
		if (line.length < 8 || line.length > 100) continue;
		if (/^(mendicants|bhikkhus|monks|what|who|which)\b/i.test(line)) continue;
		if (/^(someone|a certain|the one|here,|it's when|and how)/i.test(line)) continue;
		if (/^(covered|uncovered|noble |the efforts)/i.test(line)) {
			items.push(line.replace(/\.$/, ""));
		}
		if (/^(the lamp|the effort)/i.test(line)) {
			items.push(line.replace(/\.$/, ""));
		}
		if (items.length >= 4) break;
	}
	return [...new Set(items)].slice(0, 4);
}

function enrichDescription(desc, title, body) {
	if (desc.length >= 80) return desc;
	const t = title.toLowerCase();
	const enrichments = {
		yokes: "of sensual pleasures, future lives, views, and ignorance—and how not understanding their origin, disappearance, gratification, drawback, and escape keeps craving binding",
		effort: "to restrain, give up, develop, and preserve skillful and unskillful qualities",
		pots: "used as a simile for four individuals who may appear impressive or plain while being hollow or full in understanding the four noble truths",
		lamps: "of the moon, sun, fire, and wisdom—the lamp of wisdom being foremost",
	};
	for (const [key, extra] of Object.entries(enrichments)) {
		if (t.includes(key)) {
			if (desc.endsWith(".")) desc = desc.slice(0, -1);
			return `${desc}—${extra}.`;
		}
	}
	const items = extractFourItems(body);
	if (items.length >= 2) {
		const enumList = items
			.slice(0, 4)
			.map((s) => s.toLowerCase())
			.join(", ")
			.replace(/, ([^,]*)$/, ", and $1");
		if (desc.endsWith(".")) desc = desc.slice(0, -1);
		return `${desc}—${enumList}.`;
	}
	return desc.length >= 40
		? desc
		: `${desc.replace(/\.$/, "")}, explaining this fourfold teaching for disciples on the path.`;
}

function buildDescription(title, body, slug) {
	const text = cleanLine(body.replace(/\n+/g, " "));

	if (slug.includes("-")) {
		if (/complete understanding/i.test(text)) {
			return "The Buddha teaches that four things should be developed for the complete understanding, finishing, giving up, ending, vanishing, fading away, cessation, giving away, and letting go of greed.";
		}
		if (/insight into hate/i.test(text) || /book of the fours is finished/i.test(text)) {
			return "The Buddha teaches that four things should be developed for insight into and letting go of unwholesome qualities such as hate, delusion, anger, conceit, and negligence—closing the Book of the Fours.";
		}
		return `The Buddha presents a repeated formula on ${title.toLowerCase()} in this grouped discourse.`;
	}

	// Persons discourse
	if (/four kinds of persons/i.test(text) || /four persons/i.test(text)) {
		return "The Buddha describes the four kinds of persons found in the world, contrasting their conduct and spiritual attainment.";
	}

	// "should be developed" formula
	if (/four things should be developed/i.test(text)) {
		const purpose = text.match(/for (?:the )?(complete understanding[^.]{0,60}|insight[^.]{0,40}|[^.]{10,80})/i)?.[1];
		return purpose
			? `The Buddha teaches that four things should be developed for ${purpose.replace(/\.$/, "").toLowerCase()}.`
			: "The Buddha teaches that four things should be developed on the path.";
	}

	// "regarded as foremost" and similar
	if (/regarded as foremost/i.test(text)) {
		return "The Buddha describes four who are regarded as foremost in the world—including Rāhu among titans, King Mandhātā among pleasure seekers, Māra in sovereignty, and the Realized One as best among gods and humans.";
	}

	// Standard "there are these four X"
	const topicMatch =
		text.match(/there are these four ([^.!?]{3,70})/i) ||
		text.match(/these four ([^.!?]{3,70}) are/i) ||
		text.match(/four ([^.!?]{3,70}) are found/i);

	if (topicMatch) {
		const topic = topicMatch[1].replace(/[:,.]$/, "").trim();
		const items = extractFourItems(body);
		if (items.length >= 2) {
			const enumList = items
				.slice(0, 4)
				.map((s) => s.toLowerCase())
				.join(", ")
				.replace(/, ([^,]*)$/, ", and $1");
			return `The Buddha describes the four ${topic.toLowerCase()}—${enumList}.`;
		}
		return `The Buddha describes the four ${topic.toLowerCase()}.`;
	}

	// Title-based fallback for short teachings
	if (title && title.length > 2) {
		const t = title.toLowerCase();
		if (/yokes/i.test(t)) {
			return "The Buddha describes the four yokes—of sensual pleasures, future lives, views, and ignorance—and how not understanding their origin, disappearance, gratification, drawback, and escape keeps craving binding.";
		}
		if (/fallen/i.test(t)) {
			return "The Buddha explains that one without noble ethics, immersion, wisdom, and freedom is said to have fallen from this teaching and training, while one complete in them is secure.";
		}
		return `The Buddha teaches on ${t}, presenting a fourfold teaching for disciples on the path.`;
	}

	return "The Buddha presents a fourfold teaching in this discourse.";
}

function curateEntry(slug, qualitiesData) {
	const collection = slug.match(/^[a-z]+/)?.[0];
	const refPath = join(SUJATO_ROOT, collection, `${slug}.md`);
	if (!existsSync(refPath)) throw new Error(`Missing Sujato ref: ${refPath}`);
	const { data, content } = matter(readFileSync(refPath, "utf8"));
	const title = (data.title || slug).trim();
	const body = content.trim();
	const matchers = buildQualityMatchers(qualitiesData);
	const fullText = `${title}\n${body}`;
	const description = enrichDescription(
		buildDescription(title, body, slug),
		title,
		body,
	);
	const qualities = inferQualities(fullText, matchers);
	const theme = inferThemes(fullText);

	return {
		slug,
		title,
		description,
		qualities: qualities.join(", "),
		theme: theme.join(", "),
	};
}

function toYaml(entry) {
	const lines = [
		`slug: ${entry.slug}`,
		`title: ${yamlQuote(entry.title)}`,
		`description: ${yamlQuote(entry.description)}`,
		`qualities: ${entry.qualities}`,
		`theme: ${entry.theme}`,
		"",
	];
	return lines.join("\n");
}

function yamlQuote(s) {
	if (/[:#{}[\],&*?]|^\s|\s$/.test(s) || s.includes('"')) {
		return `"${s.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
	}
	return s;
}

function printBatch(slugs, batchSize, batchIndex) {
	const start = batchIndex * batchSize;
	const batch = slugs.slice(start, start + batchSize);
	if (!batch.length) {
		console.log("No slugs in this batch.");
		return;
	}
	console.log(`# Catalog curation batch ${batchIndex + 1} (${batch.length} slugs)`);
	console.log(`# Rubric: ${RUBRIC_PATH}`);
	console.log("");
	for (const slug of batch) {
		const collection = slug.match(/^[a-z]+/)?.[0];
		const refPath = join(SUJATO_ROOT, collection, `${slug}.md`);
		const { data, content } = matter(readFileSync(refPath, "utf8"));
		console.log(`--- ${slug} ---`);
		console.log(`title: ${data.title || slug}`);
		console.log(content.trim().slice(0, 600));
		console.log("");
	}
}

function writeEntries(slugs, qualitiesData) {
	let written = 0;
	for (const slug of slugs) {
		const collection = slug.match(/^[a-z]+/)?.[0];
		const outDir = join(CATALOG_ROOT, collection);
		mkdirSync(outDir, { recursive: true });
		const entry = curateEntry(slug, qualitiesData);
		const outPath = join(outDir, `${slug}.yaml`);
		writeFileSync(outPath, toYaml(entry), "utf8");

		const refPath = join(SUJATO_ROOT, collection, `${slug}.md`);
		if (existsSync(refPath)) {
			const { data, content } = matter(readFileSync(refPath, "utf8"));
			const merged = {
				...data,
				title: entry.title,
				description: entry.description,
				qualities: entry.qualities,
				theme: entry.theme,
			};
			writeFileSync(
				refPath,
				buildSujatoMarkdown({ ...merged, body: content }),
				"utf8",
			);
		}

		written++;
	}
	return written;
}

function parseArgs() {
	const args = process.argv.slice(2);
	const get = (name) => {
		const eq = args.find((a) => a.startsWith(`--${name}=`));
		if (eq) return eq.split("=").slice(1).join("=");
		const idx = args.indexOf(`--${name}`);
		return idx !== -1 ? args[idx + 1] : undefined;
	};
	return {
		collection: get("collection"),
		batchSize: parseInt(get("batch-size") || "10", 10),
		batch: parseInt(get("batch") || "0", 10),
		write: args.includes("--write"),
		slug: get("slug"),
	};
}

function main() {
	const { collection, batchSize, batch, write, slug } = parseArgs();
	if (!collection) {
		console.error("Usage: --collection an4 [--write | --batch-size 10 --batch 0]");
		process.exit(1);
	}

	const qualitiesData = loadQualitiesData();
	const allSlugs = loadRefOnlyRoutes().filter((s) => s.startsWith(`${collection}.`));
	if (!allSlugs.length) {
		console.error(`No ref-only slugs for collection ${collection}`);
		process.exit(1);
	}

	if (write) {
		const targets = slug ? [slug] : allSlugs;
		const n = writeEntries(targets, qualitiesData);
		console.log(`✅ Wrote ${n} catalog YAML file(s) and synced Sujato frontmatter.`);
		return;
	}

	printBatch(allSlugs, batchSize, batch);
}

main();
