/* Build-time generator for offline-manifest.json
 * - onPages: all /on/:slug pages
 * - collectionPages: all collection slugs (/[collection])
 * - discourseByCollection: map of collection -> array of /:route pages
 * - coreAssets: known public assets and fonts to precache
 */
import { writeFileSync, mkdirSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { getStaticOnSlugs } from "./discover-data";
import { directoryStructure } from "../data/directoryStructure";
import { routes } from "../utils/routes";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function collectCollectionSlugs(): string[] {
	const slugs: string[] = [];
	function walk(map: Record<string, any>) {
		for (const key of Object.keys(map)) {
			slugs.push(key);
			const child = (map as any)[key]?.children;
			if (child && typeof child === "object") walk(child);
		}
	}
	walk(directoryStructure as any);
	return Array.from(new Set(slugs)).sort();
}

function groupDiscoursesByCollection(): Record<string, string[]> {
	const grouped: Record<string, string[]> = {};
	for (const r of routes) {
		const m = r.match(/^([a-z]+)/);
		if (!m) continue;
		const col = m[1];
		if (!grouped[col]) grouped[col] = [];
		grouped[col].push("/" + r);
	}
	// sort per collection
	Object.keys(grouped).forEach((k) => grouped[k].sort());
	return grouped;
}

function buildCoreAssets(): string[] {
	// Known icons and common assets. Workbox will also handle revisioned files.
	return [
		"/",
		"/favicon.ico",
		"/favicon.svg",
		"/favicon-16x16.png",
		"/favicon-32x32.png",
		"/apple-touch-icon.png",
		"/android-chrome-192x192.png",
		"/android-chrome-512x512.png",
		"/robots.txt",
		// Fonts (local)
		"/assets/fonts/Spectral-Regular.woff2",
		"/assets/fonts/Spectral-Italic.woff2",
		"/assets/fonts/GentiumPlus-Regular.ttf",
	];
}

function main() {
	const onSlugs = getStaticOnSlugs();
	const onPages = onSlugs.map((s) => `/on/${s}`);
	const collectionPages = collectCollectionSlugs().map((s) => `/${s}`);
	const discourseByCollection = groupDiscoursesByCollection();
	const coreAssets = buildCoreAssets();
	const payload = {
		version: Date.now(),
		onPages,
		collectionPages,
		discourseByCollection,
		coreAssets,
	};

	const outDir = join(__dirname, "../../public");
	try {
		mkdirSync(outDir, { recursive: true });
	} catch {}
	const outPath = join(outDir, "offline-manifest.json");
	writeFileSync(outPath, JSON.stringify(payload, null, 2), "utf-8");
	console.log(`[offline] Wrote ${outPath}`);
}

main();
