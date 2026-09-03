import { FieldValue } from "firebase-admin/firestore";
import type { UserRecord } from "firebase-admin/auth";
import { db, isFirebaseInitialized } from "../service/firebase/server";
import {
	ASK_SHARE_COLLECTION,
	askShareMatchesQuestion,
	askSharePath,
	normalizeAskShareSlug,
	resolveAskShareSlug,
	sanitizeAskShareSnapshot,
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

async function allocateShareSlug(
	preferred: string,
	question: string,
): Promise<{ slug: string; existing: AiAskShareSnapshot | null }> {
	const base = resolveAskShareSlug(preferred, "", question);
	let candidate = base;
	for (let attempt = 0; attempt < 24; attempt++) {
		const existing = await loadAskShare(candidate);
		if (!existing) return { slug: candidate, existing: null };
		if (askShareMatchesQuestion(existing, question)) {
			return { slug: candidate, existing };
		}
		const suffix = attempt < 8 ? String(attempt + 2) : `${Date.now().toString(36).slice(-4)}`;
		const trimmed = base.slice(0, Math.max(8, 48 - suffix.length - 1));
		candidate = `${trimmed}-${suffix}`;
	}
	return {
		slug: `${base.slice(0, 40)}-${Date.now().toString(36).slice(-6)}`,
		existing: null,
	};
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
		createdAt: Date.now(),
	});
	if (!draft) {
		throw new Error("Invalid share snapshot.");
	}
	if (!isFirebaseInitialized || !db) {
		return { slug: draft.slug, path: askSharePath(draft.slug), created: false };
	}

	const { slug, existing } = await allocateShareSlug(
		draft.slug,
		draft.question,
	);
	if (existing) {
		return { slug, path: askSharePath(slug), created: false };
	}

	const payload = {
		...draft,
		slug,
		createdAt: FieldValue.serverTimestamp(),
		...(options.user ? { createdBy: options.user.uid } : {}),
	};
	await shareRef(slug).create(payload);
	return { slug, path: askSharePath(slug), created: true };
}
