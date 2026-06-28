export interface SearchIndexDoc {
	slug: string;
	title: string;
	description?: string;
	content: string;
	contentPali?: string;
	maxScore?: number;
	priority?: number;
	contentSearchable?: boolean;
	referenceOnly?: boolean;
}

const NATIVE_JSON = "search-index.json";
const REFERENCE_JSON = "reference-search-index.json";

let nativeCache: SearchIndexDoc[] | null = null;
let nativeLoadPromise: Promise<SearchIndexDoc[]> | null = null;
let referenceCache: SearchIndexDoc[] | null = null;
let referenceLoadPromise: Promise<SearchIndexDoc[]> | null = null;

function siteOrigin(): string {
	if (typeof process !== "undefined" && process.env.SITE) {
		return process.env.SITE.replace(/\/$/, "");
	}
	if (typeof process !== "undefined" && process.env.VERCEL_URL) {
		return `https://${process.env.VERCEL_URL}`;
	}
	return "http://localhost:4321";
}

async function fetchJson(filename: string): Promise<SearchIndexDoc[]> {
	const base =
		typeof window !== "undefined"
			? window.location.origin
			: siteOrigin();
	const res = await fetch(`${base}/${filename}`);
	if (!res.ok) {
		throw new Error(`Failed to load ${filename}: ${res.status}`);
	}
	return (await res.json()) as SearchIndexDoc[];
}

async function loadIndex(filename: string): Promise<SearchIndexDoc[]> {
	// Disk read only on server/build — dynamic import keeps node:fs out of client bundles.
	if (import.meta.env.SSR) {
		const { readIndexFromDisk } = await import("./loadSearchIndexData.server");
		const fromDisk = await readIndexFromDisk(filename);
		if (fromDisk) return fromDisk;
	}
	return fetchJson(filename);
}

export async function loadNativeSearchIndex(): Promise<SearchIndexDoc[]> {
	if (nativeCache) return nativeCache;
	if (!nativeLoadPromise) {
		nativeLoadPromise = loadIndex(NATIVE_JSON).then((data) => {
			nativeCache = data;
			return data;
		});
	}
	return nativeLoadPromise;
}

export async function loadReferenceSearchIndex(): Promise<SearchIndexDoc[]> {
	if (referenceCache) return referenceCache;
	if (!referenceLoadPromise) {
		referenceLoadPromise = loadIndex(REFERENCE_JSON).then((data) => {
			referenceCache = data;
			return data;
		});
	}
	return referenceLoadPromise;
}

/** Reset caches (tests / hot reload). */
export function resetSearchIndexCaches(): void {
	nativeCache = null;
	nativeLoadPromise = null;
	referenceCache = null;
	referenceLoadPromise = null;
}
