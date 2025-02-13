export const prerender = false;
import type { APIRoute } from "astro";
import { db } from "../../../service/firebase/server";
import { JSDOM } from "jsdom";

interface DpdResponse {
	dpd_html?: string;
	summary_html?: string;
	[key: string]: any;
}

const TIMEOUT = 25000;

function cleanupDpdHtml(html: string): string {
	const dom = new JSDOM(html);
	const doc = dom.window.document;

	const selectorsToRemove = [
		".box-footer",
		".comments",
		".button-box",
		"script",
		"style",
		".metadata",
		".box-title",
		".deconstructor_footer",
		'[id^="grammar_dhamma_"]',
		'[id^="examples_dhamma_"]',
		'[id^="declension_dhamma_"]',
		'[id^="family_root_dhamma_"]',
		'[id^="family_compound_dhamma_"]',
		'[id^="family_idiom_dhamma_"]',
		'[id^="frequency_dhamma_"]',
		'[id^="feedback_dhamma_"]',
		".button_box",
	];

	selectorsToRemove.forEach((selector) => {
		doc.querySelectorAll(selector).forEach((el: Element) => el.remove());
	});

	return doc.body.innerHTML;
}

async function fetchFromCache(word: string): Promise<DpdResponse | null> {
	const cacheRef = db.collection("dpd").doc(word);
	try {
		const cacheDoc = await cacheRef.get();
		return cacheDoc.exists ? (cacheDoc.data() as DpdResponse) : null;
	} catch (error) {
		console.error(`Cache read error for ${word}:`, error);
		return null;
	}
}

async function fetchFromApi(word: string): Promise<DpdResponse | null> {
	const controller = new AbortController();
	const timeoutId = setTimeout(() => controller.abort(), TIMEOUT);

	try {
		const response = await fetch(
			`https://dpdict.net/search_json?q=${encodeURIComponent(word)}`,
			{ signal: controller.signal }
		);
		clearTimeout(timeoutId);

		if (!response.ok) {
			throw new Error(`HTTP error! status: ${response.status}`);
		}

		const data: DpdResponse = await response.json();

		// Clean up HTML content
		if (data.dpd_html) {
			data.dpd_html = cleanupDpdHtml(data.dpd_html);
		}
		if (data.summary_html) {
			data.summary_html = cleanupDpdHtml(data.summary_html);
		}

		// Cache the cleaned data
		try {
			await db.collection("dpd").doc(word).set(data);
		} catch (error) {
			console.error(`Cache write failed for ${word}:`, error);
		}

		return data;
	} catch (error: any) {
		clearTimeout(timeoutId);
		console.error(`API error for ${word}:`, error);

		if (error.name === "AbortError") {
			throw new Error("TIMEOUT");
		}
		throw error;
	}
}

async function lookupWord(
	word: string,
	summaryOnly = false
): Promise<DpdResponse | null> {
	try {
		// Try cache first
		const cached = await fetchFromCache(word);
		if (cached) {
			return summaryOnly ? { summary_html: cached.summary_html } : cached;
		}

		// If not in cache, fetch from API
		const data = await fetchFromApi(word);
		return summaryOnly ? { summary_html: data?.summary_html } : data;
	} catch (error: any) {
		if (error.message === "TIMEOUT") {
			throw new Error("TIMEOUT");
		}
		throw error;
	}
}

export const GET: APIRoute = async ({ url }) => {
	const word = url.searchParams.get("word");
	const query = url.searchParams.get("q");

	// Handle batch lookup
	if (query) {
		const words = query
			.split(",")
			.map((w) => w.trim())
			.filter((w) => w.length > 0)
			.slice(0, 5);

		if (words.length === 0) {
			return new Response("No valid words provided", { status: 400 });
		}

		try {
			const results = await Promise.all(
				words.map(async (w) => ({
					word: w,
					data: await lookupWord(w, true),
				}))
			);

			const response = Object.fromEntries(
				results
					.filter(
						(
							result
						): result is { word: string; data: DpdResponse } =>
							result.data !== null &&
							result.data.summary_html !== undefined
					)
					.map((result) => [result.word, result.data.summary_html])
			);

			return new Response(JSON.stringify(response), {
				status: 200,
				headers: {
					"Content-Type": "application/json",
					"Access-Control-Allow-Origin": "*",
				},
			});
		} catch (error) {
			return new Response(
				JSON.stringify({ error: "Batch lookup failed" }),
				{
					status: 500,
				}
			);
		}
	}

	// Handle single word lookup
	if (!word) {
		return new Response("Word parameter is required", { status: 400 });
	}

	try {
		const result = await lookupWord(word);
		if (!result) {
			return new Response(
				JSON.stringify({
					error: "Word not found",
					word: word,
				}),
				{ status: 404 }
			);
		}

		return new Response(JSON.stringify(result), {
			status: 200,
			headers: {
				"Content-Type": "application/json",
				"Access-Control-Allow-Origin": "*",
			},
		});
	} catch (error: any) {
		if (error.message === "TIMEOUT") {
			return new Response(
				JSON.stringify({
					error: "Dictionary API timeout",
					word: word,
				}),
				{ status: 504 }
			);
		}

		return new Response(
			JSON.stringify({
				error: "Dictionary API error",
				word: word,
			}),
			{ status: 502 }
		);
	}
};
