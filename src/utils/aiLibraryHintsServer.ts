import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import qualities from "../data/qualities.json";
import topicMappings from "../data/topicMappings.json";
import { buildAiLibraryHints } from "./aiLibraryHints";

interface AiDiscourseCatalogFile {
	promptBlock?: string;
	count?: number;
}

function loadDiscourseCatalogBlock(): string {
	const here = path.dirname(fileURLToPath(import.meta.url));
	const candidates = [
		path.join(process.cwd(), "generated", "ai-discourse-catalog.json"),
		path.resolve(here, "../../generated/ai-discourse-catalog.json"),
	];
	for (const file of candidates) {
		try {
			const parsed = JSON.parse(readFileSync(file, "utf8")) as AiDiscourseCatalogFile;
			if (typeof parsed.promptBlock === "string" && parsed.promptBlock.trim()) {
				return parsed.promptBlock.trim();
			}
		} catch {
			/* try next */
		}
	}
	return "";
}

let cachedHints: string | null = null;

export function getAiLibraryHintsText(): string {
	if (cachedHints !== null) return cachedHints;
	const topicTitles = Object.values(
		topicMappings as Record<string, { title?: string }>,
	)
		.map((item) => (item.title || "").trim())
		.filter(Boolean);
	const qualityTitles = Object.keys(
		(qualities as { qualities?: Record<string, unknown> }).qualities || {},
	)
		.map((key) => key.replace(/-/g, " "))
		.sort((a, b) => a.localeCompare(b));
	cachedHints = buildAiLibraryHints({
		topicTitles,
		qualityTitles,
		discourseCatalogBlock: loadDiscourseCatalogBlock(),
	});
	return cachedHints;
}
