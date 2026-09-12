import { FieldValue } from "firebase-admin/firestore";
import { db, isFirebaseInitialized } from "../service/firebase/server";
import {
	ASK_SAMPLE_COLLECTION,
	ASK_SAMPLE_SLUG_MAX,
	askSampleKeyFingerprint,
	askSampleTurnFromBody,
	deriveAskSampleSlug,
	isAskSampleSlug,
	isResearchAskSample,
	pickAskSampleSourceResults,
	sanitizeAskSamplePublic,
	type AiAskSamplePublic,
} from "./aiAskSamples";
import {
	clipResearchJobId,
	clipResearchProcessNotes,
	sanitizeResearchJobResult,
} from "./aiAskResearchJob";
import { normalizeAskQuestionKey } from "./aiAskSession";

function sampleRef(slug: string) {
	return db!.collection(ASK_SAMPLE_COLLECTION).doc(slug);
}

function millisFromFirestore(value: unknown, fallback = Date.now()): number {
	if (typeof value === "number" && Number.isFinite(value)) return value;
	if (
		value &&
		typeof value === "object" &&
		"toMillis" in value &&
		typeof (value as { toMillis: () => number }).toMillis === "function"
	) {
		return (value as { toMillis: () => number }).toMillis();
	}
	return fallback;
}

export async function loadAskSamples(): Promise<AiAskSamplePublic[]> {
	if (!isFirebaseInitialized || !db) return [];
	const snap = await db.collection(ASK_SAMPLE_COLLECTION).get();
	const out: AiAskSamplePublic[] = [];
	for (const doc of snap.docs) {
		const data = doc.data() || {};
		const sample = sanitizeAskSamplePublic({
			...data,
			slug: typeof data.slug === "string" ? data.slug : doc.id,
			updatedAt: millisFromFirestore(data.updatedAt),
		});
		if (sample) out.push(sample);
	}
	return out;
}

export async function loadAskSampleBySlug(
	slug: string,
): Promise<AiAskSamplePublic | null> {
	if (!isFirebaseInitialized || !db || !slug) return null;
	const snap = await sampleRef(slug).get();
	if (!snap.exists) return null;
	const data = snap.data() || {};
	return sanitizeAskSamplePublic({
		...data,
		slug: typeof data.slug === "string" ? data.slug : snap.id,
		updatedAt: millisFromFirestore(data.updatedAt),
	});
}

function allocateSampleSlug(
	question: string,
	questionKey: string,
	existing: readonly AiAskSamplePublic[],
	research: boolean,
): string {
	const prior = existing.find(
		(sample) =>
			sample.questionKey === questionKey &&
			isResearchAskSample(sample) === research,
	);
	if (prior) return prior.slug;
	const base = deriveAskSampleSlug(question);
	const preferred = research ? `${base}-report`.replace(/-+$/g, "") : base;
	const occupant = existing.find((sample) => sample.slug === preferred);
	if (!occupant || occupant.questionKey === questionKey) {
		if (preferred.length >= 8) return preferred.slice(0, ASK_SAMPLE_SLUG_MAX);
	}
	const fingerprint = askSampleKeyFingerprint(
		`${research ? "r:" : "a:"}${questionKey}`,
	);
	const budget = ASK_SAMPLE_SLUG_MAX - fingerprint.length - 1;
	const trimmed = (research ? `${base}-report` : base)
		.slice(0, Math.max(8, budget))
		.replace(/-+$/g, "");
	return `${trimmed}-${fingerprint}`;
}

async function loadResearchJobHits(
	uid: string,
	jobId: string,
): Promise<unknown[] | null> {
	const id = clipResearchJobId(jobId);
	if (!isFirebaseInitialized || !db || !uid || !id) return null;
	try {
		const snap = await db
			.collection("users")
			.doc(uid)
			.collection("researchJobs")
			.doc(id)
			.get();
		if (!snap.exists) return null;
		const data = snap.data() || {};
		const resultHits = sanitizeResearchJobResult(data.result)?.results || [];
		const draftHits = sanitizeResearchJobResult(data.draftResult)?.results || [];
		return pickAskSampleSourceResults(resultHits, draftHits);
	} catch {
		return null;
	}
}

export async function upsertAskSample(options: {
	body: unknown;
	updatedBy: string;
	uid?: string;
}): Promise<
	| { ok: true; sample: AiAskSamplePublic; replaced: boolean }
	| { ok: false; error: string }
> {
	if (!options.body || typeof options.body !== "object") {
		return {
			ok: false,
			error: "A question with discourse results is required.",
		};
	}
	const raw = options.body as Record<string, unknown>;
	const jobId =
		typeof raw.researchJobId === "string" ? raw.researchJobId.trim() : "";
	const jobHits =
		options.uid && jobId
			? await loadResearchJobHits(options.uid, jobId)
			: null;
	const turn = askSampleTurnFromBody({
		...raw,
		results: pickAskSampleSourceResults(raw.results, jobHits),
	});
	if (!turn) {
		return {
			ok: false,
			error: "A question with discourse results is required.",
		};
	}
	if (!isFirebaseInitialized || !db) {
		return { ok: false, error: "Ask samples are unavailable." };
	}

	const questionKey = normalizeAskQuestionKey(turn.question);
	const existing = await loadAskSamples();
	const research = isResearchAskSample(turn);
	const prior = existing.find(
		(sample) =>
			sample.questionKey === questionKey &&
			isResearchAskSample(sample) === research,
	);
	const slug = allocateSampleSlug(
		turn.question,
		questionKey,
		existing,
		research,
	);
	const processNotes = clipResearchProcessNotes(raw.processNotes);
	const payload = {
		...turn,
		slug,
		questionKey,
		updatedBy: options.updatedBy,
		updatedAt: FieldValue.serverTimestamp(),
		processNotes,
	};
	await sampleRef(slug).set(payload);
	const sample = sanitizeAskSamplePublic({
		...turn,
		slug,
		questionKey,
		updatedAt: Date.now(),
		processNotes,
	});
	if (!sample) {
		return { ok: false, error: "Could not save this example." };
	}
	return { ok: true, sample, replaced: Boolean(prior) };
}

export async function deleteAskSample(options: {
	slug: string;
}): Promise<
	| { ok: true; slug: string }
	| { ok: false; error: string }
> {
	const slug = options.slug.trim().toLowerCase();
	if (!slug || !isAskSampleSlug(slug)) {
		return { ok: false, error: "A sample slug is required." };
	}
	if (!isFirebaseInitialized || !db) {
		return { ok: false, error: "Ask samples are unavailable." };
	}
	const existing = await loadAskSampleBySlug(slug);
	if (!existing) {
		return { ok: false, error: "That example is no longer published." };
	}
	await sampleRef(slug).delete();
	return { ok: true, slug: existing.slug };
}
