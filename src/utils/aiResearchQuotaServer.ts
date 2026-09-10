import { FieldValue } from "firebase-admin/firestore";
import { db, isFirebaseInitialized } from "../service/firebase/server";
import {
	consumeResearchQuotaState,
	emptyResearchQuotaState,
	refundResearchQuotaState,
	researchQuotaDocId,
	toResearchQuotaView,
	utcResearchDay,
	type ResearchQuotaState,
	type ResearchQuotaView,
} from "./aiResearchQuota";

const COLLECTION = "researchQuota";

const memory = new Map<string, ResearchQuotaState>();

function cloneState(state: ResearchQuotaState): ResearchQuotaState {
	return { ...state };
}

function fromDoc(
	data: Record<string, unknown>,
	fallback: ResearchQuotaState,
): ResearchQuotaState {
	return {
		day: typeof data.day === "string" ? data.day : fallback.day,
		uid: typeof data.uid === "string" ? data.uid : fallback.uid,
		used: typeof data.used === "number" ? Math.max(0, Math.floor(data.used)) : 0,
		limit:
			typeof data.limit === "number"
				? Math.max(0, Math.floor(data.limit))
				: fallback.limit,
	};
}

async function readState(
	docId: string,
	seed: ResearchQuotaState,
): Promise<ResearchQuotaState> {
	if (!isFirebaseInitialized || !db) {
		return cloneState(memory.get(docId) || seed);
	}
	const snap = await db.collection(COLLECTION).doc(docId).get();
	if (!snap.exists) return cloneState(seed);
	return fromDoc(snap.data() as Record<string, unknown>, seed);
}

export async function getResearchQuotaView(options: {
	uid: string;
	now?: number;
}): Promise<ResearchQuotaView> {
	const now = options.now ?? Date.now();
	const day = utcResearchDay(now);
	const seed = emptyResearchQuotaState({ day, uid: options.uid });
	const docId = researchQuotaDocId(day, options.uid);
	const state = await readState(docId, seed);
	if (state.day !== day) return toResearchQuotaView(seed);
	return toResearchQuotaView(state);
}

export async function consumeResearchQuota(options: {
	uid: string;
	now?: number;
}): Promise<{ allowed: boolean; view: ResearchQuotaView }> {
	const now = options.now ?? Date.now();
	const day = utcResearchDay(now);
	const seed = emptyResearchQuotaState({ day, uid: options.uid });
	const docId = researchQuotaDocId(day, options.uid);

	if (isFirebaseInitialized && db) {
		const result = await db.runTransaction(async (tx) => {
			const ref = db!.collection(COLLECTION).doc(docId);
			const snap = await tx.get(ref);
			const current = snap.exists
				? fromDoc(snap.data() as Record<string, unknown>, seed)
				: seed;
			const normalized = current.day === day ? current : seed;
			const before = toResearchQuotaView(normalized);
			if (!before.allowed) {
				return { allowed: false, view: before, state: normalized };
			}
			const consumed = consumeResearchQuotaState(normalized);
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
	const before = toResearchQuotaView(normalized);
	if (!before.allowed) return { allowed: false, view: before };
	const consumed = consumeResearchQuotaState(normalized);
	memory.set(docId, consumed.state);
	return { allowed: true, view: consumed.view };
}

export async function refundResearchQuota(options: {
	uid: string;
	now?: number;
	/** UTC day the credit was spent. Defaults to today. */
	day?: string;
}): Promise<ResearchQuotaView> {
	const now = options.now ?? Date.now();
	const day = options.day || utcResearchDay(now);
	const seed = emptyResearchQuotaState({ day, uid: options.uid });
	const docId = researchQuotaDocId(day, options.uid);

	if (isFirebaseInitialized && db) {
		const result = await db.runTransaction(async (tx) => {
			const ref = db!.collection(COLLECTION).doc(docId);
			const snap = await tx.get(ref);
			const current = snap.exists
				? fromDoc(snap.data() as Record<string, unknown>, seed)
				: seed;
			const normalized = current.day === day ? current : seed;
			const refunded = refundResearchQuotaState(normalized);
			tx.set(
				ref,
				{
					...refunded.state,
					updatedAt: FieldValue.serverTimestamp(),
				},
				{ merge: true },
			);
			return refunded;
		});
		memory.set(docId, cloneState(result.state));
		return result.view;
	}

	const current = memory.get(docId);
	const normalized =
		current && current.day === day ? cloneState(current) : cloneState(seed);
	const refunded = refundResearchQuotaState(normalized);
	memory.set(docId, refunded.state);
	return refunded.view;
}

export function resetResearchQuotaMemoryForTests(): void {
	memory.clear();
}
