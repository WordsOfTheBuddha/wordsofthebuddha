#!/usr/bin/env node

/**
 * Translation Memory Index Generator
 * Builds paragraph-level index + n-gram index for partial phrase matching
 *
 * Run: npx tsx src/utils/generateTranslationMemory.ts
 */

import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { glob } from "glob";
import matter from "gray-matter";
import type {
	TMEntry,
	TranslationMemoryIndex,
	NgramIndex,
} from "../types/translationMemory";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CONTENT_DIR = path.join(__dirname, "..", "content");
const OUTPUT_FILE = path.join(
	__dirname,
	"..",
	"data",
	"translationMemory.json",
);

// Minimum words to index a paragraph (skip very short ones)
const MIN_WORDS_TO_INDEX = 4;

// N-gram configuration
const NGRAM_SIZE = 5; // 5-word sequences
const MAX_NGRAM_FREQUENCY = 0.1; // Skip n-grams appearing in >10% of paragraphs (too common)

/**
 * Normalize Pali text for matching
 * - Lowercase
 * - Strip punctuation
 * - Normalize whitespace
 */
function normalizePali(text: string): string {
	return (
		text
			.toLowerCase()
			// Strip all quotes (single, double, curly) - using Unicode escapes to be explicit
			.replace(
				/['"«»„\u2018\u2019\u201A\u201B\u201C\u201D\u201E\u201F\u2039\u203A]/g,
				"",
			)
			// Strip punctuation including Pali danda
			.replace(/[।.,;:!?…—–\-\(\)\[\]\{\}]/g, "")
			// Normalize whitespace
			.replace(/\s+/g, " ")
			.trim()
	);
}

/**
 * Extract paragraphs from markdown content
 * Returns array of paragraph texts (excluding headings, frontmatter, etc.)
 */
function extractParagraphs(content: string): string[] {
	// Remove frontmatter
	const { content: body } = matter(content);

	// Split into blocks
	const blocks = body
		.split(/\n\n+/)
		.map((b) => b.trim())
		.filter((b) => b.length > 0);

	// Filter to plain paragraphs only
	return blocks.filter((block) => {
		// Skip headings
		if (block.startsWith("#")) return false;
		// Skip code blocks
		if (block.startsWith("```")) return false;
		// Skip HTML elements (except collapse which wraps content)
		if (block.startsWith("<") && !block.startsWith("<collapse>"))
			return false;
		// Skip horizontal rules
		if (block.startsWith("---")) return false;
		return true;
	});
}

/**
 * Extract sutta ID and collection from file path
 * e.g., "mn/mn1.md" -> { suttaId: "mn1", collection: "mn" }
 */
function extractSourceInfo(filePath: string): {
	suttaId: string;
	collection: string;
} {
	const relativePath = filePath.replace(/\\/g, "/");
	const match = relativePath.match(
		/\/([a-z]+)\/([a-z]+\d+(?:\.\d+)?)\.(md|mdx)$/i,
	);
	if (match) {
		return {
			collection: match[1].toLowerCase(),
			suttaId: match[2].toLowerCase(),
		};
	}
	// Fallback
	const filename = path.basename(filePath, path.extname(filePath));
	return {
		suttaId: filename.toLowerCase(),
		collection: filename.replace(/\d+.*/, "").toLowerCase(),
	};
}

/**
 * Extract n-grams (word sequences) from normalized text
 */
function extractNgrams(normalizedText: string, n: number): string[] {
	const words = normalizedText.split(/\s+/).filter((w) => w.length > 0);
	if (words.length < n) return [];

	const ngrams: string[] = [];
	for (let i = 0; i <= words.length - n; i++) {
		ngrams.push(words.slice(i, i + n).join(" "));
	}
	return ngrams;
}

async function main() {
	console.log("🔍 Building Translation Memory index...");
	const startTime = Date.now();

	const entries: TMEntry[] = [];

	// Find all Pali files
	const paliFiles = await glob("pli/**/*.md", { cwd: CONTENT_DIR });
	console.log(`   Found ${paliFiles.length} Pali files`);

	let matchedFiles = 0;
	let totalParagraphs = 0;

	for (const paliFile of paliFiles) {
		// Check for corresponding English file (.md or .mdx)
		const englishFileBase = paliFile
			.replace(/^pli\//, "en/")
			.replace(/\.md$/, "");
		const englishFileMd = englishFileBase + ".md";
		const englishFileMdx = englishFileBase + ".mdx";

		let englishContent: string | null = null;
		let englishPath: string | null = null;

		try {
			englishContent = await readFile(
				path.join(CONTENT_DIR, englishFileMdx),
				"utf-8",
			);
			englishPath = englishFileMdx;
		} catch {
			try {
				englishContent = await readFile(
					path.join(CONTENT_DIR, englishFileMd),
					"utf-8",
				);
				englishPath = englishFileMd;
			} catch {
				// No English translation exists
				continue;
			}
		}

		if (!englishContent) continue;

		matchedFiles++;
		const paliContent = await readFile(
			path.join(CONTENT_DIR, paliFile),
			"utf-8",
		);

		const paliParagraphs = extractParagraphs(paliContent);
		const englishParagraphs = extractParagraphs(englishContent);

		const { suttaId, collection } = extractSourceInfo(paliFile);

		// Pair paragraphs by index
		const pairCount = Math.min(
			paliParagraphs.length,
			englishParagraphs.length,
		);

		for (let i = 0; i < pairCount; i++) {
			const paliOriginal = paliParagraphs[i];
			const englishOriginal = englishParagraphs[i];

			const paliNormalized = normalizePali(paliOriginal);
			const wordCount = paliNormalized
				.split(/\s+/)
				.filter((w) => w.length > 0).length;

			// Skip very short paragraphs
			if (wordCount < MIN_WORDS_TO_INDEX) continue;

			const entryId = entries.length; // ID before pushing
			entries.push({
				id: entryId,
				paliNormalized,
				paliOriginal,
				englishOriginal,
				wordCount,
				source: {
					suttaId,
					paragraphNum: i + 1,
					collection,
				},
			});
			totalParagraphs++;
		}
	}

	// Build n-gram index
	console.log("   Building n-gram index...");
	const ngramMap = new Map<string, number[]>();

	for (const entry of entries) {
		const ngrams = extractNgrams(entry.paliNormalized, NGRAM_SIZE);
		for (const ngram of ngrams) {
			if (!ngramMap.has(ngram)) {
				ngramMap.set(ngram, []);
			}
			ngramMap.get(ngram)!.push(entry.id);
		}
	}

	// Filter out overly common n-grams (appear in >10% of paragraphs)
	const maxFrequency = Math.floor(entries.length * MAX_NGRAM_FREQUENCY);
	const ngrams: NgramIndex = {};
	let filteredCount = 0;

	for (const [ngram, entryIds] of ngramMap) {
		if (entryIds.length <= maxFrequency) {
			ngrams[ngram] = entryIds;
		} else {
			filteredCount++;
		}
	}

	console.log(`   - ${ngramMap.size} unique n-grams extracted`);
	console.log(`   - ${filteredCount} common n-grams filtered out`);
	console.log(`   - ${Object.keys(ngrams).length} n-grams in final index`);

	// Build the index
	const index: TranslationMemoryIndex = {
		version: 2, // Bumped version for n-gram support
		generatedAt: new Date().toISOString(),
		entries,
		ngrams,
		ngramSize: NGRAM_SIZE,
	};

	// Ensure data directory exists
	await mkdir(path.dirname(OUTPUT_FILE), { recursive: true });

	// Write the index (minified to reduce size)
	const indexJson = JSON.stringify(index);
	await writeFile(OUTPUT_FILE, indexJson, "utf-8");

	const duration = Date.now() - startTime;
	const fileSizeKB = Math.round(indexJson.length / 1024);

	console.log(`✅ Translation Memory index built successfully!`);
	console.log(`   - ${matchedFiles} files with translations`);
	console.log(`   - ${totalParagraphs} indexed paragraphs`);
	console.log(`   - ${fileSizeKB} KB index size`);
	console.log(`   - Built in ${duration}ms`);
	console.log(`   - Output: ${OUTPUT_FILE}`);
}

main().catch((err) => {
	console.error("❌ Error building Translation Memory index:", err);
	process.exit(1);
});
