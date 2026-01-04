/**
 * DeepSeek API service for AI-powered search evaluation
 */

import "dotenv/config";

const DEEPSEEK_API_URL = "https://api.deepseek.com/v1/chat/completions";

/**
 * Call DeepSeek API with a prompt
 */
export async function callDeepSeek(prompt, options = {}) {
	const apiKey = process.env.DEEPSEEK_API_KEY;
	if (!apiKey) {
		throw new Error("DEEPSEEK_API_KEY not set in environment");
	}

	const {
		model = "deepseek-chat",
		temperature = 0.3,
		maxTokens = 2000,
	} = options;

	const response = await fetch(DEEPSEEK_API_URL, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Authorization: `Bearer ${apiKey}`,
		},
		body: JSON.stringify({
			model,
			messages: [{ role: "user", content: prompt }],
			temperature,
			max_tokens: maxTokens,
		}),
	});

	if (!response.ok) {
		const error = await response.text();
		throw new Error(`DeepSeek API error: ${response.status} - ${error}`);
	}

	const data = await response.json();
	return data.choices[0].message.content;
}

/**
 * Evaluate search results quality using DeepSeek
 */
export async function evaluateSearchResults(query, results, rules) {
	const prompt = buildEvaluationPrompt(query, results, rules);

	const response = await callDeepSeek(prompt, {
		temperature: 0.2,
		maxTokens: 1500,
	});

	return parseEvaluationResponse(response);
}

/**
 * Build the evaluation prompt for DeepSeek
 */
function buildEvaluationPrompt(query, results, rules) {
	const resultsText = results
		.slice(0, 15)
		.map((r, i) => {
			return `#${i + 1} | ${r.type}
    Title: ${r.title}
    Slug: ${r.slug}
    ${r.description ? `Desc: ${r.description.substring(0, 150)}...` : ""}
    ${r.pali ? `Pali: ${r.pali.join(", ")}` : ""}
    ${r.synonyms ? `Synonyms: ${r.synonyms.join(", ")}` : ""}
    ${r.contentSnippet ? `Content: ${r.contentSnippet.substring(0, 140)}...` : ""}`;
		})
		.join("\n\n");

	return `You are evaluating search ranking quality for a Buddhist scripture search engine.

## Query: "${query}"

## Search Ranking Rules
${rules}

## Important
- Do NOT mention or reason about internal numeric scores.
- Do NOT assume that a rank drop is a bug just because it "should score higher".
- Evaluate ONLY based on user-visible fields: title, description, content snippet, Pali, synonyms, and the query.

## Results (Top 15)
${resultsText}

## Evaluation Task

Analyze these search results and provide:

1. **Quality Score (1-10)**: How well do results match the query intent?
2. **Ranking Assessment**: Are items in the right order?
3. **Issues Found**: Any bugs or unexpected rankings?
4. **Suggestions**: How could ranking be improved?

Respond in this JSON format:
{
  "qualityScore": <1-10>,
  "assessment": "<brief assessment>",
  "issues": [
    { "rank": <position>, "slug": "<slug>", "issue": "<description>" }
  ],
  "suggestions": ["<suggestion1>", "<suggestion2>"],
  "verdict": "PASS" | "REVIEW" | "FAIL"
}

Focus on:
- Is the top result what a user would expect?
- Are multi-term queries finding items with ALL terms?
- Are Pali terms matching correctly?
- Is diversity working (mixing topics/discourses)?
- Are there clearly wrong results in top positions?`;
}

/**
 * Parse the AI evaluation response
 */
function parseEvaluationResponse(response) {
	try {
		// Extract JSON from response (may have markdown code blocks)
		const jsonMatch = response.match(/\{[\s\S]*\}/);
		if (jsonMatch) {
			return JSON.parse(jsonMatch[0]);
		}

		// If no JSON found, return a structured error
		return {
			qualityScore: 0,
			assessment: "Failed to parse AI response",
			issues: [],
			suggestions: [],
			verdict: "REVIEW",
			rawResponse: response,
		};
	} catch (error) {
		return {
			qualityScore: 0,
			assessment: `Parse error: ${error.message}`,
			issues: [],
			suggestions: [],
			verdict: "REVIEW",
			rawResponse: response,
		};
	}
}

/**
 * Evaluate search result CHANGES using DeepSeek
 * More efficient - only evaluates what changed, not full results
 */
export async function evaluateSearchDiff(query, results, diffContext, rules) {
	const prompt = buildDiffEvaluationPrompt(
		query,
		results,
		diffContext,
		rules,
	);

	const response = await callDeepSeek(prompt, {
		temperature: 0.2,
		maxTokens: 1500,
	});

	return parseEvaluationResponse(response);
}

/**
 * Build diff-focused evaluation prompt
 */
