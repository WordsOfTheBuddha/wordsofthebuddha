import { FieldValue } from "firebase-admin/firestore";
import type { UserRecord } from "firebase-admin/auth";
import { db, isFirebaseInitialized } from "../service/firebase/server";
import {
	AI_ASK_SESSION_LIMIT,
	askHistoryFirestoreBytes,
	ASK_HISTORY_FIRESTORE_TARGET_BYTES,
	isAskHistoryDocumentSizeError,
	isResearchHistoryEntry,
	mergeAskHistoryEntries,
	removeAskHistoryEntriesByJobIds,
	removeAskHistoryEntriesByQuestions,
	sanitizeAskHistoryEntries,
	sanitizeAskHistoryEntry,
	slimAskHistoryEntriesForSync,
	slimAskHistoryEntryForSync,
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

async function writeHistoryEntries(
	uid: string,
	entries: readonly AiAskSessionEntry[],
): Promise<AiAskSessionEntry[]> {
	const slim = slimAskHistoryEntriesForSync(entries);
	if (!isFirebaseInitialized || !db) return slim;
	const ref = historyRef(uid);
	const payload = {
		entries: slim,
		updatedAt: FieldValue.serverTimestamp(),
	};
	try {
		// Replace the whole doc so an already-oversized `entries` array can shrink.
		await ref.set(payload);
		return slim;
	} catch (error) {
		if (!isAskHistoryDocumentSizeError(error)) throw error;
		const tighter = entries
			.map((entry) => slimAskHistoryEntryForSync(entry, 2))
			.filter((entry): entry is AiAskSessionEntry => Boolean(entry));
		const retry = slimAskHistoryEntriesForSync(tighter);
		console.warn(
			"[ai/history] document too large; retrying with slimmer entries",
			askHistoryFirestoreBytes(slim),
			"→",
			askHistoryFirestoreBytes(retry),
		);
		try {
			await ref.set({
				entries: retry,
				updatedAt: FieldValue.serverTimestamp(),
			});
			return retry;
		} catch (retryError) {
			if (isAskHistoryDocumentSizeError(retryError)) {
				console.warn(
					"[ai/history] document still too large after slim",
					retryError instanceof Error ? retryError.message : retryError,
				);
			}
			throw retryError;
		}
	}
}

export async function loadUserAskHistory(
	user: UserRecord,
): Promise<AiAskSessionEntry[]> {
	if (!isFirebaseInitialized || !db) return [];
	const snap = await historyRef(user.uid).get();
	if (!snap.exists) return [];
	const data = snap.data() as { entries?: unknown };
	const current = sanitizeAskHistoryEntries(data.entries);
	const slim = slimAskHistoryEntriesForSync(current);
	if (
		askHistoryFirestoreBytes(current) > ASK_HISTORY_FIRESTORE_TARGET_BYTES
	) {
		try {
			await writeHistoryEntries(user.uid, slim);
		} catch (error) {
			console.warn(
				"[ai/history] could not trim oversized document",
				error instanceof Error ? error.message : error,
			);
		}
	}
	return slim;
}

export async function upsertUserAskHistoryEntry(
	user: UserRecord,
	entry: AiAskSessionEntry,
	replaceQuestions: readonly string[] = [],
	replaceJobIds: readonly string[] = [],
): Promise<AiAskSessionEntry[]> {
	const clean = sanitizeAskHistoryEntry(entry);
	if (!clean) {
		return loadUserAskHistory(user);
	}
	if (!isFirebaseInitialized || !db) {
		return slimAskHistoryEntriesForSync([clean]);
	}
	const ref = historyRef(user.uid);
	const snap = await ref.get();
	const current = snap.exists
		? sanitizeAskHistoryEntries((snap.data() as { entries?: unknown }).entries)
		: [];
	const pruned = removeAskHistoryEntriesByQuestions(current, replaceQuestions, {
		research: isResearchHistoryEntry(clean),
	});
	const byJobs =
		replaceJobIds.length > 0
			? removeAskHistoryEntriesByJobIds(pruned, replaceJobIds)
			: pruned;
	const entries = upsertAiAskSessionEntry(byJobs, clean);
	return writeHistoryEntries(user.uid, entries);
}

export async function replaceUserAskHistory(
	user: UserRecord,
	entries: readonly AiAskSessionEntry[],
): Promise<AiAskSessionEntry[]> {
	const next = sanitizeAskHistoryEntries(entries, AI_ASK_SESSION_LIMIT);
	if (!isFirebaseInitialized || !db) {
		return slimAskHistoryEntriesForSync(next);
	}
	return writeHistoryEntries(user.uid, next);
}

export async function syncUserAskHistory(
	user: UserRecord,
	localEntries: readonly AiAskSessionEntry[],
): Promise<AiAskSessionEntry[]> {
	const remote = await loadUserAskHistory(user);
	const merged = mergeAskHistoryEntries(localEntries, remote);
	return replaceUserAskHistory(user, merged);
}

export async function removeUserAskHistoryByQuestions(
	user: UserRecord,
	questions: readonly string[],
	options?: { research?: boolean },
): Promise<AiAskSessionEntry[]> {
	const current = await loadUserAskHistory(user);
	const next = removeAskHistoryEntriesByQuestions(current, questions, options);
	return replaceUserAskHistory(user, next);
}

export async function removeUserAskHistoryByJobIds(
	user: UserRecord,
	jobIds: readonly string[],
): Promise<AiAskSessionEntry[]> {
	const current = await loadUserAskHistory(user);
	const next = removeAskHistoryEntriesByJobIds(current, jobIds);
	return replaceUserAskHistory(user, next);
}
