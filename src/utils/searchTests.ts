/**
 * Search Relevance Test Suite
 *
 * WORKFLOW:
 * 1. Open explore page in browser (localhost)
 * 2. Open browser console
 * 3. Run: window.runSearchTests()
 * 4. Review console output for each test
 * 5. Run: window.reportSearchResults() to see summary
 *
 * Tests are defined with:
 * - query: The search string
 * - checks: Array of assertions to verify
 *   - "has:Craving@1" = "Craving" should be at rank 1
 *   - "has:MN 38@top5" = "MN 38" should be in top 5
 *   - "has:exhaust@title" = "exhaust" should appear in a top result's title
 *   - "not:Quenching@top3" = "Quenching" should NOT be in top 3
 *   - "type:topic@1" = rank 1 should be a topic
 *   - "score:>80@1" = rank 1 should have score > 80
 *   - "matches:2@1" = rank 1 should have 2 non-stopword matches
 */

export interface SearchTest {
	id: string;
	query: string;
	description: string;
	checks: string[];
	priority: "critical" | "important" | "nice";
}

export const SEARCH_TESTS: SearchTest[] = [
	// === SINGLE WORD TESTS ===
	{
		id: "single-1",
		query: "craving",
		description:
			"Single word exact match - topic should rank #1, related topics should appear",
		checks: [
			"has:Craving@1",
			"type:topic-quality@1",
			"score:>90@1",
			"has:Self Making@top10",
			"has:Self Erasure@top10",
		],
		priority: "critical",
	},
	{
		id: "single-2",
		query: "buddha",
		description: "Common term - should prioritize title matches",
		checks: ["has:Buddha@top3"],
		priority: "important",
	},
	{
		id: "single-3",
		query: "suffering",
		description: "Core concept - exact topic match",
		checks: ["has:Suffering@1", "type:topic-quality@1"],
		priority: "critical",
	},

	// === MULTI-WORD TESTS ===
	{
		id: "multi-1",
		query: "craving can arise",
		description:
			'Multi-word with stopword - should match topic with "craving" in title over others',
		checks: [
			"has:Craving@top5",
			"not:Quenching@1", // Opposite of craving shouldn't be #1
		],
		priority: "critical",
	},
	{
		id: "multi-2",
		query: "exhaust craving in",
		description:
			"Multi-word - discourses with both terms should rank higher",
		checks: [
			"has:MN 38@top5", // Has both "exhaustion" and "craving" in title
			"has:Taṇhā sutta@top5", // Has "Craving" in title
			"matches:2@top3", // Top 3 should have 2 non-stopword matches
		],
		priority: "critical",
	},
	{
		id: "multi-3",
		query: "in the buddha",
		description:
			'Query with stopwords - "buddha" should still be highlighted and matched',
		checks: ["has:Buddha@top10"],
		priority: "important",
	},

	// === EDGE CASES ===
	{
		id: "edge-1",
		query: "jhana",
		description: "Pali term - should match pali field",
		checks: [
			"has:Jhāna@top3", // or 'Absorption' if that's the English
		],
		priority: "important",
	},
	{
		id: "edge-2",
		query: "metta",
		description: "Pali without diacritics - should still match",
		checks: ["has:Loving-kindness@top3"],
		priority: "important",
	},
	{
		id: "edge-3",
		query: "dn 22",
		description: "Discourse ID search",
		checks: ["has:DN 22@1"],
		priority: "critical",
	},

	// === DESCRIPTION MATCHING ===
	{
		id: "desc-1",
		query: "craving",
		description: "Topics with craving in description should appear",
		checks: [
			"has:Self Making@top15", // Has "craving" in description
			"has:Self Erasure@top15", // Has "craving" in description
		],
		priority: "important",
	},
];

// ==================== TEST RUNNER ====================

export interface TestCheckResult {
	check: string;
	passed: boolean;
	actual: string;
	reason?: string;
}

export interface TestRunResult {
	test: SearchTest;
	passed: boolean;
	checkResults: TestCheckResult[];
	actualTop10: Array<{
		rank: number;
		type: string;
		title: string;
		score: number;
		matchType: string;
		nonStopwordMatches: number;
	}>;
}

/**
 * Parse a check string into its components
 * Format: "command:value@position"
 */
function parseCheck(check: string): {
	command: "has" | "not" | "type" | "score" | "matches";
	value: string;
	position: number | "title" | "top3" | "top5" | "top10" | "top15" | "top20";
} | null {
	const match = check.match(/^(has|not|type|score|matches):(.+?)@(.+)$/);
	if (!match) return null;

	const [, command, value, posStr] = match;
	let position:
		| number
		| "title"
		| "top3"
		| "top5"
		| "top10"
		| "top15"
		| "top20";

	if (
		posStr === "top3" ||
		posStr === "top5" ||
		posStr === "top10" ||
		posStr === "top15" ||
		posStr === "top20"
	) {
		position = posStr;
	} else if (posStr === "title") {
		position = "title";
	} else {
		position = parseInt(posStr, 10);
	}

	return {
		command: command as "has" | "not" | "type" | "score" | "matches",
		value,
		position,
	};
}

/**
 * Get max rank for a position specifier
 */
function getMaxRank(position: number | string): number {
	if (typeof position === "number") return position;
	if (position === "top3") return 3;
	if (position === "top5") return 5;
	if (position === "top10") return 10;
	if (position === "top15") return 15;
	if (position === "top20") return 20;
	return 20;
}

/**
 * Evaluate a single check against results
 */
