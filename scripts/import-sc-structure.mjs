#!/usr/bin/env node
/**
 * Import Nikāya subdivision structure from SuttaCentral sc-data.
 *
 * Fetches structure/tree/sutta/mn-tree.json and an-tree.json,
 * merges English titles from scripts/data/*VaggaTitles.json overlays,
 * optionally enriches AN titles from EN grouped MDX frontmatter,
 * then writes generated structure files for MN and AN (books 4–5) navigation.
 *
 * Usage:
 *   node scripts/import-sc-structure.mjs
 *   node scripts/import-sc-structure.mjs --dry-run
 */

import { execSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, "..");
const MN_OUTPUT_PATH = path.join(
	PROJECT_ROOT,
	"src/data/mnVaggaStructure.generated.ts",
);
const AN_OUTPUT_PATH = path.join(
	PROJECT_ROOT,
	"src/data/anVaggaStructure.generated.ts",
);
const EN_AN_CONTENT = path.join(PROJECT_ROOT, "src/content/en/an");

const SC_DATA_BASE =
	"https://raw.githubusercontent.com/suttacentral/sc-data/master/structure";

/** SC vagga id → display title (Pāli, matching site conventions). */
const MN_VAGGA_PALI_TITLES = {
	"mn-mulapariyayavagga": "Mūlapariyāyavagga",
	"mn-sihanadavagga": "Sīhanādavagga",
	"mn-opammavagga": "Opammavagga",
	"mn-mahayamakavagga": "Mahāyamakavagga",
	"mn-culayamakavagga": "Cūḷayamakavagga",
	"mn-gahapativagga": "Gahapativagga",
	"mn-bhikkhuvagga": "Bhikkhuvagga",
	"mn-paribbajakavagga": "Paribbājakavagga",
	"mn-rajavagga": "Rājavagga",
	"mn-brahmanavagga": "Brāhmaṇavagga",
	"mn-devadahavagga": "Devadahavagga",
	"mn-anupadavagga": "Anupadavagga",
	"mn-sunnatavagga": "Suññatavagga",
	"mn-vibhangavagga": "Vibhaṅgavagga",
	"mn-salayatanavagga": "Saḷāyatanavagga",
};

const MN_PANNASA_KEYS = {
	"mn-mulapannasa": "mn1-50",
	"mn-majjhimapannasa": "mn51-100",
	"mn-uparipannasa": "mn101-152",
};

/** SC vagga id → Pāli title for AN books 4–5. */
const AN_VAGGA_PALI_TITLES = {
	"an4-bhandagamavagga": "Bhaṇḍāgāmavagga",
	"an4-caravagga": "Caravagga",
	"an4-uruvelavagga": "Uruvelāvagga",
	"an4-cakkavagga": "Cakkavagga",
	"an4-rohitassavagga": "Rohitassavagga",
	"an4-punnabhisandavagga": "Puññābhisandavagga",
	"an4-pattakammavagga": "Pattakammavagga",
	"an4-apannakavagga": "Apannakavagga",
	"an4-macalavagga": "Macalavagga",
	"an4-asuravagga": "Asuravagga",
	"an4-valahakavagga": "Valāhakavagga",
	"an4-kesivagga": "Kesivagga",
	"an4-bhayavagga": "Bhayavagga",
	"an4-puggalavagga": "Puggalavagga",
	"an4-abhavagga": "Ābhavagga",
	"an4-indriyavagga": "Indriyavagga",
	"an4-patipadavagga": "Paṭipadāvagga",
	"an4-sancetaniyavagga": "Sañcetaniyavagga",
	"an4-brahmanavagga": "Brāhmaṇavagga",
	"an4-mahavagga": "Mahāvagga",
	"an4-sappurisavagga": "Sappurisavagga",
	"an4-parisavagga": "Parisavagga",
	"an4-duccaritavagga": "Duccaritavagga",
	"an4-kammavagga": "Kammavagga",
	"an4-apattibhayavagga": "Āpattibhayavagga",
	"an4-abhinnavagga": "Abhiññāvagga",
	"an4-kammapathavagga": "Kammapathavagga",
	"an4-ragapeyyala": "Rāgapeyyāla",
	"an5-sekhabalavagga": "Sekhabalavagga",
	"an5-balavagga": "Balavagga",
	"an5-pancangikavagga": "Pañcaṅgikavagga",
	"an5-sumanavagga": "Sumanavagga",
	"an5-mundarajavagga": "Muṇḍarājavagga",
	"an5-nivaranavagga": "Nīvaraṇavagga",
	"an5-sannavagga": "Saññāvagga",
	"an5-yodhajivavagga": "Yodhājīvavagga",
	"an5-theravagga": "Theravagga",
	"an5-kakudhavagga": "Kakudhavagga",
	"an5-phasuviharavagga": "Phāsuvihāravagga",
	"an5-andhakavindavagga": "Andhakavindavagga",
	"an5-gilanavagga": "Gilānavagga",
	"an5-rajavagga": "Rājavagga",
	"an5-tikandakivagga": "Tikaṇḍakīvagga",
	"an5-saddhammavagga": "Saddhammavagga",
	"an5-aghatavagga": "Aghātavagga",
	"an5-upasakavagga": "Upāsakavagga",
	"an5-arannavagga": "Āraññavagga",
	"an5-brahmanavagga": "Brāhmaṇavagga",
	"an5-kimilavagga": "Kimilavagga",
	"an5-akkosakavagga": "Akkosakavagga",
	"an5-dighacarikavagga": "Dīghacārikavagga",
	"an5-avasikavagga": "Āvāsikavagga",
	"an5-duccaritavagga": "Duccaritavagga",
	"an5-upasampadavagga": "Upasampadāvagga",
	"an5-sammutipeyyala": "Sammutipeyyāla",
	"an5-sikkhapadapeyyala": "Sikkhāpadapeyyāla",
	"an5-ragapeyyala": "Rāgapeyyāla",
};

