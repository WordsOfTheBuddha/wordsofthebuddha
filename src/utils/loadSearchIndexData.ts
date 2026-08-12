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
	/** Display PTS citation, e.g. "PTS 4.152–4.155" */
	volpage?: string;
}

const NATIVE_JSON = "search-index.json";
const REFERENCE_JSON = "reference-search-index.json";

const isDevSsr = import.meta.env.DEV && import.meta.env.SSR;

let nativeCache: SearchIndexDoc[] | null = null;
let nativeCacheMtimeMs = 0;
let nativeReloadPromise: Promise<void> | null = null;
let nativeLoadPromise: Promise<SearchIndexDoc[]> | null = null;

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

async function readMtime(filename: string): Promise<number> {
	if (!isDevSsr) return 0;
	const { getIndexMtimeFromDisk } = await import("./loadSearchIndexData.server");
	return getIndexMtimeFromDisk(filename);
}

async function reloadNativeCache(): Promise<void> {
	const data = await loadIndex(NATIVE_JSON);
	const mtimeMs = await readMtime(NATIVE_JSON);
	nativeCache = data;
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
		nativeCache = data;
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

export async function loadNativeSearchIndex(): Promise<SearchIndexDoc[]> {
	if (isDevSsr) {
		return loadNativeSearchIndexDev();
	}

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
	nativeCacheMtimeMs = 0;
	nativeReloadPromise = null;
	nativeLoadPromise = null;
	referenceCache = null;
	referenceCacheMtimeMs = 0;
	referenceReloadPromise = null;
	referenceLoadPromise = null;
}
