import { FieldValue } from "firebase-admin/firestore";
import { db, isFirebaseInitialized } from "../service/firebase/server";
import {
	ASK_SAMPLE_COLLECTION,
	ASK_SAMPLE_SLUG_MAX,
	askSampleKeyFingerprint,
	deriveAskSampleSlug,
	isResearchAskSample,
	sanitizeAskSamplePublic,
	type AiAskSamplePublic,
} from "./aiAskSamples";
import { clipResearchProcessNotes } from "./aiAskResearchJob";
import { normalizeAskQuestionKey } from "./aiAskSession";
import { sanitizeAskShareTurn } from "./aiAskShare";

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

export async function upsertAskSample(options: {
	body: unknown;
	updatedBy: string;
}): Promise<
	| { ok: true; sample: AiAskSamplePublic; replaced: boolean }
	| { ok: false; error: string }
> {
	const turn = sanitizeAskShareTurn(options.body);
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
	const processNotes = clipResearchProcessNotes(
		options.body && typeof options.body === "object"
			? (options.body as Record<string, unknown>).processNotes
			: undefined,
	);
	const payload = {
		...turn,
		slug,
		questionKey,
		updatedBy: options.updatedBy,
		updatedAt: FieldValue.serverTimestamp(),
		processNotes,
	};
	await sampleRef(slug).set(payload, { merge: true });
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
