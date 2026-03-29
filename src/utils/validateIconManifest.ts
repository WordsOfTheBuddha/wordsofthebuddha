/**
 * Validates icons-manifest.json against files on disk.
 * Run: npx tsx src/utils/validateIconManifest.ts
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

const ROOT = resolve(process.cwd());
const MANIFEST = resolve(
	ROOT,
	"src/assets/content-images/design-system/icons-manifest.json",
);
const DS = resolve(ROOT, "src/assets/content-images/design-system");

type Icon = {
	id: string;
	title: string;
	description: string;
	discourse: string | string[];
	sourceGraphic: string;
	tags: string[];
	svg: string;
	labels: string[];
};

type Manifest = { version: number; icons: Icon[] };

function walkSvgFiles(dir: string, base: string[] = []): string[] {
	if (!existsSync(dir)) return [];
	const out: string[] = [];
	for (const name of readdirSync(dir)) {
		const p = join(dir, name);
		const rel = [...base, name].join("/");
		if (statSync(p).isDirectory()) out.push(...walkSvgFiles(p, [...base, name]));
		else if (name.endsWith(".svg")) out.push(rel);
	}
	return out;
}

function main() {
	if (!existsSync(MANIFEST)) {
		console.error("Missing manifest:", MANIFEST);
		process.exit(1);
	}
	const raw = JSON.parse(readFileSync(MANIFEST, "utf8")) as Manifest;
	const errors: string[] = [];

	if (typeof raw.version !== "number") errors.push("version must be a number");
	if (!Array.isArray(raw.icons)) errors.push("icons must be an array");

	const seenIds = new Set<string>();
	for (const icon of raw.icons ?? []) {
		if (!icon.id || typeof icon.id !== "string")
			errors.push("icon missing id");
		else if (seenIds.has(icon.id)) errors.push(`duplicate id: ${icon.id}`);
		else seenIds.add(icon.id);

		if (!icon.svg?.endsWith(".svg"))
			errors.push(`${icon.id}: svg must be a .svg path`);

		const abs = join(DS, icon.svg);
		if (!existsSync(abs)) errors.push(`missing file for ${icon.id}: ${icon.svg}`);

		if (!icon.sourceGraphic?.endsWith(".svg"))
			errors.push(`${icon.id}: sourceGraphic should end with .svg`);
	}

	const manifestPaths = new Set(raw.icons.map((i) => i.svg.replace(/^\//, "")));
	const iconsDir = join(DS, "icons");
	const onDisk = walkSvgFiles(iconsDir).map((p) =>
		`icons/${p.replace(/\\/g, "/")}`,
	);
	for (const f of onDisk) {
		if (!manifestPaths.has(f)) errors.push(`orphan SVG not in manifest: ${f}`);
	}

	if (manifestPaths.size !== onDisk.length) {
		errors.push(
			`unique manifest svg paths (${manifestPaths.size}) must equal SVG files on disk (${onDisk.length}); check orphans or missing files`,
		);
	}

	if (errors.length) {
		console.error("validateIconManifest failed:\n", errors.join("\n"));
		process.exit(1);
	}
	const shared =
		raw.icons.length - manifestPaths.size > 0
			? ` (${raw.icons.length - manifestPaths.size} manifest entries reuse an existing file)`
			: "";
	console.log(
		"validateIconManifest OK:",
		raw.icons.length,
		"manifest entries,",
		onDisk.length,
		"SVG files" + shared,
	);
}

main();
