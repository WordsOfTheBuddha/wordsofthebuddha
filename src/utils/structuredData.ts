import { buildBreadcrumbTrail } from "./breadcrumbTrail";
import { directoryStructure } from "../data/directoryStructure";

const SITE_NAME = "Words of the Buddha";

type JsonLdNode = Record<string, unknown>;

export type StructuredDataInput = {
	origin: string;
	canonicalURL: string;
	/** Layout's `fp` (content path) or the URL pathname. Drives the breadcrumb trail. */
	breadcrumbPath?: string | null;
	urlPathname: string;
	title?: string | null;
	seoTitle?: string | null;
	description?: string | null;
	/** Discourse id (e.g. `mn1`). Absent on listing and static pages. */
	id?: string | null;
	imageURL?: string | null;
	lastUpdated?: string | Date | null;
	/** Reference views credit B. Sujato rather than the site's own translation. */
	viewSource?: "en" | "sujato-reference" | "pli" | "pli-ms";
	isHome?: boolean;
};

function publisher(origin: string): JsonLdNode {
	return {
		"@type": "Organization",
		"@id": `${origin}/#organization`,
		name: SITE_NAME,
		url: `${origin}/`,
		logo: {
			"@type": "ImageObject",
			url: `${origin}/icon-512-rounded.png`,
			width: 512,
			height: 512,
		},
	};
}

function toISODate(value: string | Date | null | undefined): string | null {
	if (!value) return null;
	const date = value instanceof Date ? value : new Date(value);
	return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

/** Google truncates headlines past ~110 characters. */
function clampHeadline(value: string): string {
	return value.length <= 110 ? value : `${value.slice(0, 107).trimEnd()}…`;
}

function collectionNode(origin: string, id: string): JsonLdNode | null {
	const prefix = id.match(/^[a-z]+/i)?.[0]?.toLowerCase();
	if (!prefix) return null;
	const collection = (
		directoryStructure as Record<string, { title?: string } | undefined>
	)[prefix];
	if (!collection?.title) return null;
	return {
		"@type": "CreativeWorkSeries",
		"@id": `${origin}/${prefix}#series`,
		name: collection.title,
		url: `${origin}/${prefix}`,
	};
}

function breadcrumbNode(
	origin: string,
	input: StructuredDataInput,
): JsonLdNode | null {
	const path = input.breadcrumbPath || input.urlPathname;
	const trail = buildBreadcrumbTrail(path, input.urlPathname);
	if (trail.length < 2) return null;

	return {
		"@type": "BreadcrumbList",
		"@id": `${input.canonicalURL}#breadcrumb`,
		itemListElement: trail.map((crumb, index) => ({
			"@type": "ListItem",
			position: index + 1,
			name: crumb.title || crumb.label,
			...(crumb.path ? { item: new URL(crumb.path, origin).href } : {}),
		})),
	};
}

function articleNode(
	origin: string,
	input: StructuredDataInput,
): JsonLdNode | null {
	if (!input.id) return null;

	const headline = input.title || input.seoTitle;
	if (!headline) return null;

	const modified = toISODate(input.lastUpdated);
	const isReference =
		input.viewSource === "sujato-reference" || input.viewSource === "pli";
	const series = collectionNode(origin, input.id);

	return {
		"@type": "Article",
		"@id": `${input.canonicalURL}#article`,
		headline: clampHeadline(headline),
		...(input.description ? { description: input.description } : {}),
		inLanguage: "en",
		url: input.canonicalURL,
		mainEntityOfPage: { "@type": "WebPage", "@id": input.canonicalURL },
		...(input.imageURL ? { image: input.imageURL } : {}),
		...(modified ? { dateModified: modified } : {}),
		author: isReference
			? { "@type": "Person", name: "Bhikkhu Sujato" }
			: { "@type": "Organization", name: SITE_NAME },
		...(isReference
			? { translator: { "@type": "Person", name: "Bhikkhu Sujato" } }
			: {}),
		publisher: { "@id": `${origin}/#organization` },
		isAccessibleForFree: true,
		license: `${origin}/public-domain`,
		...(series ? { isPartOf: series } : {}),
	};
}

function websiteNode(origin: string): JsonLdNode {
	return {
		"@type": "WebSite",
		"@id": `${origin}/#website`,
		name: SITE_NAME,
		url: `${origin}/`,
		inLanguage: "en",
		publisher: { "@id": `${origin}/#organization` },
		potentialAction: {
			"@type": "SearchAction",
			target: {
				"@type": "EntryPoint",
				urlTemplate: `${origin}/search?q={search_term_string}`,
			},
			"query-input": "required name=search_term_string",
		},
	};
}

/** Builds the page's JSON-LD `@graph`, or null when there is nothing worth emitting. */
export function buildStructuredData(
	input: StructuredDataInput,
): JsonLdNode | null {
	const { origin } = input;
	const graph: JsonLdNode[] = [];

	if (input.isHome) {
		graph.push(publisher(origin), websiteNode(origin));
	}

	const article = articleNode(origin, input);
	if (article) graph.push(article);

	const breadcrumb = breadcrumbNode(origin, input);
	if (breadcrumb) graph.push(breadcrumb);

	if (graph.length === 0) return null;

	// The Organization node is referenced by @id from Article/WebSite, so it must
	// be present in the graph whenever one of those is.
	if (!input.isHome && graph.some((node) => "publisher" in node)) {
		graph.unshift(publisher(origin));
	}

	return { "@context": "https://schema.org", "@graph": graph };
}
