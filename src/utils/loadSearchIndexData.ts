export interface SearchIndexDoc {
	slug: string;
	title: string;
	description?: string;
	content?: string;
	contentPali?: string;
	maxScore?: number;
	priority?: number;
	contentSearchable?: boolean;
	referenceOnly?: boolean;
	/** Display PTS citation, e.g. "PTS 4.152–4.155" */
	volpage?: string;
}

const NATIVE_JSON = "search-index.json";
const META_JSON = "search-meta.json";
const REFERENCE_JSON = "reference-search-index.json";

const isDevSsr = Boolean(import.meta.env?.DEV && import.meta.env?.SSR);
const isSsr = Boolean(import.meta.env?.SSR);

let nativeCache: SearchIndexDoc[] | null = null;
let nativeHasContent = false;
let nativeCacheMtimeMs = 0;
let nativeReloadPromise: Promise<void> | null = null;
let nativeMetaLoadPromise: Promise<SearchIndexDoc[]> | null = null;
let nativeFullLoadPromise: Promise<SearchIndexDoc[]> | null = null;
let nativeContentAbort: AbortController | null = null;

let referenceCache: SearchIndexDoc[] | null = null;
let referenceCacheMtimeMs = 0;
let referenceReloadPromise: Promise<void> | null = null;
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

function docsHaveBodyContent(docs: SearchIndexDoc[]): boolean {
	return docs.some(
		(doc) => typeof doc.content === "string" && doc.content.length > 0,
	);
}

async function fetchJson(
	filename: string,
	signal?: AbortSignal,
): Promise<SearchIndexDoc[]> {
	const base =
		typeof window !== "undefined"
			? window.location.origin
			: siteOrigin();
	const res = await fetch(`${base}/${filename}`, { signal });
	if (!res.ok) {
		throw new Error(`Failed to load ${filename}: ${res.status}`);
	}
	return (await res.json()) as SearchIndexDoc[];
}

async function loadIndex(
	filename: string,
	signal?: AbortSignal,
): Promise<SearchIndexDoc[]> {
	// Disk read only on server/build — dynamic import keeps node:fs out of client bundles.
	if (isSsr) {
		const { readIndexFromDisk } = await import("./loadSearchIndexData.server");
		const fromDisk = await readIndexFromDisk(filename);
		if (fromDisk) return fromDisk;
	}
	return fetchJson(filename, signal);
}

async function readMtime(filename: string): Promise<number> {
	if (!isDevSsr) return 0;
	const { getIndexMtimeFromDisk } = await import("./loadSearchIndexData.server");
	return getIndexMtimeFromDisk(filename);
}

function setNativeCache(data: SearchIndexDoc[], hasContent: boolean): void {
	nativeCache = data;
	nativeHasContent = hasContent || docsHaveBodyContent(data);
}

async function reloadNativeCache(): Promise<void> {
	const data = await loadIndex(NATIVE_JSON);
	const mtimeMs = await readMtime(NATIVE_JSON);
	setNativeCache(data, true);
	nativeCacheMtimeMs = mtimeMs;
	if (import.meta.env.DEV) {
		console.log(
			`[search-index] dev cache reloaded (${data.length} docs, mtime=${mtimeMs})`,
		);
	}
}

async function reloadReferenceCache(): Promise<void> {
	const data = await loadIndex(REFERENCE_JSON);
	const mtimeMs = await readMtime(REFERENCE_JSON);
	referenceCache = data;
	referenceCacheMtimeMs = mtimeMs;
	if (import.meta.env.DEV) {
		console.log(
			`[search-index] dev reference cache reloaded (${data.length} docs, mtime=${mtimeMs})`,
		);
	}
}

/** Dev-only: rebuild native index cache in the background (stale-while-revalidate). */
export function scheduleNativeSearchIndexReload(): void {
	if (!isDevSsr) return;
	if (nativeReloadPromise) return;
	nativeReloadPromise = reloadNativeCache()
		.catch((err) => {
			console.error("[search-index] dev native reload failed:", err);
		})
		.finally(() => {
			nativeReloadPromise = null;
		});
}

/** Dev-only: rebuild reference index cache in the background (stale-while-revalidate). */
export function scheduleReferenceSearchIndexReload(): void {
	if (!isDevSsr) return;
	if (referenceReloadPromise) return;
	referenceReloadPromise = reloadReferenceCache()
		.catch((err) => {
			console.error("[search-index] dev reference reload failed:", err);
		})
		.finally(() => {
			referenceReloadPromise = null;
		});
}

