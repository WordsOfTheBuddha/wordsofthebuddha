/**
 * Same-browser durable store for Research attachments (pasted notes + images).
 *
 * Why IndexedDB and not localStorage/Firestore:
 * - A report can carry ~300KB of pasted notes (MAX_RESEARCH_CONTEXT_CHARS)
 *   plus up to 4 images (~500KB each after client resize, ~2MB total).
 * - localStorage is ~5MB shared with the whole Ask/Research history; writing
 *   full bytes there risks quota failures that drop the entire history write.
 * - Firestore history docs cap at 1 MiB (target 900KB) and the server research
 *   job doc never stores image bytes — only counts. So cross-device sync
 *   carries lightweight metadata (preview / label / counts) while full bytes
 *   stay in this browser-local store.
 *
 * Keyed by researchJobId. Each job's attachments are effectively immutable
 * after submit, so saves merge: incoming non-empty fields fill gaps but never
 * wipe stored bytes with empty data (later persist calls run after the pending
 * submit snapshot was cleared).
 *
 * Browser-safe: no-ops outside a browser (SSR, unit tests without indexedDB)
 * fall back to a small in-memory map so callers never have to branch.
 */

import {
	clipResearchContext,
	countContextWords,
	formatContextChipLabel,
	researchContextImageByteLength,
	researchContextPreview,
	sanitizeResearchContextImages,
	type ResearchContextImage,
} from "./aiAskComposition";

export interface StoredResearchAttachments {
	jobId: string;
	/** Full pasted-notes text (clipped to MAX_RESEARCH_CONTEXT_CHARS). */
	contextFull: string;
	/** Full image bytes for thumbnails / overlay / re-send. */
	images: ResearchContextImage[];
	contextPreview?: string;
	contextWordCount?: number;
	contextAttachmentLabel?: string;
	imageCount?: number;
	updatedAt: number;
}

export const RESEARCH_ATTACHMENTS_DB_NAME = "research-attachments-v1";
export const RESEARCH_ATTACHMENTS_STORE_NAME = "byJob";
/** Keep at most this many jobs' bytes locally. */
export const RESEARCH_ATTACHMENTS_MAX_ENTRIES = 10;
/** Prune oldest first past this total byte budget. */
export const RESEARCH_ATTACHMENTS_MAX_BYTES = 15_000_000;

function clipJobId(value: string): string {
	return value.replace(/\s+/g, "").trim().slice(0, 80);
}

export function researchAttachmentsByteLength(
	record: Pick<StoredResearchAttachments, "contextFull" | "images">,
): number {
	let bytes = 0;
	try {
		bytes += new TextEncoder().encode(record.contextFull || "").length;
	} catch {
		bytes += (record.contextFull || "").length;
	}
	for (const image of record.images || []) {
		bytes += researchContextImageByteLength(image);
	}
	return bytes;
}