const dryRun = process.argv.includes("--dry-run");

function loadJson(relativePath) {
	return JSON.parse(
		readFileSync(path.join(PROJECT_ROOT, relativePath), "utf-8"),
	);
}

const mnTitleOverlay = loadJson("scripts/data/mnVaggaTitles.json");
const anTitleOverlay = loadJson("scripts/data/anVaggaTitles.json");

async function fetchJson(url) {
	try {
		const response = await fetch(url);
		if (!response.ok) {
			throw new Error(`HTTP ${response.status}`);
		}
		return response.json();
	} catch {
		console.warn(`fetch failed for ${url}, trying curl…`);
		const raw = execSync(`curl -fsSL "${url}"`, {
			encoding: "utf-8",
			timeout: 60_000,
		});
		return JSON.parse(raw);
	}
}

function parseSuttaRef(suttaId) {
	const range = suttaId.match(/^([a-z]+\d+)\.(\d+)-(\d+)$/);
	if (range) {
		return {
			start: Number(range[2]),
			end: Number(range[3]),
		};
	}
	const decimal = suttaId.match(/^([a-z]+\d+)\.(\d+)$/);
	if (decimal) {
		const num = Number(decimal[2]);
		return { start: num, end: num };
	}
	const simple = suttaId.match(/^([a-z]+)(\d+)$/);
	if (simple) {
		const num = Number(simple[2]);
		return { start: num, end: num };
	}
	throw new Error(`Unexpected sutta id: ${suttaId}`);
}

function suttaNumber(suttaId) {
	return parseSuttaRef(suttaId).start;
}

function suttaRangeFromIds(suttaIds) {
	let start = Number.POSITIVE_INFINITY;
	let end = 0;
	for (const id of suttaIds) {
		const range = parseSuttaRef(id);
		start = Math.min(start, range.start);
		end = Math.max(end, range.end);
	}
	return { start, end };
}

function expandSuttaIds(entries) {
	const ids = [];
	for (const entry of entries) {
		if (typeof entry === "string") {
			ids.push(entry);
			continue;
		}
		for (const nested of Object.values(entry)) {
			ids.push(...expandSuttaIds(nested));
		}
	}
	return ids;
}

function mnVaggaSlug(start, end) {
	return `mn${start}-${end}`;
}

function anVaggaSlug(book, start, end) {
	return `an${book}.${start}-${end}`;
}

function formatTitle(paliTitle, overlay, scKey) {
	const english = overlay?.englishSubtitle;
	if (english) {
		return `${paliTitle} - ${english}`;
	}
	return paliTitle;
}

