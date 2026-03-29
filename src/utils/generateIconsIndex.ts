/**
 * Writes icons-index.md (LLM-friendly table) from icons-manifest.json
 * Run: npx tsx src/utils/generateIconsIndex.ts
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(process.cwd());
const MANIFEST = resolve(
	ROOT,
	"src/assets/content-images/design-system/icons-manifest.json",
);
const OUT = resolve(
	ROOT,
	"src/assets/content-images/design-system/icons-index.md",
);

type Icon = {
	id: string;
	title: string;
	description: string;
	discourse: string | string[];
	sourceGraphic: string;
	tags: string[];
	labels: string[];
	svg: string;
};

type Manifest = { version: number; icons: Icon[] };

function main() {
	const raw = JSON.parse(readFileSync(MANIFEST, "utf8")) as Manifest;
	const lines: string[] = [
		"# Design system icons index",
		"",
		`Generated from \`icons-manifest.json\` (version ${raw.version}).`,
		"",
		"| id | title | discourse | sourceGraphic | labels | tags | svg |",
		"|----|-------|-------------|---------------|--------|------|-----|",
	];
	for (const i of raw.icons) {
		const d = Array.isArray(i.discourse) ? i.discourse.join(", ") : i.discourse;
		const esc = (s: string) => s.replace(/\|/g, "\\|").replace(/\n/g, " ");
		const lab = (i.labels ?? []).join(", ");
		const tg = (i.tags ?? []).join(", ");
		lines.push(
			`| ${esc(i.id)} | ${esc(i.title)} | ${esc(d)} | ${esc(i.sourceGraphic)} | ${esc(lab)} | ${esc(tg)} | \`${esc(i.svg)}\` |`,
		);
	}
	lines.push("");
	writeFileSync(OUT, lines.join("\n"), "utf8");
	console.log("Wrote", OUT.replace(ROOT + "/", ""));
}

main();
