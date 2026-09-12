import { FieldValue } from "firebase-admin/firestore";
import type { UserRecord } from "firebase-admin/auth";
import { db, isFirebaseInitialized } from "../service/firebase/server";
import {
	ASK_SHARE_COLLECTION,
	askSharePath,
	normalizeAskShareSlug,
	resolveAskShareSlug,
	sanitizeAskShareSnapshot,
	uniquifyAskShareSlug,
	type AiAskShareSnapshot,
} from "./aiAskShare";

function shareRef(slug: string) {
	return db!.collection(ASK_SHARE_COLLECTION).doc(slug);
}

export async function loadAskShare(
	slug: string,
): Promise<AiAskShareSnapshot | null> {
	const clean = normalizeAskShareSlug(slug);
	if (!clean || !isFirebaseInitialized || !db) return null;
	const snap = await shareRef(clean).get();
	if (!snap.exists) return null;
	const data = snap.data() || {};
	const createdAtRaw = data.createdAt;
	const createdAt =
		typeof createdAtRaw === "number"
			? createdAtRaw
			: createdAtRaw &&
				  typeof createdAtRaw === "object" &&
				  "toMillis" in createdAtRaw &&
				  typeof (createdAtRaw as { toMillis: () => number }).toMillis ===
						"function"
				? (createdAtRaw as { toMillis: () => number }).toMillis()
				: Date.now();
	return sanitizeAskShareSnapshot({ ...data, slug: clean, createdAt });
}

function isAlreadyExistsError(error: unknown): boolean {
	if (!error || typeof error !== "object") return false;
	const code = "code" in error ? (error as { code: unknown }).code : undefined;
	return code === 6 || code === "already-exists";
}

async function allocateShareSlug(
	draft: AiAskShareSnapshot,
): Promise<{ slug: string; existing: AiAskShareSnapshot | null }> {
	return uniquifyAskShareSlug(
		draft.slug,
		draft,
		(slug) => loadAskShare(slug),
		draft.lookingFor,
	);
}

export async function publishAskShare(options: {
	preferredSlug?: string;
	question: string;
	lookingFor: string;
	queries: string[];
	fallbackQueries: string[];
	summary: string;
	results: AiAskShareSnapshot["results"];
	model: string;
	requestId?: string;
	research?: boolean;
	report?: string;
	reasoning?: string;
	candidateCount?: number;
	/** Conversation through the shared turn (oldest → newest). */
	thread?: AiAskShareSnapshot["thread"];
	user?: UserRecord | null;
}): Promise<{ slug: string; path: string; created: boolean }> {
	const draft = sanitizeAskShareSnapshot({
		slug: resolveAskShareSlug(
			options.preferredSlug,
			options.lookingFor,
			options.question,
		),
		question: options.question,
		lookingFor: options.lookingFor,
		queries: options.queries,
		fallbackQueries: options.fallbackQueries,
		summary: options.summary,
		results: options.results,
		model: options.model,
		requestId: options.requestId,
		...(options.research ? { research: true } : {}),
		...(options.report ? { report: options.report } : {}),
		...(options.reasoning ? { reasoning: options.reasoning } : {}),
		...(options.candidateCount ? { candidateCount: options.candidateCount } : {}),
		createdAt: Date.now(),
		...(options.thread && options.thread.length > 1
			? { thread: options.thread }
			: {}),
	});
	if (!draft) {
		throw new Error("Invalid share snapshot.");
	}
	const pathFor = (slug: string) =>
		askSharePath(slug, { research: draft.research === true });
	if (!isFirebaseInitialized || !db) {
		return { slug: draft.slug, path: pathFor(draft.slug), created: false };
	}

	const MAX_CREATE_ATTEMPTS = 6;
	for (let attempt = 0; attempt < MAX_CREATE_ATTEMPTS; attempt++) {
		const { slug, existing } = await allocateShareSlug(draft);
		const incomingThreadLen = draft.thread?.length || 1;
		const existingThreadLen = existing?.thread?.length || 1;
		if (existing) {
			// Re-sharing the same Ask with a fuller conversation should upgrade
			// the public snapshot (e.g. turn 2 share that includes turn 1).
			if (incomingThreadLen > existingThreadLen) {
				await shareRef(slug).set(
					{
						...draft,
						slug,
						createdAt: existing.createdAt,
						updatedAt: FieldValue.serverTimestamp(),
						...(options.user ? { createdBy: options.user.uid } : {}),
					},
					{ merge: true },
				);
			}
			return { slug, path: pathFor(slug), created: false };
		}

		const payload = {
			...draft,
			slug,
			createdAt: FieldValue.serverTimestamp(),
			...(options.user ? { createdBy: options.user.uid } : {}),
		};
		try {
			await shareRef(slug).create(payload);
			return { slug, path: pathFor(slug), created: true };
		} catch (error) {
			if (
				attempt + 1 < MAX_CREATE_ATTEMPTS &&
				isAlreadyExistsError(error)
			) {
				continue;
			}
			throw error;
		}
	}

	throw new Error("Could not allocate a unique share slug.");
}
