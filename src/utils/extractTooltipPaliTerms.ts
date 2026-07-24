import { readFileSync } from "node:fs";
import { join } from "node:path";
import { globSync } from "glob";
import type { SuggestionIndexEntry } from "../types/suggestions";
import { normalizeForComparison } from "./searchRanking";

/** Bracketed Pali at the end of an MDX gloss: |English::definition [pali]| */
const GLOSS_PALI_RE = /\|[^|]*\[([^\]]+)\]\|/g;

function splitPaliTerms(raw: string): string[] {
	return raw
		.split(",")
		.map((part) => part.trim())
		.filter((part) => part.length >= 2);
}

/** Pali terms from English MDX tooltip glosses. */
export function buildTooltipPaliEntries(
	enContentRoot: string,
	existingNorms: Set<string>,
): SuggestionIndexEntry[] {
	const files = globSync("**/*.mdx", { cwd: enContentRoot });
	const entries: SuggestionIndexEntry[] = [];
	const seen = new Set(existingNorms);

	for (const rel of files) {
		const text = readFileSync(join(enContentRoot, rel), "utf8");
		for (const match of text.matchAll(GLOSS_PALI_RE)) {
			const bracketed = match[1];
			if (!bracketed) continue;

			for (const term of splitPaliTerms(bracketed)) {
				const norm = normalizeForComparison(term);
				if (norm.length < 2 || seen.has(norm)) continue;
				seen.add(norm);
				entries.push({
					text: term,
					norm,
					source: "tooltip",
					entityType: "topic",
				});
			}
		}
	}

	return entries.sort((a, b) => a.text.localeCompare(b.text));
}

export { GLOSS_PALI_RE };