async function loadNativeSearchIndexDev(): Promise<SearchIndexDoc[]> {
	const mtimeMs = await readMtime(NATIVE_JSON);

	if (!nativeCache) {
		const data = await loadIndex(NATIVE_JSON);
		setNativeCache(data, true);
		nativeCacheMtimeMs = mtimeMs;
		return data;
	}

	if (mtimeMs > nativeCacheMtimeMs) {
		scheduleNativeSearchIndexReload();
	}

	return nativeCache;
}

async function loadReferenceSearchIndexDev(): Promise<SearchIndexDoc[]> {
	const mtimeMs = await readMtime(REFERENCE_JSON);

	if (!referenceCache) {
		const data = await loadIndex(REFERENCE_JSON);
		referenceCache = data;
		referenceCacheMtimeMs = mtimeMs;
		return data;
	}

	if (mtimeMs > referenceCacheMtimeMs) {
		scheduleReferenceSearchIndexReload();
	}

	return referenceCache;
}

export function hasNativeSearchIndexContent(): boolean {
	return nativeHasContent && nativeCache != null;
}

/** True when the full body index is already in memory or a Cache Storage match. */
export async function isNativeSearchIndexContentCached(): Promise<boolean> {
	if (hasNativeSearchIndexContent()) return true;
	if (typeof window === "undefined" || typeof caches === "undefined") {
		return false;
	}
	try {
		const names = await caches.keys();
		for (const name of names) {
			const cache = await caches.open(name);
			const hit =
				(await cache.match("/search-index.json")) ||
				(await cache.match(new URL("/search-index.json", location.origin)));
			if (hit) return true;
		}
	} catch {
		/* ignore */
	}
	return false;
}

export function abortNativeSearchIndexContentLoad(): void {
	if (!nativeContentAbort) return;
	nativeContentAbort.abort();
	nativeContentAbort = null;
	nativeFullLoadPromise = null;
}

async function loadNativeMetaIndex(): Promise<SearchIndexDoc[]> {
	if (nativeCache) return nativeCache;
	if (!nativeMetaLoadPromise) {
		nativeMetaLoadPromise = loadIndex(META_JSON)
			.then((data) => {
				if (!nativeHasContent) {
					setNativeCache(data, false);
				}
				return nativeCache!;
			})
			.catch((err) => {
				nativeMetaLoadPromise = null;
				throw err;
			});
	}
	return nativeMetaLoadPromise;
}

async function loadNativeFullIndex(): Promise<SearchIndexDoc[]> {
	if (nativeCache && nativeHasContent) return nativeCache;
	if (!nativeFullLoadPromise) {
		nativeContentAbort = new AbortController();
		const { signal } = nativeContentAbort;
		nativeFullLoadPromise = loadIndex(NATIVE_JSON, signal)
			.then((data) => {
				setNativeCache(data, true);
				nativeContentAbort = null;
				return data;
			})
			.catch((err) => {
				nativeFullLoadPromise = null;
				nativeContentAbort = null;
				throw err;
			});
	}
	return nativeFullLoadPromise;
}

/**
 * Client: metadata-only unless `includeContent` (or the full file is already loaded).
 * SSR / API: always the full on-disk index.
 */
export async function loadNativeSearchIndex(
	options: { includeContent?: boolean } = {},
): Promise<SearchIndexDoc[]> {
	if (isDevSsr) {
		return loadNativeSearchIndexDev();
	}

	if (isSsr) {
		if (nativeCache && nativeHasContent) return nativeCache;
		if (!nativeFullLoadPromise) {
			nativeFullLoadPromise = loadIndex(NATIVE_JSON).then((data) => {
				setNativeCache(data, true);
				return data;
			});
		}
		return nativeFullLoadPromise;
	}

	if (options.includeContent) {
		return loadNativeFullIndex();
	}
	if (nativeCache) return nativeCache;
	return loadNativeMetaIndex();
}

/** Fetch and merge the full native index (body search). No-op if already loaded. */
export async function ensureNativeSearchIndexContent(): Promise<SearchIndexDoc[]> {
	return loadNativeSearchIndex({ includeContent: true });
}

export async function loadReferenceSearchIndex(): Promise<SearchIndexDoc[]> {
	if (isDevSsr) {
		return loadReferenceSearchIndexDev();
	}

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
	nativeHasContent = false;
	nativeCacheMtimeMs = 0;
	nativeReloadPromise = null;
	nativeMetaLoadPromise = null;
	nativeFullLoadPromise = null;
	nativeContentAbort?.abort();
	nativeContentAbort = null;
	referenceCache = null;
	referenceCacheMtimeMs = 0;
	referenceReloadPromise = null;
	referenceLoadPromise = null;
}