/** Normalize + bound an incoming record before storage. */
export function toStoredResearchAttachments(input: {
	jobId: string;
	contextFull?: string;
	images?: readonly ResearchContextImage[];
	contextPreview?: string;
	contextWordCount?: number;
	contextAttachmentLabel?: string;
	imageCount?: number;
	updatedAt?: number;
}): StoredResearchAttachments | null {
	const jobId = clipJobId(input.jobId);
	if (!jobId) return null;
	const contextFull = clipResearchContext(input.contextFull || "");
	const images = sanitizeResearchContextImages(input.images);
	const contextPreview =
		typeof input.contextPreview === "string" && input.contextPreview.trim()
			? input.contextPreview.replace(/\s+/g, " ").trim().slice(0, 200)
			: contextFull.trim()
				? researchContextPreview(contextFull)
				: undefined;
	const contextWordCount =
		typeof input.contextWordCount === "number" &&
		Number.isFinite(input.contextWordCount) &&
		input.contextWordCount > 0
			? Math.floor(input.contextWordCount)
			: contextFull.trim()
				? countContextWords(contextFull)
				: undefined;
	const contextAttachmentLabel =
		typeof input.contextAttachmentLabel === "string" &&
		input.contextAttachmentLabel.trim()
			? input.contextAttachmentLabel
					.replace(/\s+/g, " ")
					.trim()
					.slice(0, 80)
			: contextFull.trim()
				? formatContextChipLabel(contextFull)
				: undefined;
	const imageCount =
		typeof input.imageCount === "number" &&
		Number.isFinite(input.imageCount) &&
		input.imageCount > 0
			? Math.min(4, Math.floor(input.imageCount))
			: images.length > 0
				? images.length
				: undefined;
	if (
		!contextFull.trim() &&
		images.length === 0 &&
		!contextPreview &&
		!contextAttachmentLabel &&
		typeof imageCount !== "number"
	) {
		return null;
	}
	return {
		jobId,
		contextFull,
		images,
		...(contextPreview ? { contextPreview } : {}),
		...(typeof contextWordCount === "number" ? { contextWordCount } : {}),
		...(contextAttachmentLabel ? { contextAttachmentLabel } : {}),
		...(typeof imageCount === "number" ? { imageCount } : {}),
		updatedAt:
			typeof input.updatedAt === "number" &&
			Number.isFinite(input.updatedAt) &&
			input.updatedAt > 0
				? Math.floor(input.updatedAt)
				: Date.now(),
	};
}

/** Merge incoming fields over stored ones; empty incoming never wipes bytes. */
export function mergeStoredResearchAttachments(
	stored: StoredResearchAttachments | null | undefined,
	incoming: StoredResearchAttachments,
): StoredResearchAttachments {
	if (!stored || stored.jobId !== incoming.jobId) return incoming;
	const contextFull =
		incoming.contextFull.trim().length >= stored.contextFull.trim().length
			? incoming.contextFull
			: stored.contextFull;
	const images =
		incoming.images.length >= stored.images.length
			? incoming.images
			: stored.images;
	return {
		jobId: stored.jobId,
		contextFull,
		images,
		contextPreview: incoming.contextPreview || stored.contextPreview,
		contextWordCount: incoming.contextWordCount ?? stored.contextWordCount,
		contextAttachmentLabel:
			incoming.contextAttachmentLabel || stored.contextAttachmentLabel,
		imageCount: incoming.imageCount ?? stored.imageCount,
		updatedAt: Math.max(stored.updatedAt, incoming.updatedAt),
	};
}

/** In-memory fallback for SSR / tests without indexedDB. */
const memoryFallback = new Map<string, StoredResearchAttachments>();

function indexedDBOrNull(): IDBFactory | null {
	try {
		if (typeof indexedDB === "undefined") return null;
		return indexedDB;
	} catch {
		return null;
	}
}

function openStore(): Promise<IDBObjectStore | null> {
	const factory = indexedDBOrNull();
	if (!factory) return Promise.resolve(null);
	return new Promise((resolve) => {
		try {
			const request = factory.open(RESEARCH_ATTACHMENTS_DB_NAME, 1);
			request.onupgradeneeded = () => {
				const db = request.result;
				if (!db.objectStoreNames.contains(RESEARCH_ATTACHMENTS_STORE_NAME)) {
					db.createObjectStore(RESEARCH_ATTACHMENTS_STORE_NAME, {
						keyPath: "jobId",
					});
				}
			};
			request.onsuccess = () => {
				try {
					const db = request.result;
					const tx = db.transaction(RESEARCH_ATTACHMENTS_STORE_NAME, "readwrite");
					const store = tx.objectStore(RESEARCH_ATTACHMENTS_STORE_NAME);
					tx.oncomplete = () => db.close();
					tx.onerror = () => {
						try {
							db.close();
						} catch {
							/* ignore */
						}
					};
					resolve(store);
				} catch {
					try {
						request.result.close();
					} catch {
						/* ignore */
					}
					resolve(null);
				}
			};
			request.onerror = () => resolve(null);
			request.onblocked = () => resolve(null);
		} catch {
			resolve(null);
		}
	});
}

