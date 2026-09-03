import { FieldValue } from "firebase-admin/firestore";
import type { UserRecord } from "firebase-admin/auth";
import { db, isFirebaseInitialized } from "../service/firebase/server";
import {
	countLearningDays,
	mergeLearningDays,
	sanitizeDaysMap,
	toLearningSummary,
	type LearningActivitySummary,
} from "./learningActivity";

const DOC_PATH = ["activity", "summary"] as const;

function summaryRef(uid: string) {
	return db!
		.collection("users")
		.doc(uid)
		.collection(DOC_PATH[0])
		.doc(DOC_PATH[1]);
}

export async function loadUserLearningActivity(
	user: UserRecord,
): Promise<LearningActivitySummary> {
	if (!isFirebaseInitialized || !db) {
		return { days: {}, dayCount: 0 };
	}
	const snap = await summaryRef(user.uid).get();
	if (!snap.exists) return { days: {}, dayCount: 0 };
	const days = sanitizeDaysMap(
		(snap.data() as { days?: unknown } | undefined)?.days,
	);
	return toLearningSummary(days);
}

/**
 * Union local day keys into the user's activity summary.
 * One read + one write. Safe to call with a full local buffer on sign-in.
 */
export async function mergeUserLearningActivity(
	user: UserRecord,
	localDays: Record<string, true> | readonly string[],
): Promise<LearningActivitySummary> {
	const incoming = Array.isArray(localDays)
		? sanitizeDaysMap(
				Object.fromEntries(localDays.map((day) => [day, true])),
			)
		: sanitizeDaysMap(localDays);

	if (!isFirebaseInitialized || !db) {
		return toLearningSummary(incoming);
	}

	const ref = summaryRef(user.uid);
	const snap = await ref.get();
	const remote = snap.exists
		? sanitizeDaysMap((snap.data() as { days?: unknown }).days)
		: {};
	const days = mergeLearningDays(remote, incoming);
	const dayCount = countLearningDays(days);

	await ref.set(
		{
			days,
			dayCount,
			updatedAt: FieldValue.serverTimestamp(),
		},
		{ merge: true },
	);

	return { days, dayCount };
}
