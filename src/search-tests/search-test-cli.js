#!/usr/bin/env node

/**
 * Search Test CLI
 *
 * Runs search ranking tests with snapshot comparison and optional AI evaluation.
 *
 * Usage:
 *   node search-test-cli.js                    # Run all tests
 *   node search-test-cli.js --query "craving"  # Test single query
 *   node search-test-cli.js --update           # Update snapshots
 *   node search-test-cli.js --ai-eval          # Include AI evaluation
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { config } from "dotenv";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from project root (two directories up from search-tests)
const projectRoot = path.resolve(__dirname, "../..");
config({ path: path.join(projectRoot, ".env") });

// Paths
const SNAPSHOTS_DIR = path.join(__dirname, "snapshots");
const REPORTS_DIR = path.join(__dirname, "reports");
const TEST_QUERIES_PATH = path.join(__dirname, "test-queries.json");

// Ensure directories exist
[SNAPSHOTS_DIR, REPORTS_DIR].forEach((dir) => {
	if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// Parse CLI arguments
const args = process.argv.slice(2);
const flags = {
	query: null, // Ad-hoc query to run
	id: null, // Filter tests by id pattern
	update: args.includes("--update"),
	aiEval: args.includes("--ai-eval"),
	verbose: args.includes("--verbose") || args.includes("-v"),
	diff: args.includes("--diff"),
	add: args.includes("--add"), // Add ad-hoc query to test suite
};

// Parse --query "term" (ad-hoc search)
const queryIdx = args.indexOf("--query");
if (queryIdx !== -1 && args[queryIdx + 1]) {
	flags.query = args[queryIdx + 1];
}

// Parse --id "pattern" (filter existing tests)
const idIdx = args.indexOf("--id");
if (idIdx !== -1 && args[idIdx + 1]) {
	flags.id = args[idIdx + 1];
}

// ==================== COLORS ====================
const c = {
	reset: "\x1b[0m",
	bold: "\x1b[1m",
	dim: "\x1b[2m",
	red: "\x1b[31m",
	green: "\x1b[32m",
	yellow: "\x1b[33m",
	blue: "\x1b[34m",
	magenta: "\x1b[35m",
	cyan: "\x1b[36m",
	white: "\x1b[37m",
	bgRed: "\x1b[41m",
	bgGreen: "\x1b[42m",
	bgYellow: "\x1b[43m",
};

// ==================== HELPERS ====================
// Word wrap text to fit within a given width
function wordWrap(text, maxWidth = 80, indent = "│ ") {
	if (!text) return "";
	const words = text.split(/\s+/);
	const lines = [];
	let currentLine = "";

	for (const word of words) {
		if ((currentLine + " " + word).trim().length <= maxWidth) {
			currentLine = currentLine ? currentLine + " " + word : word;
		} else {
			if (currentLine) lines.push(currentLine);
			currentLine = word;
		}
	}
	if (currentLine) lines.push(currentLine);

	return lines.map((line, i) => (i === 0 ? line : indent + line)).join("\n");
}

// Strip HTML tags for cleaner display
function stripHtml(text) {
	return (text || "").replace(/<[^>]*>/g, "");
}

// ==================== ASCII CARD RENDERING ====================
function renderCard(result, rank) {
	const width = 72;
	const textWidth = 78; // Account for box borders and padding
	const line = "─".repeat(width);
	const indent = "│ ";

	const typeIcon =
		{
			"topic-quality": "📚",
			discourse: "📜",
			simile: "🔥",
		}[result.type] || "📄";

	const title = (result.title || result.name || "").substring(0, 50);
	const slug = result.slug || result.id || "";
	// Strip HTML and annotation syntax for cleaner display
	const desc = stripHtml(
		(result.description || "").replace(/\|(.+?)::[^|]+\|/g, "$1"),
	);
	const content = stripHtml(
		(result.contentSnippet || "").replace(/\|(.+?)::[^|]+\|/g, "$1"),
	);
	const pali = result.pali?.join(", ") || "";
	const synonyms = result.synonyms?.join(", ") || "";

	let card = `
┌${line}┐
│ ${c.bold}#${rank}${c.reset} │ ${typeIcon} ${c.cyan}${result.type}${c.reset} │ Score: ${c.yellow}${result.score}${c.reset} │ ${c.dim}${result.matchType}${c.reset}
├${line}┤
│ ${c.bold}${title}${c.reset}
│ ${c.dim}${slug}${c.reset}`;

	if (desc) {
		card += `\n│ ${c.cyan}${wordWrap(desc, textWidth, indent + c.cyan)}${c.reset}`;
	}
	if (pali) {
		card += `\n│ ${c.magenta}Pali: ${wordWrap(pali, textWidth - 6, indent + c.magenta)}${c.reset}`;
	}
	if (synonyms) {
		card += `\n│ ${c.blue}Synonyms: ${wordWrap(synonyms, textWidth - 10, indent + c.blue)}${c.reset}`;
	}
	if (content) {
		card += `\n│ ${c.dim}Content: ${wordWrap(content, textWidth - 9, indent + c.dim)}${c.reset}`;
	}

	card += `\n│ ${c.dim}NonStop: ${result.nonStopwordMatches || 0} | Priority: ${result.priority || 1}${c.reset}`;
	card += `\n└${line}┘`;

	return card;
}

// ==================== SNAPSHOT MANAGEMENT ====================
function getSnapshotPath(queryId) {
	return path.join(SNAPSHOTS_DIR, `${queryId}.json`);
}

function loadSnapshot(queryId) {
	const snapshotPath = getSnapshotPath(queryId);
	if (fs.existsSync(snapshotPath)) {
		return JSON.parse(fs.readFileSync(snapshotPath, "utf-8"));
	}
	return null;
}

function saveSnapshot(queryId, data) {
	const snapshotPath = getSnapshotPath(queryId);
	fs.writeFileSync(snapshotPath, JSON.stringify(data, null, 2));
}

// ==================== ASSERTION CHECKING ====================
function checkAssertions(results, assertions) {
	const failures = [];
	const passes = [];

	for (const assertion of assertions) {
		const result = checkAssertion(results, assertion);
		if (result.pass) {
			passes.push({ assertion, ...result });
		} else {
			failures.push({ assertion, ...result });
		}
	}

	return { passes, failures };
}

function checkAssertion(results, assertion) {
	const { type } = assertion;

	if (type === "has") {
		// Check if item exists at expected position
		const matchIdx = results.findIndex((r) => {
			if (
				assertion.slug &&
				(r.slug === assertion.slug || r.id === assertion.slug)
			)
				return true;
			if (
				assertion.slugPrefix &&
				(r.slug?.startsWith(assertion.slugPrefix) ||
					r.id?.startsWith(assertion.slugPrefix))
			)
				return true;
			if (
				assertion.titleContains &&
				r.title
					?.toLowerCase()
					.includes(assertion.titleContains.toLowerCase())
			)
				return true;
			return false;
		});

		if (matchIdx === -1) {
			return {
				pass: false,
				message: `Not found: ${assertion.slug || assertion.slugPrefix || assertion.titleContains}`,
			};
		}

		const actualPosition = matchIdx + 1;

		if (assertion.position && actualPosition !== assertion.position) {
			return {
				pass: false,
				message: `Expected at #${assertion.position}, found at #${actualPosition}`,
				actual: actualPosition,
			};
		}

		if (assertion.maxPosition && actualPosition > assertion.maxPosition) {
			return {
				pass: false,
				message: `Expected within top ${assertion.maxPosition}, found at #${actualPosition}`,
				actual: actualPosition,
			};
		}

		return {
			pass: true,
			message: `Found at #${actualPosition}`,
			actual: actualPosition,
		};
	}

	if (type === "not") {
		// Check item is NOT in top N positions
		const matchIdx = results
			.slice(0, assertion.maxPosition || 3)
			.findIndex((r) => {
				if (
					assertion.slug &&
					(r.slug === assertion.slug || r.id === assertion.slug)
				)
					return true;
				return false;
			});

		if (matchIdx !== -1) {
			return {
				pass: false,
				message: `Should NOT be in top ${assertion.maxPosition || 3}, found at #${matchIdx + 1}`,
			};
		}

		return {
			pass: true,
			message: `Correctly not in top ${assertion.maxPosition || 3}`,
		};
	}

	if (type === "hasType") {
		// Check if result type exists in top N
		const matchIdx = results
			.slice(0, assertion.maxPosition || 10)
			.findIndex((r) => r.type === assertion.resultType);

		if (matchIdx === -1) {
			return {
				pass: false,
				message: `No ${assertion.resultType} in top ${assertion.maxPosition || 10}`,
			};
		}

		return {
			pass: true,
			message: `Found ${assertion.resultType} at #${matchIdx + 1}`,
		};
	}

	if (type === "hasBefore") {
		// Check if slugA appears before slugB in results
		const idxA = results.findIndex(
			(r) => r.slug === assertion.slugA || r.id === assertion.slugA,
		);
		const idxB = results.findIndex(
			(r) => r.slug === assertion.slugB || r.id === assertion.slugB,
		);

		if (idxA === -1) {
			return {
				pass: false,
				message: `${assertion.slugA} not found in results`,
			};
		}
		if (idxB === -1) {
			// If B not found, A being present is a pass (B might be filtered out)
			return {
				pass: true,
				message: `${assertion.slugA} at #${idxA + 1} (${assertion.slugB} not in results)`,
			};
		}

		if (idxA < idxB) {
			return {
				pass: true,
				message: `${assertion.slugA} (#${idxA + 1}) before ${assertion.slugB} (#${idxB + 1})`,
			};
		}

		return {
			pass: false,
			message: `${assertion.slugA} (#${idxA + 1}) should be before ${assertion.slugB} (#${idxB + 1})`,
		};
	}

	return { pass: false, message: `Unknown assertion type: ${type}` };
}

// ==================== SNAPSHOT COMPARISON ====================
function compareSnapshots(current, previous) {
	const changes = {
		rankChanges: [],
		newResults: [],
		missingResults: [],
		scoreChanges: [],
	};

	if (!previous) return { isNew: true, changes };

	const prevMap = new Map(previous.results.map((r) => [r.slug || r.id, r]));
	const currMap = new Map(current.results.map((r) => [r.slug || r.id, r]));

	// Check for rank and score changes
	for (const curr of current.results.slice(0, 20)) {
		const key = curr.slug || curr.id;
		const prev = prevMap.get(key);

		if (!prev) {
			changes.newResults.push({
				slug: key,
				rank: curr.rank,
				title: curr.title,
				type: curr.type,
				score: curr.score,
				matchType: curr.matchType,
				nonStopwordMatches: curr.nonStopwordMatches,
				priority: curr.priority,
				description: curr.description,
				contentSnippet: curr.contentSnippet,
			});
		} else {
			if (prev.rank !== curr.rank) {
				changes.rankChanges.push({
					slug: key,
					title: curr.title,
					prevRank: prev.rank,
					currRank: curr.rank,
					delta: prev.rank - curr.rank, // positive = improved
					prevType: prev.type,
					currType: curr.type,
					prevScore: prev.score,
					currScore: curr.score,
					prevMatchType: prev.matchType,
					currMatchType: curr.matchType,
				});
			}
			if (Math.abs(prev.score - curr.score) > 0.5) {
				changes.scoreChanges.push({
					slug: key,
					prevScore: prev.score,
					currScore: curr.score,
					title: curr.title,
					prevMatchType: prev.matchType,
					currMatchType: curr.matchType,
				});
			}
		}
	}

	// Check for missing results
	for (const prev of previous.results.slice(0, 20)) {
		const key = prev.slug || prev.id;
		if (!currMap.has(key)) {
			changes.missingResults.push({
				slug: key,
				prevRank: prev.rank,
				title: prev.title,
				type: prev.type,
				score: prev.score,
				matchType: prev.matchType,
				nonStopwordMatches: prev.nonStopwordMatches,
				priority: prev.priority,
				description: prev.description,
				contentSnippet: prev.contentSnippet,
			});
		}
	}

	const hasChanges =
		changes.rankChanges.length > 0 ||
		changes.newResults.length > 0 ||
		changes.missingResults.length > 0;

	return { isNew: false, hasChanges, changes };
}

/**
 * Render a detailed diff view comparing old and new snapshots
 * Shows side-by-side comparison of rankings with visual indicators
 */
