import { FieldValue } from "firebase-admin/firestore";
import type { UserRecord } from "firebase-admin/auth";
import { db, isFirebaseInitialized } from "../service/firebase/server";
import {
	AI_ASK_SESSION_LIMIT,
	mergeAskHistoryEntries,
	removeAskHistoryEntriesByQuestions,
	sanitizeAskHistoryEntries,
	sanitizeAskHistoryEntry,
	upsertAiAskSessionEntry,
	type AiAskSessionEntry,
} from "./aiAskSession";

const DOC_PATH = ["askHistory", "entries"] as const;

function historyRef(uid: string) {
	return db!
		.collection("users")
		.doc(uid)
		.collection(DOC_PATH[0])
		.doc(DOC_PATH[1]);
}

export async function loadUserAskHistory(
	user: UserRecord,
): Promise<AiAskSessionEntry[]> {
	if (!isFirebaseInitialized || !db) return [];
	const snap = await historyRef(user.uid).get();
	if (!snap.exists) return [];
	const data = snap.data() as { entries?: unknown };
	return sanitizeAskHistoryEntries(data.entries);
}

export async function upsertUserAskHistoryEntry(
	user: UserRecord,
	entry: AiAskSessionEntry,
	replaceQuestions: readonly string[] = [],
): Promise<AiAskSessionEntry[]> {
	const clean = sanitizeAskHistoryEntry(entry);
	if (!clean) {
		return loadUserAskHistory(user);
	}
	if (!isFirebaseInitialized || !db) {
		return [clean];
	}
	const ref = historyRef(user.uid);
	const snap = await ref.get();
	const current = snap.exists
		? sanitizeAskHistoryEntries((snap.data() as { entries?: unknown }).entries)
		: [];
	const pruned = removeAskHistoryEntriesByQuestions(current, replaceQuestions);
	const entries = upsertAiAskSessionEntry(pruned, clean);
	await ref.set(
		{
			entries,
			updatedAt: FieldValue.serverTimestamp(),
		},
		{ merge: true },
	);
	return entries;
}

export async function replaceUserAskHistory(
	user: UserRecord,
	entries: readonly AiAskSessionEntry[],
): Promise<AiAskSessionEntry[]> {
	const next = sanitizeAskHistoryEntries(entries, AI_ASK_SESSION_LIMIT);
	if (!isFirebaseInitialized || !db) return next;
	await historyRef(user.uid).set(
		{
			entries: next,
			updatedAt: FieldValue.serverTimestamp(),
		},
		{ merge: true },
	);
	return next;
}

export async function syncUserAskHistory(
	user: UserRecord,
	localEntries: readonly AiAskSessionEntry[],
): Promise<AiAskSessionEntry[]> {
	const remote = await loadUserAskHistory(user);
	const merged = mergeAskHistoryEntries(localEntries, remote);
	return replaceUserAskHistory(user, merged);
}
