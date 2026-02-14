/**
 * Translation Memory Matching Utility
 * MVP Phase - Paragraph-level matching with Dice coefficient
 */

import type {
	TMEntry,
	TMMatch,
	TMMatchSummary,
	TranslationMemoryIndex,
} from "../types/translationMemory";

// MVP Thresholds
const THRESHOLDS = {
	PARAGRAPH_SIMILARITY: 0.8, // 80% for paragraph-level match
	WORD_COUNT_TOLERANCE: 0.3, // Pre-filter: only compare paragraphs within ±30% word count (more lenient for MVP)
};

let cachedIndex: TranslationMemoryIndex | null = null;

/**
 * Load the translation memory index (cached)
 */
export async function loadIndex(): Promise<TranslationMemoryIndex | null> {
	if (cachedIndex) return cachedIndex;

	try {
		// Read from public/ directory (avoids Vite module graph invalidation)
		const { readFile } = await import("node:fs/promises");
		const { join, dirname } = await import("node:path");
		const { fileURLToPath } = await import("node:url");
		const __dirname = dirname(fileURLToPath(import.meta.url));
		const filePath = join(__dirname, "../../public/translationMemory.json");
		const raw = await readFile(filePath, "utf-8");
		cachedIndex = JSON.parse(raw) as TranslationMemoryIndex;
		return cachedIndex;
	} catch (err) {
		console.warn(
			"Translation Memory index not found. Run: npx tsx src/utils/generateTranslationMemory.ts",
		);
		return null;
	}
}

/**
 * Normalize Pali text for matching
 */
export function normalizePali(text: string): string {
	return text
		.toLowerCase()
		.replace(/['"'"'"«»„"]/g, "")
		.replace(/[।.,;:!?…—–\-\(\)\[\]\{\}]/g, "")
		.replace(/\s+/g, " ")
		.trim();
}

/**
 * Calculate Sørensen–Dice coefficient between two word arrays
 * Returns value between 0 and 1
 */
function diceSimilarity(a: string[], b: string[]): number {
	if (a.length === 0 && b.length === 0) return 1;
	if (a.length === 0 || b.length === 0) return 0;

	const setA = new Set(a);
	const setB = new Set(b);
	const intersection = [...setA].filter((x) => setB.has(x)).length;

	return (2 * intersection) / (setA.size + setB.size);
}

/**
 * Pre-filter candidates by word count
 */
function preFilterCandidates(
	queryWordCount: number,
	entries: TMEntry[],
): TMEntry[] {
	const tolerance = THRESHOLDS.WORD_COUNT_TOLERANCE;
	const minWords = queryWordCount * (1 - tolerance);
	const maxWords = queryWordCount * (1 + tolerance);
	return entries.filter(
		(e) => e.wordCount >= minWords && e.wordCount <= maxWords,
	);
}

/**
 * Find the best matching paragraph for a given Pali text
 * Returns null if no match above threshold
 */
export async function findBestMatch(
	queryPali: string,
	currentSuttaId?: string,
): Promise<TMMatch | null> {
	const index = await loadIndex();
	if (!index || index.entries.length === 0) return null;

	const queryNormalized = normalizePali(queryPali);
	const queryWords = queryNormalized.split(/\s+/).filter((w) => w.length > 0);

	if (queryWords.length < 4) return null; // Skip very short paragraphs

	// Pre-filter by word count
	const candidates = preFilterCandidates(queryWords.length, index.entries);

	let bestMatch: TMEntry | null = null;
	let bestScore = 0;

	for (const entry of candidates) {
		// Skip if from the same sutta (don't match against yourself)
		if (currentSuttaId && entry.source.suttaId === currentSuttaId) continue;

		const entryWords = entry.paliNormalized
			.split(/\s+/)
			.filter((w) => w.length > 0);
		const score = diceSimilarity(queryWords, entryWords);

		if (score >= THRESHOLDS.PARAGRAPH_SIMILARITY && score > bestScore) {
			bestScore = score;
			bestMatch = entry;
		}
	}

	if (!bestMatch) return null;

	return {
		matchType: "paragraph",
		similarity: bestScore,
		matchedPali: bestMatch.paliOriginal,
		fullEnglish: bestMatch.englishOriginal,
		source: bestMatch.source,
	};
}

/**
 * Find matches and return a summary for display
 */
export async function findMatches(
	queryPali: string,
	currentSuttaId?: string,
): Promise<TMMatchSummary> {
	const match = await findBestMatch(queryPali, currentSuttaId);

	if (!match) {
		return {
			match: null,
			summaryText: "",
		};
	}

	const percentage = Math.round(match.similarity * 100);
	const summaryText = `📖 Found similar: ${match.source.suttaId} ¶${match.source.paragraphNum} (${percentage}%)`;

	return {
		match,
		summaryText,
	};
}
