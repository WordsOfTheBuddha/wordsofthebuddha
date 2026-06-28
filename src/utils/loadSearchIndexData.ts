import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

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

function publicJsonCandidates(filename: string): string[] {
	const cwd = process.cwd();
	return [
		path.join(cwd, "generated", filename),
		path.join(cwd, "public", filename),
		path.join(cwd, ".vercel", "output", "static", filename),
	];
}

async function readJsonFromDisk(filename: string): Promise<SearchIndexDoc[] | null> {
	for (const filePath of publicJsonCandidates(filename)) {
		if (!existsSync(filePath)) continue;
		const raw = await readFile(filePath, "utf8");
		return JSON.parse(raw) as SearchIndexDoc[];
	}
	return null;
}

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
	if (import.meta.env.SSR) {
		const fromDisk = await readJsonFromDisk(filename);
		if (fromDisk) return fromDisk;
	}
	// Production SSR: indexes are on the static CDN, not in the serverless bundle.
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