export function evaluateCheck(
	check: string,
	results: TestRunResult["actualTop10"],
): TestCheckResult {
	const parsed = parseCheck(check);
	if (!parsed) {
		return {
			check,
			passed: false,
			actual: "Invalid check format",
			reason: "Parse error",
		};
	}

	const { command, value, position } = parsed;
	const maxRank = getMaxRank(position);

	switch (command) {
		case "has": {
			// Check if value appears in title of any result within position
			const found = results
				.filter((r) => r.rank <= maxRank)
				.find((r) =>
					r.title.toLowerCase().includes(value.toLowerCase()),
				);

			if (found) {
				return {
					check,
					passed:
						typeof position === "number"
							? found.rank === position
							: true,
					actual: `Found "${found.title}" at rank ${found.rank}`,
					reason:
						typeof position === "number" && found.rank !== position
							? `Expected rank ${position}, got ${found.rank}`
							: undefined,
				};
			}
			return {
				check,
				passed: false,
				actual: `Not found in top ${maxRank}`,
				reason: `"${value}" not in results`,
			};
		}

		case "not": {
			// Check that value does NOT appear in top N
			const found = results
				.filter((r) => r.rank <= maxRank)
				.find((r) =>
					r.title.toLowerCase().includes(value.toLowerCase()),
				);

			if (found) {
				return {
					check,
					passed: false,
					actual: `Found "${found.title}" at rank ${found.rank}`,
					reason: `Should not be in top ${maxRank}`,
				};
			}
			return {
				check,
				passed: true,
				actual: `Not found in top ${maxRank} ✓`,
			};
		}

		case "type": {
			// Check type at specific position
			const result = results.find(
				(r) => r.rank === (typeof position === "number" ? position : 1),
			);
			if (!result) {
				return {
					check,
					passed: false,
					actual: "No result at position",
					reason: "Missing result",
				};
			}
			const passed = result.type === value || result.type.includes(value);
			return {
				check,
				passed,
				actual: `Type at ${position}: ${result.type}`,
				reason: passed ? undefined : `Expected ${value}`,
			};
		}

		case "score": {
			// Check score at position (format: >80 or <50 or =100)
			const result = results.find(
				(r) => r.rank === (typeof position === "number" ? position : 1),
			);
			if (!result) {
				return {
					check,
					passed: false,
					actual: "No result at position",
					reason: "Missing result",
				};
			}

			const scoreMatch = value.match(/^([<>=])(\d+)$/);
			if (!scoreMatch) {
				return {
					check,
					passed: false,
					actual: "Invalid score format",
					reason: "Use >N, <N, or =N",
				};
			}

			const [, op, numStr] = scoreMatch;
			const threshold = parseInt(numStr, 10);
			let passed = false;

			if (op === ">") passed = result.score > threshold;
			else if (op === "<") passed = result.score < threshold;
			else if (op === "=") passed = result.score === threshold;

			return {
				check,
				passed,
				actual: `Score at ${position}: ${result.score}`,
				reason: passed ? undefined : `Expected ${value}`,
			};
		}

		case "matches": {
			// Check non-stopword matches at position
			const maxPos = typeof position === "number" ? position : maxRank;
			const topResults = results.filter((r) => r.rank <= maxPos);
			const expectedMatches = parseInt(value, 10);

			const allHaveMatches = topResults.every(
				(r) => r.nonStopwordMatches >= expectedMatches,
			);
			const anyHasMatches = topResults.some(
				(r) => r.nonStopwordMatches >= expectedMatches,
			);

			return {
				check,
				passed: anyHasMatches,
				actual: `Top ${maxPos} matches: ${topResults.map((r) => r.nonStopwordMatches).join(", ")}`,
				reason: allHaveMatches
					? undefined
					: `Not all have ${expectedMatches}+ matches`,
			};
		}

		default:
			return {
				check,
				passed: false,
				actual: "Unknown command",
				reason: `Unknown: ${command}`,
			};
	}
}

/**
 * Format test results for console output
 */
export function formatTestOutput(result: TestRunResult): string {
	const status = result.passed ? "✅ PASS" : "❌ FAIL";
	const lines: string[] = [
		`\n${"=".repeat(60)}`,
		`${status} | ${result.test.id}: "${result.test.query}"`,
		`${result.test.description}`,
		`${"─".repeat(60)}`,
	];

	// Show check results
	for (const cr of result.checkResults) {
		const icon = cr.passed ? "✓" : "✗";
		lines.push(`  ${icon} ${cr.check}`);
		if (!cr.passed && cr.reason) {
			lines.push(`      → ${cr.reason}`);
		}
		lines.push(`      Actual: ${cr.actual}`);
	}

	// Show top 5 results
	lines.push(`\n  Top 5 Results:`);
	for (const r of result.actualTop10.slice(0, 5)) {
		lines.push(
			`    ${r.rank}. [${r.type}] ${r.title.substring(0, 40)}... (${r.score}, ${r.matchType}, ns:${r.nonStopwordMatches})`,
		);
	}

	return lines.join("\n");
}

/**
 * Summary report
 */
export function formatSummary(results: TestRunResult[]): string {
	const passed = results.filter((r) => r.passed).length;
	const total = results.length;
	const critical = results.filter((r) => r.test.priority === "critical");
	const criticalPassed = critical.filter((r) => r.passed).length;

	const lines: string[] = [
		`\n${"═".repeat(60)}`,
		`SEARCH TEST SUMMARY`,
		`${"═".repeat(60)}`,
		`Total: ${passed}/${total} passed (${Math.round((passed / total) * 100)}%)`,
		`Critical: ${criticalPassed}/${critical.length} passed`,
		``,
		`Failed Tests:`,
	];

	for (const r of results.filter((r) => !r.passed)) {
		lines.push(`  ❌ ${r.test.id}: "${r.test.query}"`);
		for (const cr of r.checkResults.filter((c) => !c.passed)) {
			lines.push(`      - ${cr.check}: ${cr.reason}`);
		}
	}

	return lines.join("\n");
}