function renderDiff(current, previous, changes) {
	if (!previous) {
		console.log(
			`\n${c.yellow}  📋 New snapshot - no previous data to compare${c.reset}`,
		);
		return;
	}

	if (!changes.hasChanges) {
		console.log(`\n${c.green}  ✓ No changes detected${c.reset}`);
		return;
	}

	// Only show summary in diff mode (skip the full side-by-side comparison)
	console.log(`\n  ${c.bold}Changes:${c.reset}`);
	if (changes.changes?.newResults?.length > 0) {
		console.log(
			`  ${c.green}+ ${changes.changes.newResults.length} new result(s) in top 20${c.reset}`,
		);
		for (const n of changes.changes.newResults.slice(0, 3)) {
			console.log(
				`    ${c.green}+${c.reset} ${n.slug || n.id} - ${n.title?.substring(0, 40)} at #${n.rank}`,
			);
		}
	}
	if (changes.changes?.missingResults?.length > 0) {
		console.log(
			`  ${c.red}- ${changes.changes.missingResults.length} result(s) dropped from top 20${c.reset}`,
		);
		for (const m of changes.changes.missingResults.slice(0, 3)) {
			console.log(
				`    ${c.red}-${c.reset} ${m.slug || m.id} - ${m.title?.substring(0, 40)} (was #${m.prevRank})`,
			);
		}
	}
	if (changes.changes?.rankChanges?.length > 0) {
		const improved = changes.changes.rankChanges.filter(
			(ch) => ch.delta > 0,
		);
		const declined = changes.changes.rankChanges.filter(
			(ch) => ch.delta < 0,
		);
		if (improved.length > 0) {
			console.log(
				`  ${c.green}↑ ${improved.length} result(s) moved up${c.reset}`,
			);
			for (const ch of improved.slice(0, 3)) {
				console.log(
					`    ${c.green}↑${c.reset} ${ch.slug || ch.id} #${ch.prevRank} → #${ch.currRank}`,
				);
			}
		}
		if (declined.length > 0) {
			console.log(
				`  ${c.red}↓ ${declined.length} result(s) moved down${c.reset}`,
			);
			for (const ch of declined.slice(0, 3)) {
				console.log(
					`    ${c.red}↓${c.reset} ${ch.slug || ch.id} #${ch.prevRank} → #${ch.currRank}`,
				);
			}
		}
	}
}

