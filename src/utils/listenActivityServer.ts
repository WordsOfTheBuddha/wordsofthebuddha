import { FieldValue } from "firebase-admin/firestore";
import type { UserRecord } from "firebase-admin/auth";
import { db, isFirebaseInitialized } from "../service/firebase/server";
import {
	mergeListenBySlug,
	sanitizeBySlug,
	sumListenSeconds,
	toListenSummary,
	type ListenActivitySummary,
} from "./listenActivity";

function listenRef(uid: string) {
	return db!.collection("users").doc(uid).collection("activity").doc("listen");
}

export async function loadUserListenActivity(
	user: UserRecord,
): Promise<ListenActivitySummary> {
	if (!isFirebaseInitialized || !db) {
		return { bySlug: {}, totalSeconds: 0 };
	}
	const snap = await listenRef(user.uid).get();
	if (!snap.exists) return { bySlug: {}, totalSeconds: 0 };
	const data = snap.data() as {
		bySlug?: unknown;
		totalSeconds?: unknown;
	};
	const bySlug = sanitizeBySlug(data.bySlug);
	const totalSeconds = Math.max(
		sumListenSeconds(bySlug),
		typeof data.totalSeconds === "number" ? Math.floor(data.totalSeconds) : 0,
	);
	return { bySlug, totalSeconds };
}

/**
 * Union local per-slug seconds into the user's listen summary (max per slug).
 * One read + one write.
 */
export async function mergeUserListenActivity(
	user: UserRecord,
	localBySlug: Record<string, number>,
): Promise<ListenActivitySummary> {
	const incoming = sanitizeBySlug(localBySlug);

	if (!isFirebaseInitialized || !db) {
		return toListenSummary(incoming);
	}

	const ref = listenRef(user.uid);
	const snap = await ref.get();
	const remote = snap.exists
		? sanitizeBySlug((snap.data() as { bySlug?: unknown }).bySlug)
		: {};
	const bySlug = mergeListenBySlug(remote, incoming);
	const totalSeconds = sumListenSeconds(bySlug);

	await ref.set(
		{
			bySlug,
			totalSeconds,
			updatedAt: FieldValue.serverTimestamp(),
		},
		{ merge: true },
	);

	return { bySlug, totalSeconds };
}