function idbRequest<T>(make: (store: IDBObjectStore) => IDBRequest<T>): Promise<T | null> {
	return openStore().then((store) => {
		if (!store) return null;
		return new Promise<T | null>((resolve) => {
			try {
				const request = make(store);
				request.onsuccess = () => resolve(request.result ?? null);
				request.onerror = () => resolve(null);
			} catch {
				resolve(null);
			}
		});
	});
}

/** Reset the in-memory fallback (tests only). */
export function resetResearchAttachmentsMemoryForTests(): void {
	memoryFallback.clear();
}

/** Read the in-memory fallback (tests only). */
export function readResearchAttachmentsMemoryForTests(
	jobId: string,
): StoredResearchAttachments | null {
	const id = clipJobId(jobId);
	if (!id) return null;
	return memoryFallback.get(id) ?? null;
}

export async function saveResearchAttachments(
	input: {
		jobId: string;
		contextFull?: string;
		images?: readonly ResearchContextImage[];
		contextPreview?: string;
		contextWordCount?: number;
		contextAttachmentLabel?: string;
		imageCount?: number;
		updatedAt?: number;
	},
	options?: { keepJobIds?: readonly string[] },
): Promise<StoredResearchAttachments | null> {
	const incoming = toStoredResearchAttachments(input);
	if (!incoming) return null;
	const existing = await loadResearchAttachments(incoming.jobId);
	const merged = mergeStoredResearchAttachments(existing, incoming);
	memoryFallback.set(merged.jobId, merged);
	await idbRequest((store) => store.put(merged));
	void pruneResearchAttachments(options?.keepJobIds).catch(() => {});
	return merged;
}

export async function loadResearchAttachments(
	jobId: string,
): Promise<StoredResearchAttachments | null> {
	const id = clipJobId(jobId);
	if (!id) return null;
	const fromIdb = await idbRequest<StoredResearchAttachments>((store) =>
		store.get(id),
	);
	if (fromIdb && fromIdb.jobId === id) {
		memoryFallback.set(id, fromIdb);
		return fromIdb;
	}
	return memoryFallback.get(id) ?? null;
}

export async function deleteResearchAttachments(jobId: string): Promise<void> {
	const id = clipJobId(jobId);
	if (!id) return;
	memoryFallback.delete(id);
	await idbRequest((store) => store.delete(id));
}

/**
 * Drop oldest records past the entry/byte budget. `keepJobIds` (e.g. jobs
 * still in history) are always retained; everything else is pruned oldest-first.
 */
export async function pruneResearchAttachments(
	keepJobIds?: readonly string[],
): Promise<void> {
	const keep = new Set(
		(keepJobIds || []).map((id) => clipJobId(id)).filter(Boolean),
	);
	const all = await listResearchAttachments();
	if (all.length === 0) return;
	const sizes = new Map<string, number>();
	let bytes = 0;
	for (const record of all) {
		const size = researchAttachmentsByteLength(record);
		sizes.set(record.jobId, size);
		bytes += size;
	}
	let count = all.length;
	const oldestFirst = [...all].sort((a, b) => a.updatedAt - b.updatedAt);
	for (const record of oldestFirst) {
		if (keep.has(record.jobId)) continue;
		if (
			count <= RESEARCH_ATTACHMENTS_MAX_ENTRIES &&
			bytes <= RESEARCH_ATTACHMENTS_MAX_BYTES
		) {
			break;
		}
		await deleteResearchAttachments(record.jobId);
		count -= 1;
		bytes -= sizes.get(record.jobId) || 0;
	}
}

async function listResearchAttachments(): Promise<StoredResearchAttachments[]> {
	const fromIdb = await idbRequest<StoredResearchAttachments[]>((store) =>
		store.getAll(),
	);
	if (fromIdb && fromIdb.length > 0) return fromIdb;
	return [...memoryFallback.values()];
}
