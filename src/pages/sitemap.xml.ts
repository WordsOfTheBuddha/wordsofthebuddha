export const prerender = false;
import type { APIRoute } from "astro";
import { routes } from "../utils/routes";
import topicMappings from "../data/topicMappings.json";
import qualityMappings from "../data/qualityMappings.json";
import simileMappings from "../data/simileMappings.json";

const SITE_URL = "https://wordsofthebuddha.org";

function generateUrlElement(
	url: string,
	lastmod?: string,
	priority?: string
): string {
	return `  <url>
    <loc>${SITE_URL}${url}</loc>
    ${lastmod ? `<lastmod>${lastmod}</lastmod>` : ""}
    ${priority ? `<priority>${priority}</priority>` : ""}
    <changefreq>weekly</changefreq>
  </url>`;
}

export const GET: APIRoute = async () => {
	const currentDate = new Date().toISOString().split("T")[0];

	let sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`;

	// Main pages (high priority)
	const mainPages = [
		{ url: "/", priority: "1.0" },
		{ url: "/search", priority: "0.8" },
		{ url: "/discover", priority: "0.8" },
		{ url: "/anthologies", priority: "0.8" },
		{ url: "/buddha-quotes", priority: "0.8" },
	];

	mainPages.forEach((page) => {
		sitemap +=
			"\n" + generateUrlElement(page.url, currentDate, page.priority);
	});

	// Individual sutta pages (medium-high priority)
	routes.forEach((route) => {
		sitemap += "\n" + generateUrlElement(`/${route}`, undefined, "0.7");
	});

	// Topic pages (/on/topic-slug only)
	Object.keys(topicMappings).forEach((topicSlug) => {
		sitemap +=
			"\n" + generateUrlElement(`/on/${topicSlug}`, undefined, "0.6");
	});

	// Quality pages (/on/quality-slug only)
	Object.keys(qualityMappings).forEach((qualitySlug) => {
		sitemap +=
			"\n" + generateUrlElement(`/on/${qualitySlug}`, undefined, "0.6");
	});

	// Simile pages (/on/simile-slug only)
	Object.entries(simileMappings as any).forEach(([letter, simileGroup]) => {
		Object.keys(simileGroup as any).forEach((simile) => {
			const simileSlug = simile.toLowerCase().replace(/\s+/g, "-");
			sitemap +=
				"\n" +
				generateUrlElement(`/on/${simileSlug}`, undefined, "0.5");
		});
	});

	// Collection pages (medium priority)
	const collections = ["mn", "sn", "an", "dhp", "iti", "snp", "ud"];
	collections.forEach((collection) => {
		sitemap +=
			"\n" + generateUrlElement(`/${collection}`, undefined, "0.8");
	});

	sitemap += "\n</urlset>";

	return new Response(sitemap, {
		status: 200,
		headers: {
			"Content-Type": "application/xml",
			"Cache-Control": "max-age=3600", // Cache for 1 hour
		},
	});
};
