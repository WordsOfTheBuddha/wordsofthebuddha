import { FieldValue } from "firebase-admin/firestore";
import type { UserRecord } from "firebase-admin/auth";
import { db, isFirebaseInitialized } from "../service/firebase/server";
import {
	mergeListenBySlug,
	mergeListenSecondsByDay,
	sanitizeBySlug,
	sanitizeSecondsByDay,
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
		return { bySlug: {}, secondsByDay: {}, totalSeconds: 0 };
	}
	const snap = await listenRef(user.uid).get();
	if (!snap.exists) return { bySlug: {}, secondsByDay: {}, totalSeconds: 0 };
	const data = snap.data() as {
		bySlug?: unknown;
		secondsByDay?: unknown;
		totalSeconds?: unknown;
	};
	const bySlug = sanitizeBySlug(data.bySlug);
	const secondsByDay = sanitizeSecondsByDay(data.secondsByDay);
	const totalSeconds = Math.max(
		sumListenSeconds(bySlug),
		typeof data.totalSeconds === "number" ? Math.floor(data.totalSeconds) : 0,
	);
	return { bySlug, secondsByDay, totalSeconds };
}

/**
 * Union local per-slug seconds into the user's listen summary (max per slug).
 * One read + one write.
 */
export async function mergeUserListenActivity(
	user: UserRecord,
	localBySlug: Record<string, number>,
	localSecondsByDay: Record<string, number> = {},
): Promise<ListenActivitySummary> {
	const incoming = sanitizeBySlug(localBySlug);
	const incomingDays = sanitizeSecondsByDay(localSecondsByDay);

	if (!isFirebaseInitialized || !db) {
		return toListenSummary(incoming, incomingDays);
	}

	const ref = listenRef(user.uid);
	const snap = await ref.get();
	const remote = snap.exists
		? sanitizeBySlug((snap.data() as { bySlug?: unknown }).bySlug)
		: {};
	const remoteDays = snap.exists
		? sanitizeSecondsByDay(
				(snap.data() as { secondsByDay?: unknown }).secondsByDay,
			)
		: {};
	const bySlug = mergeListenBySlug(remote, incoming);
	const secondsByDay = mergeListenSecondsByDay(remoteDays, incomingDays);
	const totalSeconds = sumListenSeconds(bySlug);

	await ref.set(
		{
			bySlug,
			secondsByDay,
			totalSeconds,
			updatedAt: FieldValue.serverTimestamp(),
		},
		{ merge: true },
	);

	return { bySlug, secondsByDay, totalSeconds };
}
