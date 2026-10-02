import type { Firestore } from "firebase-admin/firestore";
import {
	legacyHighlightSlugs,
	normalizeHighlightSlug,
} from "../utils/highlightSlug";

export interface HighlightLookup {
	highlights: Record<string, unknown> | null;
	/** Pre-v3 per-view documents, only returned when no canonical doc exists. */
	legacyHighlights: Record<string, unknown>[];
}

function highlightsCollection(db: Firestore, noteId: string) {
	return db.collection("notes").doc(noteId).collection("highlights");
}

export async function loadHighlightDocs(
	db: Firestore,
	noteId: string,
	slug: string,
): Promise<HighlightLookup> {
	const col = highlightsCollection(db, noteId);
	const canonicalId = normalizeHighlightSlug(slug);
	const refs = [canonicalId, ...legacyHighlightSlugs(slug)].map((id) =>
		col.doc(id),
	);
	const [canonical, ...legacy] = await db.getAll(...refs);
	if (canonical?.exists) {
		return {
			highlights: (canonical.data() as Record<string, unknown>) ?? null,
			legacyHighlights: [],
		};
	}
	return {
		highlights: null,
		legacyHighlights: legacy
			.filter((doc) => doc.exists)
			.map((doc) => doc.data() as Record<string, unknown>),
	};
}

/** Remove the page's highlights, including old per-view copies that would otherwise resurface. */
export async function deleteHighlightDocs(
	db: Firestore,
	noteId: string,
	slug: string,
): Promise<void> {
	const col = highlightsCollection(db, noteId);
	const batch = db.batch();
	for (const id of [normalizeHighlightSlug(slug), ...legacyHighlightSlugs(slug)]) {
		batch.delete(col.doc(id));
	}
	await batch.commit();
}
