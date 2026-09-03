import { FieldValue } from "firebase-admin/firestore";
import type { UserRecord } from "firebase-admin/auth";
import { db, isFirebaseInitialized } from "../service/firebase/server";
import {
	askQuotaDocId,
	askQuotaSubjectKey,
	applyAskFeedbackBonus,
	consumeAskQuotaState,
	dismissAskFeedbackPrompt,
	emptyAskQuotaState,
	isAskQuotaSignedIn,
	toAskQuotaView,
	utcAskDay,
	type AskQuotaState,
	type AskQuotaView,
} from "./aiAskQuota";
import { clientIpFromRequest } from "./aiRateLimit";

const COLLECTION = "askQuota";

const memory = new Map<string, AskQuotaState>();

function cloneState(state: AskQuotaState): AskQuotaState {
	return { ...state };
}

function fromDoc(data: Record<string, unknown>, fallback: AskQuotaState): AskQuotaState {
	return {
		day: typeof data.day === "string" ? data.day : fallback.day,
		subjectKind: data.subjectKind === "user" ? "user" : "anon",
		subjectKey:
			typeof data.subjectKey === "string" ? data.subjectKey : fallback.subjectKey,
		used: typeof data.used === "number" ? Math.max(0, Math.floor(data.used)) : 0,
		baseLimit:
			typeof data.baseLimit === "number"
				? Math.max(0, Math.floor(data.baseLimit))
				: fallback.baseLimit,
		feedbackBonus:
			typeof data.feedbackBonus === "number"
				? Math.max(0, Math.floor(data.feedbackBonus))
				: 0,
		feedbackClaimed: data.feedbackClaimed === true,
		feedbackPromptDismissed: data.feedbackPromptDismissed === true,
	};
}

async function readState(docId: string, seed: AskQuotaState): Promise<AskQuotaState> {
	if (!isFirebaseInitialized || !db) {
		return cloneState(memory.get(docId) || seed);
	}
	const snap = await db.collection(COLLECTION).doc(docId).get();
	if (!snap.exists) return cloneState(seed);
	return fromDoc(snap.data() as Record<string, unknown>, seed);
}

async function writeState(docId: string, state: AskQuotaState): Promise<void> {
	memory.set(docId, cloneState(state));
	if (!isFirebaseInitialized || !db) return;
	await db
		.collection(COLLECTION)
		.doc(docId)
		.set(
			{
				...state,
				updatedAt: FieldValue.serverTimestamp(),
			},
			{ merge: true },
		);
}

export function resolveAskQuotaSubject(
	request: Request,
	user: UserRecord | null,
): {
	subjectKind: "anon" | "user";
	subjectKey: string;
	signedIn: boolean;
	needsEmailVerification: boolean;
} {
	const ip = clientIpFromRequest(request);
	const quotaSignedIn = isAskQuotaSignedIn(user);
	const needsEmailVerification = Boolean(user?.uid && !user.emailVerified);
	const resolved = askQuotaSubjectKey({
		signedIn: quotaSignedIn,
		uid: user?.uid,
		ip,
	});
	return {
		...resolved,
		signedIn: resolved.subjectKind === "user",
		needsEmailVerification,
	};
}

/**
 * Same-day anonymous Asks from this IP count against a newly signed-in quota
 * so signing in cannot reset the free tier.
 */
async function priorAnonUsedForSignedIn(options: {
	request: Request;
	signedIn: boolean;
	day: string;
}): Promise<number> {
	if (!options.signedIn) return 0;
	const ip = clientIpFromRequest(options.request);
	const anon = askQuotaSubjectKey({ signedIn: false, uid: null, ip });
	const seed = emptyAskQuotaState({
		day: options.day,
		subjectKind: anon.subjectKind,
		subjectKey: anon.subjectKey,
	});
	const state = await readState(askQuotaDocId(options.day, anon.subjectKey), seed);
	if (state.day !== options.day) return 0;
	return Math.max(0, state.used);
}

export async function getAskQuotaView(options: {
	request: Request;
	user: UserRecord | null;
	now?: number;
}): Promise<AskQuotaView> {
	const now = options.now ?? Date.now();
	const day = utcAskDay(now);
	const subject = resolveAskQuotaSubject(options.request, options.user);
	const seed = emptyAskQuotaState({
		day,
		subjectKind: subject.subjectKind,
		subjectKey: subject.subjectKey,
	});
	const docId = askQuotaDocId(day, subject.subjectKey);
	const state = await readState(docId, seed);
	const priorUsed = await priorAnonUsedForSignedIn({
		request: options.request,
		signedIn: subject.signedIn,
		day,
	});
	const viewOpts = {
		priorUsed,
		needsEmailVerification: subject.needsEmailVerification,
	};
	if (state.day !== day) {
		return toAskQuotaView(seed, viewOpts);
	}
	return toAskQuotaView(state, viewOpts);
}

/**
 * Consume one Ask if remaining. Uses a transaction when Firestore is available.
 */