// ==================== SEARCH API ====================
const API_BASE_URL = process.env.SEARCH_API_URL || "http://localhost:4321";

/**
 * Perform search using the API endpoint
 * Requires the dev server to be running: npm run dev
 */
async function performTestSearch(query) {
	const url = `${API_BASE_URL}/api/search?q=${encodeURIComponent(query)}&limit=50`;

	try {
		const response = await fetch(url);

		if (!response.ok) {
			throw new Error(
				`API returned ${response.status}: ${response.statusText}`,
			);
		}

		const data = await response.json();

		if (!data.success) {
			throw new Error(data.error || "API returned unsuccessful response");
		}

		return data.results;
	} catch (error) {
		if (error.cause?.code === "ECONNREFUSED") {
			console.log(
				`${c.red}❌ Cannot connect to API at ${API_BASE_URL}${c.reset}`,
			);
			console.log(
				`${c.yellow}   Make sure the dev server is running: npm run dev${c.reset}\n`,
			);
			throw new Error("Dev server not running");
		}
		throw error;
	}
}

// ==================== MAIN TEST RUNNER ====================
async function runTests() {
	console.log(
		`\n${c.bold}${c.cyan}═══════════════════════════════════════════════════════════════════════${c.reset}`,
	);
	console.log(
		`${c.bold}${c.cyan}                     SEARCH TEST SUITE                                  ${c.reset}`,
	);
	console.log(
		`${c.bold}${c.cyan}═══════════════════════════════════════════════════════════════════════${c.reset}\n`,
	);

	// Load test queries
	const testData = JSON.parse(fs.readFileSync(TEST_QUERIES_PATH, "utf-8"));
	let queries = testData.queries;
	let isAdhoc = false;

	// --query "term" = Ad-hoc search (runs the term directly)
	if (flags.query) {
		isAdhoc = true;
		queries = [
			{
				id: `adhoc-${flags.query.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
				query: flags.query,
				category: "adhoc",
				description: "Ad-hoc query",
				assertions: [],
			},
		];
		console.log(`${c.cyan}Ad-hoc search: "${flags.query}"${c.reset}`);
		if (flags.add) {
			console.log(
				`${c.dim}Will prompt to add to test suite after run${c.reset}`,
			);
		}
	}
	// --id "pattern" = Filter existing tests by id
	else if (flags.id) {
		queries = queries.filter((q) =>
			q.id.toLowerCase().includes(flags.id.toLowerCase()),
		);
		if (queries.length === 0) {
			console.log(
				`${c.red}No tests match id pattern: "${flags.id}"${c.reset}`,
			);
			console.log(`${c.dim}Available test ids:${c.reset}`);
			testData.queries.forEach((q) =>
				console.log(`  ${c.dim}${q.id}${c.reset}`),
			);
			process.exit(1);
		}
		console.log(
			`${c.cyan}Filtered to ${queries.length} test(s) matching "${flags.id}"${c.reset}`,
		);
	}

	console.log(`Running ${queries.length} test queries...\n`);

	const summary = {
		total: queries.length,
		passed: 0,
		failed: 0,
		changed: 0,
		newSnapshots: 0,
	};

	const report = {
		timestamp: new Date().toISOString(),
		queries: [],
	};

	for (const testQuery of queries) {
		console.log(
			`\n${c.bold}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${c.reset}`,
		);
		console.log(
			`${c.bold}Query: "${testQuery.query}"${c.reset} ${c.dim}(${testQuery.id})${c.reset}`,
		);
		console.log(`${c.dim}${testQuery.description}${c.reset}`);
		console.log(
			`${c.bold}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${c.reset}\n`,
		);

		// Perform search
		const results = await performTestSearch(testQuery.query);

		// Add rank to results
		const rankedResults = results.map((r, i) => ({ ...r, rank: i + 1 }));

		// Render top results as cards (skip in diff mode - only show summary)
		if (!flags.diff) {
			console.log(`${c.cyan}Top Results:${c.reset}\n`);
			rankedResults.slice(0, 5).forEach((r, i) => {
				console.log(renderCard(r, i + 1));
			});
		}

		// Check assertions
		if (testQuery.assertions?.length > 0) {
			console.log(`\n${c.cyan}Assertions:${c.reset}`);
			const { passes, failures } = checkAssertions(
				rankedResults,
				testQuery.assertions,
			);

			for (const p of passes) {
				console.log(
					`  ${c.green}✓${c.reset} ${p.message} ${c.dim}(${p.assertion.reason || ""})${c.reset}`,
				);
			}
			for (const f of failures) {
				console.log(
					`  ${c.red}✗${c.reset} ${f.message} ${c.dim}(${f.assertion.reason || ""})${c.reset}`,
				);
			}

			if (failures.length > 0) {
				summary.failed++;
			} else {
				summary.passed++;
			}
		}

		// Compare with snapshot
		const previousSnapshot = loadSnapshot(testQuery.id);
		const currentSnapshot = {
			query: testQuery.query,
			timestamp: new Date().toISOString(),
			version: "1.0.0",
			results: rankedResults.slice(0, 20),
			assertions: testQuery.assertions,
		};

		const comparison = compareSnapshots(currentSnapshot, previousSnapshot);

		if (comparison.isNew) {
			console.log(`\n${c.yellow}🆕 NEW - No previous snapshot${c.reset}`);
			summary.newSnapshots++;

			if (flags.diff) {
				renderDiff(currentSnapshot, previousSnapshot, comparison);
			}

			if (flags.update) {
				saveSnapshot(testQuery.id, currentSnapshot);
				console.log(`${c.green}   Snapshot saved${c.reset}`);
			}
		} else if (comparison.hasChanges) {
			console.log(`\n${c.yellow}⚠️  CHANGES DETECTED${c.reset}`);
			summary.changed++;

			if (flags.diff) {
				// Show detailed diff view
				renderDiff(currentSnapshot, previousSnapshot, comparison);
			} else {
				// Show compact rank changes
				if (comparison.changes.rankChanges.length > 0) {
					console.log(`${c.dim}  Rank changes:${c.reset}`);
					for (const ch of comparison.changes.rankChanges.slice(
						0,
						5,
					)) {
						const icon =
							ch.delta > 0
								? `${c.green}↑${c.reset}`
								: `${c.red}↓${c.reset}`;
						console.log(
							`    ${icon} ${ch.title?.substring(0, 30)}: #${ch.prevRank} → #${ch.currRank}`,
						);
					}
				}
			}

			if (flags.update) {
				saveSnapshot(testQuery.id, currentSnapshot);
				console.log(`${c.green}   Snapshot updated${c.reset}`);
			}
		} else {
			console.log(
				`\n${c.green}✓ MATCH - Results match snapshot${c.reset}`,
			);
		}

		// Add to report
		report.queries.push({
			id: testQuery.id,
			query: testQuery.query,
			results: rankedResults.slice(0, 20),
			comparison,
			assertionResults:
				testQuery.assertions?.length > 0
					? checkAssertions(rankedResults, testQuery.assertions)
					: null,
		});
	}

	// AI Evaluation (if enabled)
	if (flags.aiEval) {
		console.log(
			`\n${c.bold}${c.magenta}═══════════════════════════════════════════════════════════════════════${c.reset}`,
		);
		console.log(
			`${c.bold}${c.magenta}                     AI EVALUATION (DeepSeek)                          ${c.reset}`,
		);
		console.log(
			`${c.bold}${c.magenta}═══════════════════════════════════════════════════════════════════════${c.reset}\n`,
		);

		try {
			const {
				evaluateSearchResults,
				evaluateSearchDiff,
				getRankingRulesText,
			} = await import("./services/deepseek.js");
			const rules = getRankingRulesText();

			// Evaluate changed queries OR new queries (ad-hoc, no snapshot)
			const queriesToEval = report.queries.filter(
				(q) => q.comparison?.hasChanges || q.comparison?.isNew,
			);
			const unchangedCount = report.queries.length - queriesToEval.length;

			if (queriesToEval.length === 0) {
				console.log(
					`${c.green}  ✓ No changes detected - skipping AI evaluation${c.reset}`,
				);
				console.log(
					`${c.dim}    All ${unchangedCount} queries match their snapshots${c.reset}`,
				);
			} else {
				const newCount = queriesToEval.filter(
					(q) => q.comparison?.isNew,
				).length;
				const changedCount = queriesToEval.length - newCount;
				console.log(
					`${c.cyan}  Evaluating ${queriesToEval.length} queries${c.reset}`,
				);
				if (newCount > 0)
					console.log(
						`${c.dim}    ${newCount} new (no snapshot)${c.reset}`,
					);
				if (changedCount > 0)
					console.log(
						`${c.dim}    ${changedCount} changed${c.reset}`,
					);
				if (unchangedCount > 0)
					console.log(
						`${c.dim}    ${unchangedCount} unchanged (skipped)${c.reset}`,
					);

				for (const queryReport of queriesToEval.slice(0, 10)) {
					// Limit to 10 for cost
					console.log(
						`\n${c.cyan}Evaluating: "${queryReport.query}"${c.reset}`,
					);

					// Load previous snapshot for richer diff context (if it exists)
					const previousForAi = loadSnapshot(queryReport.id);

					// Build diff context for AI (empty for new queries)
					const diffContext = {
						newResults:
							queryReport.comparison?.changes?.newResults || [],
						missingResults:
							queryReport.comparison?.changes?.missingResults ||
							[],
						rankChanges:
							queryReport.comparison?.changes?.rankChanges || [],
						scoreChanges:
							queryReport.comparison?.changes?.scoreChanges || [],
						previousTop: previousForAi?.results
							? previousForAi.results.slice(0, 10)
							: [],
					};

					// Use diff-aware evaluation for changed queries, standard for new
					let evaluation;
					if (
						!queryReport.comparison?.isNew &&
						typeof evaluateSearchDiff === "function"
					) {
						evaluation = await evaluateSearchDiff(
							queryReport.query,
							queryReport.results,
							diffContext,
							rules,
						);
					} else {
						evaluation = await evaluateSearchResults(
							queryReport.query,
							queryReport.results,
							rules,
						);
					}

					queryReport.aiEvaluation = evaluation;

					const scoreColor =
						evaluation.qualityScore >= 7
							? c.green
							: evaluation.qualityScore >= 5
								? c.yellow
								: c.red;

					console.log(
						`  Quality Score: ${scoreColor}${evaluation.qualityScore}/10${c.reset}`,
					);
					console.log(`  Verdict: ${evaluation.verdict}`);
					console.log(`  ${c.dim}${evaluation.assessment}${c.reset}`);

					// Show diff-specific feedback
					if (evaluation.diffAssessment) {
						console.log(
							`  ${c.cyan}Change Assessment:${c.reset} ${evaluation.diffAssessment}`,
						);
					}

					if (evaluation.issues?.length > 0) {
						console.log(`  ${c.yellow}Issues:${c.reset}`);
						for (const issue of evaluation.issues) {
							console.log(
								`    - #${issue.rank} ${issue.slug}: ${issue.issue}`,
							);
						}
					}
				}
			}
		} catch (error) {
			console.log(
				`${c.red}AI Evaluation failed: ${error.message}${c.reset}`,
			);
		}
	}

	// Summary
	console.log(
		`\n${c.bold}${c.cyan}═══════════════════════════════════════════════════════════════════════${c.reset}`,
	);
	console.log(
		`${c.bold}${c.cyan}                          SUMMARY                                      ${c.reset}`,
	);
	console.log(
		`${c.bold}${c.cyan}═══════════════════════════════════════════════════════════════════════${c.reset}\n`,
	);

	console.log(`  Total:        ${summary.total}`);
	console.log(`  ${c.green}Passed:       ${summary.passed}${c.reset}`);
	console.log(`  ${c.red}Failed:       ${summary.failed}${c.reset}`);
	console.log(`  ${c.yellow}Changed:      ${summary.changed}${c.reset}`);
	console.log(`  ${c.blue}New:          ${summary.newSnapshots}${c.reset}`);

	// Add ad-hoc query to test suite if --add flag is set
	if (isAdhoc && flags.add && report.queries.length > 0) {
		const adhocQuery = report.queries[0];
		const newTestId = adhocQuery.id.replace("adhoc-", "");

		console.log(
			`\n${c.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${c.reset}`,
		);
		console.log(`${c.bold}Adding query to test suite${c.reset}\n`);

		// Create a proper test entry
		const newTest = {
			id: `custom-${newTestId}`,
			query: flags.query,
			category: "custom",
			description: `Custom test: ${flags.query}`,
			assertions: [],
		};

		// Add basic assertions based on top results
		if (adhocQuery.results.length > 0) {
			const top = adhocQuery.results[0];
			newTest.assertions.push({
				type: "has",
				slug: top.slug || top.id,
				maxPosition: 3,
				reason: `${top.title} should be in top 3`,
			});
		}

		// Read and update test-queries.json
		const testData = JSON.parse(
			fs.readFileSync(TEST_QUERIES_PATH, "utf-8"),
		);

		// Check if test already exists
		const exists = testData.queries.some(
			(q) => q.query.toLowerCase() === flags.query.toLowerCase(),
		);
		if (exists) {
			console.log(
				`${c.yellow}  ⚠ Query "${flags.query}" already exists in test suite${c.reset}`,
			);
		} else {
			testData.queries.push(newTest);
			fs.writeFileSync(
				TEST_QUERIES_PATH,
				JSON.stringify(testData, null, "\t"),
			);
			console.log(`${c.green}  ✓ Added test: ${newTest.id}${c.reset}`);
			console.log(`${c.dim}    Query: "${newTest.query}"${c.reset}`);
			console.log(
				`${c.dim}    Assertion: ${newTest.assertions[0]?.slug} in top 3${c.reset}`,
			);

			// Also save the snapshot
			saveSnapshot(newTest.id, {
				query: newTest.query,
				timestamp: new Date().toISOString(),
				version: "1.0.0",
				results: adhocQuery.results.slice(0, 20),
				assertions: newTest.assertions,
			});
			console.log(`${c.green}  ✓ Snapshot saved${c.reset}`);
		}
	}

	// Save report
	const reportPath = path.join(
		REPORTS_DIR,
		`report-${new Date().toISOString().split("T")[0]}.json`,
	);
	fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
	console.log(`\n${c.dim}Report saved to: ${reportPath}${c.reset}`);

	// Exit code
	process.exit(summary.failed > 0 ? 1 : 0);
}

// Run
runTests().catch((error) => {
	console.error(`${c.red}Error: ${error.message}${c.reset}`);
	process.exit(1);
});
