export const prerender = false;
import type { APIRoute } from "astro";
import { getCollection } from "astro:content";
import { routes } from "../utils/routes";
import { referenceOnlyRoutes } from "../utils/referenceOnlyRoutes";
import { getLastModified } from "../utils/getLastModified";
import topicMappings from "../data/topicMappings.json";
import qualityMappings from "../data/qualityMappings.json";
import simileMappings from "../data/simileMappings.json";
import personMappings from "../data/personMappings.json";

const SITE_URL = "https://www.wordsofthebuddha.org";

/** Anthology content lives under /anthologies/; the bare slug is a redirect. */
import { anthologySlugSet as ANTHOLOGY_SLUGS } from "../utils/anthologySlugs";

/** Homepage content entry; its slug must not be emitted as /index. */
const HOME_SLUG = "index";

/**
 * Hand-maintained non-discourse pages. `/random` is absent: it's a client-side
 * redirect stub with `noindex`. `/search` is included; canonical strips `?q=`
 * so unknown-slug redirects consolidate onto one URL.
 */
const STATIC_PAGES = [
	"/",
	"/search",
	"/discover",
	"/anthologies",
	"/buddha-quotes",
	"/qualities",
	"/simile",
	"/explorer",
	"/privacy",
	"/public-domain",
];

const COLLECTIONS = ["mn", "sn", "an", "dn", "dhp", "iti", "snp", "ud"];

function urlElement(path: string, lastmod?: string): string {
	return [
		"  <url>",
		`    <loc>${SITE_URL}${path}</loc>`,
		lastmod ? `    <lastmod>${lastmod}</lastmod>` : null,
		"  </url>",
	]
		.filter(Boolean)
		.join("\n");
}

export const GET: APIRoute = async () => {
	/** Path -> lastmod. A Map dedupes paths reachable from several sources. */
	const entries = new Map<string, string | undefined>();
	const add = (path: string, lastmod?: string) => {
		if (!entries.has(path) || (lastmod && !entries.get(path))) {
			entries.set(path, lastmod);
		}
	};

	STATIC_PAGES.forEach((path) => add(path));
	COLLECTIONS.forEach((collection) => add(`/${collection}`));

	/**
	 * `lastmod` comes from the git-backed timestamp cache via the entry's real
	 * filePath. Only genuine dates are emitted — a `lastmod` that is always
	 * "today" (the previous behaviour) trains crawlers to ignore the field.
	 */
	const today = new Date().toISOString().split("T")[0];
	const lastmodBySlug = new Map<string, string>();
	for (const entry of await getCollection("all")) {
		if (!entry.filePath) continue;
		const iso = getLastModified(entry.filePath).toISOString().split("T")[0];
		if (iso !== today) lastmodBySlug.set(entry.id, iso);
	}

	// The site's own English translations.
	routes.forEach((slug) => {
		if (slug === HOME_SLUG) return;
		const path = ANTHOLOGY_SLUGS.has(slug)
			? `/anthologies/${slug}`
			: `/${slug}`;
		add(path, lastmodBySlug.get(slug));
	});

	// Pāli + B. Sujato reference discourses: no in-house translation exists for
	// these slugs, so they are the site's only version and were absent entirely.
	referenceOnlyRoutes.forEach((slug) => add(`/${slug}`));

	Object.keys(topicMappings).forEach((slug) => add(`/on/${slug}`));
	Object.keys(qualityMappings).forEach((slug) => add(`/on/${slug}`));

	Object.values(simileMappings as Record<string, Record<string, unknown>>).forEach(
		(group) => {
			Object.keys(group).forEach((simile) =>
				add(`/on/${simile.toLowerCase().replace(/\s+/g, "-")}`),
			);
		},
	);

	Object.values(personMappings as Record<string, Record<string, unknown>>).forEach(
		(group) => {
			Object.keys(group).forEach((slug) => add(`/on/${slug}`));
		},
	);

	const body = [...entries.entries()]
		.sort(([a], [b]) => a.localeCompare(b))
		.map(([path, lastmod]) => urlElement(path, lastmod))
		.join("\n");

	const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${body}
</urlset>`;

	return new Response(sitemap, {
		status: 200,
		headers: {
			"Content-Type": "application/xml",
			"Cache-Control": "max-age=3600",
		},
	});
};