export async function consumeAskQuota(options: {
	request: Request;
	user: UserRecord | null;
	now?: number;
}): Promise<{ allowed: boolean; view: AskQuotaView }> {
	const now = options.now ?? Date.now();
	const day = utcAskDay(now);
	const subject = resolveAskQuotaSubject(options.request, options.user);
	const seed = emptyAskQuotaState({
		day,
		subjectKind: subject.subjectKind,
		subjectKey: subject.subjectKey,
	});
	const docId = askQuotaDocId(day, subject.subjectKey);
	const priorUsed = await priorAnonUsedForSignedIn({
		request: options.request,
		signedIn: subject.signedIn,
		day,
	});
	const viewOpts = {
		priorUsed,
		needsEmailVerification: subject.needsEmailVerification,
	};

	if (isFirebaseInitialized && db) {
		const result = await db.runTransaction(async (tx) => {
			const ref = db!.collection(COLLECTION).doc(docId);
			const snap = await tx.get(ref);
			const current = snap.exists
				? fromDoc(snap.data() as Record<string, unknown>, seed)
				: seed;
			const normalized = current.day === day ? current : seed;
			const before = toAskQuotaView(normalized, viewOpts);
			if (!before.allowed) {
				return { allowed: false, view: before, state: normalized };
			}
			const consumed = consumeAskQuotaState(normalized, viewOpts);
			tx.set(
				ref,
				{
					...consumed.state,
					updatedAt: FieldValue.serverTimestamp(),
				},
				{ merge: true },
			);
			return { allowed: true, view: consumed.view, state: consumed.state };
		});
		memory.set(docId, cloneState(result.state));
		return { allowed: result.allowed, view: result.view };
	}

	const current = memory.get(docId);
	const normalized =
		current && current.day === day ? cloneState(current) : cloneState(seed);
	const before = toAskQuotaView(normalized, viewOpts);
	if (!before.allowed) return { allowed: false, view: before };
	const consumed = consumeAskQuotaState(normalized, viewOpts);
	memory.set(docId, consumed.state);
	return { allowed: true, view: consumed.view };
}

export async function claimAskFeedbackBonus(options: {
	request: Request;
	user: UserRecord;
	now?: number;
}): Promise<{ granted: boolean; view: AskQuotaView }> {
	const now = options.now ?? Date.now();
	const day = utcAskDay(now);
	const subject = resolveAskQuotaSubject(options.request, options.user);
	if (!subject.signedIn) {
		const view = await getAskQuotaView({
			request: options.request,
			user: options.user,
			now,
		});
		return { granted: false, view };
	}
	const seed = emptyAskQuotaState({
		day,
		subjectKind: subject.subjectKind,
		subjectKey: subject.subjectKey,
	});
	const docId = askQuotaDocId(day, subject.subjectKey);
	const priorUsed = await priorAnonUsedForSignedIn({
		request: options.request,
		signedIn: true,
		day,
	});

	if (isFirebaseInitialized && db) {
		const result = await db.runTransaction(async (tx) => {
			const ref = db!.collection(COLLECTION).doc(docId);
			const snap = await tx.get(ref);
			const current = snap.exists
				? fromDoc(snap.data() as Record<string, unknown>, seed)
				: seed;
			const normalized = current.day === day ? current : seed;
			const applied = applyAskFeedbackBonus(normalized);
			if (applied.granted) {
				tx.set(
					ref,
					{
						...applied.state,
						updatedAt: FieldValue.serverTimestamp(),
					},
					{ merge: true },
				);
			}
			return {
				granted: applied.granted,
				state: applied.state,
				view: toAskQuotaView(applied.state, { priorUsed }),
			};
		});
		memory.set(docId, cloneState(result.state));
		return { granted: result.granted, view: result.view };
	}

	const current = memory.get(docId);
	const normalized =
		current && current.day === day ? cloneState(current) : cloneState(seed);
	const applied = applyAskFeedbackBonus(normalized);
	if (applied.granted) memory.set(docId, applied.state);
	return {
		granted: applied.granted,
		view: toAskQuotaView(applied.state, { priorUsed }),
	};
}

export async function dismissAskFeedbackOffer(options: {
	request: Request;
	user: UserRecord;
	now?: number;
}): Promise<AskQuotaView> {
	const now = options.now ?? Date.now();
	const day = utcAskDay(now);
	const subject = resolveAskQuotaSubject(options.request, options.user);
	const seed = emptyAskQuotaState({
		day,
		subjectKind: subject.subjectKind,
		subjectKey: subject.subjectKey,
	});
	const docId = askQuotaDocId(day, subject.subjectKey);
	const current = await readState(docId, seed);
	const normalized = current.day === day ? current : seed;
	const next = dismissAskFeedbackPrompt(normalized);
	await writeState(docId, next);
	const priorUsed = await priorAnonUsedForSignedIn({
		request: options.request,
		signedIn: true,
		day,
	});
	return toAskQuotaView(next, { priorUsed });
}

export function resetAskQuotaMemoryForTests(): void {
	memory.clear();
}