function readEnMdxOverlay(slug) {
	const filePath = path.join(EN_AN_CONTENT, `${slug}.mdx`);
	if (!existsSync(filePath)) {
		return null;
	}
	const raw = readFileSync(filePath, "utf-8");
	const match = raw.match(
		/^---\n([\s\S]*?)\n---/,
	);
	if (!match) return null;
	const frontmatter = match[1];
	const titleMatch = frontmatter.match(/^title:\s*(.+)$/m);
	const descriptionMatch = frontmatter.match(/^description:\s*(.+)$/m);
	if (!titleMatch) return null;
	return {
		title: titleMatch[1].trim().replace(/^["']|["']$/g, ""),
		description: descriptionMatch?.[1]?.trim().replace(/^["']|["']$/g, ""),
	};
}

function buildVaggaEntry({
	scKey,
	paliTitle,
	suttaIds,
	overlay,
	slug,
}) {
	const mdxOverlay = readEnMdxOverlay(slug);
	const { start, end } = suttaRangeFromIds(suttaIds);

	return {
		title: mdxOverlay?.title ?? formatTitle(paliTitle, overlay, scKey),
		description: mdxOverlay?.description ?? overlay?.description,
		range: { start, end },
	};
}

function parseMnTree(tree) {
	const byPannasa = {};

	for (const pannasaEntry of tree.mn) {
		const [pannasaKey, vaggas] = Object.entries(pannasaEntry)[0];
		const pannasaSlug = MN_PANNASA_KEYS[pannasaKey];
		if (!pannasaSlug) {
			throw new Error(`Unknown paṇṇāsa key: ${pannasaKey}`);
		}

		byPannasa[pannasaSlug] = {};

		for (const vaggaEntry of vaggas) {
			const [vaggaKey, suttas] = Object.entries(vaggaEntry)[0];
			const numbers = suttas.map(suttaNumber);
			const start = Math.min(...numbers);
			const end = Math.max(...numbers);
			const slug = mnVaggaSlug(start, end);
			const paliTitle =
				MN_VAGGA_PALI_TITLES[vaggaKey] ??
				vaggaKey.replace(/^mn-/, "").replace(/vagga$/, "vagga");

			byPannasa[pannasaSlug][slug] = buildVaggaEntry({
				scKey: vaggaKey,
				paliTitle,
				suttaIds: suttas,
				overlay: mnTitleOverlay[vaggaKey],
				slug,
			});
		}
	}

	return byPannasa;
}

function collectAnBookVaggas(bookEntries, bookNum) {
	const vaggas = {};

	function walk(nodes) {
		for (const node of nodes) {
			if (typeof node !== "object" || node === null) continue;
			for (const [key, value] of Object.entries(node)) {
				if (key.includes("vagga") || key.includes("peyyala")) {
					const suttaIds = expandSuttaIds(value);
					const { start, end } = suttaRangeFromIds(suttaIds);
					const slug = anVaggaSlug(bookNum, start, end);
					const paliTitle =
						AN_VAGGA_PALI_TITLES[key] ??
						key.replace(/^an\d+-/, "").replace(/vagga$/, "vagga");
					vaggas[slug] = buildVaggaEntry({
						scKey: key,
						paliTitle,
						suttaIds,
						overlay: anTitleOverlay[key],
						slug,
					});
				} else {
					walk(Array.isArray(value) ? value : [value]);
				}
			}
		}
	}

	walk(bookEntries);
	return vaggas;
}

function parseAnTree(tree) {
	const result = {};

	for (const bookEntry of tree.an) {
		const [bookKey, sections] = Object.entries(bookEntry)[0];
		if (bookKey !== "an4" && bookKey !== "an5") continue;
		const bookNum = Number(bookKey.replace("an", ""));
		result[bookKey] = collectAnBookVaggas(sections, bookNum);
	}

	return result;
}

function renderMnTypeScript(structure) {
	return `// This file is auto-generated by scripts/import-sc-structure.mjs — do not edit directly
import type { DirectoryStructure } from "../types/directory";

/** MN vagga sections keyed by paṇṇāsa slug (mn1-50, mn51-100, mn101-152). UI grouping only — not collection routes. */
export const mnVaggaSections: Record<string, Record<string, DirectoryStructure>> = ${JSON.stringify(structure, null, "\t")};
`;
}

function renderAnTypeScript(structure) {
	return `// This file is auto-generated by scripts/import-sc-structure.mjs — do not edit directly
import type { DirectoryStructure } from "../types/directory";

/** AN vagga sections for pilot books (an4, an5). Not collection routes — UI grouping only. */
export const anVaggaSections: Record<string, Record<string, DirectoryStructure>> = ${JSON.stringify(structure, null, "\t")};
`;
}

async function main() {
	console.log("Fetching MN structure from sc-data…");
	const mnTree = await fetchJson(`${SC_DATA_BASE}/tree/sutta/mn-tree.json`);
	const mnStructure = parseMnTree(mnTree);

	const mnVaggaCount = Object.values(mnStructure).reduce(
		(sum, vaggas) => sum + Object.keys(vaggas).length,
		0,
	);
	console.log(
		`Parsed ${mnVaggaCount} MN vaggas across ${Object.keys(mnStructure).length} paṇṇāsas.`,
	);

	console.log("Fetching AN structure from sc-data…");
	const anTree = await fetchJson(`${SC_DATA_BASE}/tree/sutta/an-tree.json`);
	const anStructure = parseAnTree(anTree);
	const anVaggaCount = Object.values(anStructure).reduce(
		(sum, vaggas) => sum + Object.keys(vaggas).length,
		0,
	);
	console.log(
		`Parsed ${anVaggaCount} AN vaggas across ${Object.keys(anStructure).length} books (pilot).`,
	);

	if (dryRun) {
		console.log(renderMnTypeScript(mnStructure));
		console.log(renderAnTypeScript(anStructure));
		return;
	}

	writeFileSync(MN_OUTPUT_PATH, renderMnTypeScript(mnStructure), "utf-8");
	console.log(`Wrote ${MN_OUTPUT_PATH}`);

	writeFileSync(AN_OUTPUT_PATH, renderAnTypeScript(anStructure), "utf-8");
	console.log(`Wrote ${AN_OUTPUT_PATH}`);
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});