function buildDiffEvaluationPrompt(query, results, diffContext, rules) {
	const {
		newResults = [],
		missingResults = [],
		rankChanges = [],
		scoreChanges = [],
		previousTop = [],
	} = diffContext || {};

	const previousTopText = (previousTop || [])
		.slice(0, 10)
		.map((r, i) => {
			let details = `#${i + 1} | ${r.type}
    Title: ${r.title}
    Slug: ${r.slug}`;
			if (r.description)
				details += `\n    Desc: ${r.description.substring(0, 150)}...`;
			if (r.pali) details += `\n    Pali: ${r.pali.join(", ")}`;
			if (r.synonyms)
				details += `\n    Synonyms: ${r.synonyms.join(", ")}`;
			if (r.contentSnippet)
				details += `\n    Content: ${r.contentSnippet.substring(0, 100)}...`;
			return details;
		})
		.join("\n\n");

	// Current top 10 results with full details
	const currentTop = results
		.slice(0, 10)
		.map((r, i) => {
			let details = `#${i + 1} | ${r.type}
    Title: ${r.title}
    Slug: ${r.slug}`;
			if (r.description)
				details += `\n    Desc: ${r.description.substring(0, 150)}...`;
			if (r.pali) details += `\n    Pali: ${r.pali.join(", ")}`;
			if (r.synonyms)
				details += `\n    Synonyms: ${r.synonyms.join(", ")}`;
			if (r.contentSnippet)
				details += `\n    Content: ${r.contentSnippet.substring(0, 100)}...`;
			return details;
		})
		.join("\n\n");

	// Format changes with full details
	const newResultsText =
		newResults.length > 0
			? newResults
					.map((r) => {
						let text = `  + #${r.rank} ${r.title} (${r.type})`;
						if (r.description)
							text += `\n      Desc: ${r.description.substring(0, 100)}...`;
						if (r.contentSnippet)
							text += `\n      Content: ${r.contentSnippet.substring(0, 200)}...`;
						return text;
					})
					.join("\n")
			: "  (none)";

	const missingResultsText =
		missingResults.length > 0
			? missingResults
					.map((r) => {
						let text = `  - Was #${r.prevRank}: ${r.title} (${r.type})`;
						if (r.description)
							text += `\n      Desc: ${r.description?.substring(0, 100)}...`;
						if (r.contentSnippet)
							text += `\n      Content: ${r.contentSnippet.substring(0, 200)}...`;
						return text;
					})
					.join("\n")
			: "  (none)";

	const rankChangesText =
		rankChanges.length > 0
			? rankChanges
					.map((r) => {
						const arrow = r.delta > 0 ? "↑" : "↓";
						return `  ${arrow} ${r.title}: #${r.prevRank} → #${r.currRank} (${r.delta > 0 ? "+" : ""}${r.delta})`;
					})
					.join("\n")
			: "  (none)";

	// We intentionally do NOT show numeric score deltas to the model.
	// Those are internal engine details and can mislead the evaluation.

	return `You are reviewing CHANGES to search ranking for a Buddhist scripture search engine.

## Query: "${query}"

## Ranking Rules Summary
${rules}

## Important
- Do NOT mention or reason about internal numeric scores.
- Evaluate ONLY based on title, description, content snippet, Pali, synonyms, and the query.
- Some rank changes can be intentional due to diversity or similar-snippet repelling.

## Previous Top 10 Results (Snapshot)
${previousTopText || "(not available)"}

## Current Top 10 Results
${currentTop}

## What Changed (vs previous snapshot)

**New in top results:**
${newResultsText}

**Dropped from top results:**
${missingResultsText}

**Position changes:**
${rankChangesText}

## Evaluation Task

Analyze whether these ranking CHANGES are improvements or regressions:

1. **Are the changes good?** Did better results move up? Did worse results drop?
2. **Any regressions?** Did important results get pushed down incorrectly?
3. **Quality Score (1-10)**: How good is the current ranking overall?

Respond in this JSON format:
{
  "qualityScore": <1-10>,
  "assessment": "<brief assessment of current ranking>",
  "diffAssessment": "<are the changes good or bad? why?>",
  "issues": [
    { "rank": <position>, "slug": "<slug>", "issue": "<description>" }
  ],
  "verdict": "IMPROVED" | "REGRESSED" | "NEUTRAL" | "REVIEW"
}

Focus on:
- Did topic/quality cards correctly rank above or below discourses?
- Are exact matches still at top?
- Does the new ranking feel more intuitive?`;
}

/**
 * Get the ranking rules as a string for the prompt
 */
export function getRankingRulesText() {
	return `
### Matching & Ranking (Qualitative)

**Categories (Topics, Qualities, Similes):**
- Exact title/slug/Pali/synonym matches should be strongest
- Word-exact title/synonym matches should rank above prefixes
- Prefix matches should generally rank above infix/fuzzy
- Multi-term queries should prefer results containing ALL non-stopword terms
- For multi-term queries, phrase proximity (terms close together) is preferred over scattered matches

**Discourses:**
- Title matches should be strong signals
- Content snippet matches help when title is not a direct match

### Key Rules
1. For multi-term queries, ALL non-stopword terms should be found
2. Stopwords (the, a, is, in, of...) are filtered out
3. Phrase proximity boosts items where terms appear near each other (esp. title/description)
4. Scattered multi-term matches can be penalized vs phrase matches
5. After 3 same-type results, different types get diversity boost
6. Similar discourse snippets may be repelled to avoid showing many near-duplicates in a row
7. Priority and nonStopwordMatches break ties`;
}
