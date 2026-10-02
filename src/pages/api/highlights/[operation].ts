import type { APIRoute } from "astro";
import { db } from "../../../service/firebase/server";
import { verifyUser } from "../../../middleware/auth";
import {
	deleteHighlightDocs,
	loadHighlightDocs,
} from "../../../service/highlightStore";
import { normalizeHighlightSlug } from "../../../utils/highlightSlug";
import { sanitizeDiscourseNotes } from "../../../utils/stableHighlight";

export const prerender = false;

async function getUserNoteId(userId: string): Promise<string> {
	const userDoc = await db.collection("users").doc(userId).get();
	const noteId = userDoc.data()?.defaultNoteId;

	if (!noteId) {
		throw new Error("No default note found for user");
	}

	return noteId;
}

function generateOpId(): string {
	return `op-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/** Highlights are stored per pathname; drop any view params an old client sends. */
function pathSlug(slug: string): string {
	return slug.split("?")[0] || "/";
}

export const GET: APIRoute = async ({ request, cookies }) => {
	const opId = generateOpId();

	try {
		const url = new URL(request.url);
		const slug = url.searchParams.get("slug");
		if (!slug) {
			throw new Error("Slug parameter is required");
		}

		const sessionCookie = cookies.get("__session")?.value;
		if (!sessionCookie) throw new Error("No session");

		const user = await verifyUser(sessionCookie, { cookies });
		if (!user) throw new Error("Invalid session");

		const noteId = await getUserNoteId(user.uid);
		const lookup = await loadHighlightDocs(db, noteId, pathSlug(slug));
		return new Response(JSON.stringify({ ...lookup, opId }));
	} catch (error: any) {
		console.error(`[${opId}] Error fetching highlights:`, error);
		return new Response(JSON.stringify({ error: error.message, opId }), {
			status: 401,
		});
	}
};

export const POST: APIRoute = async ({ params, request, cookies }) => {
	const opId = generateOpId();
	const operation = params.operation;

	try {
		const sessionCookie = cookies.get("__session")?.value;
		if (!sessionCookie) throw new Error("No session");

		const user = await verifyUser(sessionCookie, { cookies });
		if (!user) throw new Error("Invalid session");

		const noteId = await getUserNoteId(user.uid);
		const { highlights, slug: rawSlug } = await request.json();
		if (!rawSlug) {
			throw new Error("Slug is required");
		}
		const slug = pathSlug(rawSlug);

		if (operation === "add") {
			const document =
				highlights.highlightDocument &&
				typeof highlights.highlightDocument === "object"
					? { ...highlights.highlightDocument }
					: { version: 3, spans: [] };
			const pageNotes = sanitizeDiscourseNotes(document.notes);
			if (pageNotes.length > 0 && user.emailVerified !== true) {
				const existing = await db
					.collection("notes")
					.doc(noteId)
					.collection("highlights")
					.doc(normalizeHighlightSlug(slug))
					.get();
				const stored = sanitizeDiscourseNotes(
					existing.data()?.highlightDocument?.notes,
				);
				const unchanged =
					pageNotes.length === stored.length &&
					pageNotes.every((note, index) => {
						const previous = stored[index];
						return (
							previous &&
							previous.id === note.id &&
							previous.text === note.text &&
							JSON.stringify(previous.spans) === JSON.stringify(note.spans)
						);
					});
				if (!unchanged) {
					return new Response(
						JSON.stringify({
							error: "Verify your email to save notes",
							opId,
						}),
						{ status: 403 },
					);
				}
			}
			document.notes = pageNotes;
			// Full overwrite: a merge would keep review-room segments of erased highlights.
			await db
				.collection("notes")
				.doc(noteId)
				.collection("highlights")
				.doc(normalizeHighlightSlug(slug))
				.set({
					slug,
					title: highlights.title ?? "",
					description: highlights.description ?? "",
					highlightDocument: document,
					highlightSegments: highlights.highlightSegments ?? {},
					updatedAt: new Date(),
				});
		} else if (operation === "delete") {
			await deleteHighlightDocs(db, noteId, slug);
		}

		return new Response(JSON.stringify({ success: true, opId }));
	} catch (error: any) {
		console.error(`[${opId}] Error in ${operation} operation:`, error);
		return new Response(JSON.stringify({ error: error.message, opId }), {
			status: 401,
		});
	}
};
