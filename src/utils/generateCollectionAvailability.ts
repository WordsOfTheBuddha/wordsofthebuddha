#!/usr/bin/env node

import fs from "fs/promises";
import path from "path";
import { directoryStructureWithCounts } from "../data/directoryStructureWithCounts";
import {
	CANONICAL_TOTALS,
	COMPLETE_COLLECTIONS,
	countReadableUnitsForCollection,
	enrichDirectoryWithAvailability,
	siteAvailability,
} from "./collectionAvailabilityCounts";

async function main() {
	const enriched = enrichDirectoryWithAvailability(
		directoryStructureWithCounts,
	);

	// Complete collections: align readable/translated with discourse-level contentCount
	for (const key of COMPLETE_COLLECTIONS) {
		const node = enriched[key];
		if (!node?.contentCount) continue;
		node.readableCount = node.contentCount;
		node.translatedCount = node.contentCount;
		if (node.children) {
			for (const child of Object.values(node.children)) {
				if (child.contentCount) {
					child.readableCount = child.contentCount;
					child.translatedCount = child.contentCount;
				}
			}
		}
	}

	const collectionAvailability = Object.fromEntries(
		Object.keys(CANONICAL_TOTALS).map((name) => {
			const node = enriched[name];
			const isComplete = COMPLETE_COLLECTIONS.has(name);
			return [
				name,
				{
					translatedCount: isComplete
						? (node?.contentCount ?? 0)
						: (node?.translatedCount ?? 0),
					readableCount: isComplete
						? (node?.contentCount ?? 0)
						: (node?.readableCount ?? 0),
					total: CANONICAL_TOTALS[name],
				},
			];
		}),
	);

	const unitCount = Object.keys(CANONICAL_TOTALS).reduce(
		(sum, name) =>
			sum + countReadableUnitsForCollection(name, enriched[name]),
		0,
	);

	const siteTotals = {
		...siteAvailability,
		unitCount,
	};

	const dataDir = path.join(process.cwd(), "src/data");

	await fs.writeFile(
		path.join(dataDir, "collectionAvailability.ts"),
		`// This file is auto-generated - do not edit directly

export const siteAvailability = ${JSON.stringify(siteTotals, null, 2)} as const;

export type CollectionAvailability = {
	translatedCount: number;
	readableCount: number;
	total: number;
};

export const collectionAvailability: Record<string, CollectionAvailability> = ${JSON.stringify(collectionAvailability, null, 2)};
`,
	);

	await fs.writeFile(
		path.join(dataDir, "directoryStructureWithCounts.ts"),
		`// This file is auto-generated - do not edit directly
import type { DirectoryStructure } from "../types/directory";

export const directoryStructureWithCounts: Record<string, DirectoryStructure> = ${JSON.stringify(enriched, null, 2)};
`,
	);

	console.log(
		`collection-availability: wrote collectionAvailability.ts (${unitCount} units)`,
	);
}

main().catch((error) => {
	console.error("Error generating collection availability:", error);
	process.exit(1);
});
