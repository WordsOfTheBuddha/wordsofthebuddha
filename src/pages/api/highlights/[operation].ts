import type { APIRoute } from "astro";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { db } from "../../../service/firebase/server";
import type { Highlight } from "../../../types/notes";
import { verifyUser } from "../../../middleware/auth";

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

function normalizeSlug(slug: string): string {
	return slug === "/" ? "/home" : slug;
}

export const GET: APIRoute = async ({ request, cookies }) => {
	const opId = generateOpId();
	console.log(`[${opId}] GET highlights request started`);

	try {
		const url = new URL(request.url);
		const slug = url.searchParams.get("slug");

		if (!slug) {
			throw new Error("Slug parameter is required");
		}

		const normalizedSlug = normalizeSlug(slug);
		console.log(
			`[${opId}] Using normalized slug: ${normalizedSlug} (original: ${slug})`,
		);

		const sessionCookie = cookies.get("__session")?.value;
		if (!sessionCookie) throw new Error("No session");

		const user = await verifyUser(sessionCookie, { cookies });
		if (!user) throw new Error("Invalid session");

		const noteId = await getUserNoteId(user.uid);

		console.log(`[${opId}] Fetching highlights for slug: ${slug}`);
		const highlightDoc = await db
			.collection("notes")
			.doc(noteId)
			.collection("highlights")
			.doc(normalizedSlug)
			.get();

		console.log(
			`[${opId}] Highlights fetch completed. Found: ${highlightDoc.exists}`,
		);
		return new Response(
			JSON.stringify({
				highlights: highlightDoc.exists ? highlightDoc.data() : null,
				opId,
			}),
		);
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
	console.log(`[${opId}] POST ${operation} operation started`);

	try {
		const sessionCookie = cookies.get("__session")?.value;
		if (!sessionCookie) throw new Error("No session");

		const user = await verifyUser(sessionCookie, { cookies });
		if (!user) throw new Error("Invalid session");

		const noteId = await getUserNoteId(user.uid);
		const { highlights, slug } = await request.json();
		if (!slug) {
			throw new Error("Slug is required");
		}

		const normalizedSlug = normalizeSlug(slug);
		console.log(
			`[${opId}] Using normalized slug: ${normalizedSlug} (original: ${slug})`,
		);

		const highlightRef = db
			.collection("notes")
			.doc(noteId)
			.collection("highlights")
			.doc(normalizedSlug);

		if (operation === "add") {
			console.log(
				`[${opId}] Adding/updating highlights for slug: ${slug}`,
			);
			await highlightRef.set(
				{
					rangyHash: highlights.rangyHash,
					highlightSegments: highlights.highlightSegments,
					updatedAt: new Date(),
					title: highlights.title,
					description: highlights.description,
					slug: highlights.slug,
				},
				{ merge: true },
			); // Use merge to preserve any existing fields
		} else if (operation === "delete") {
			console.log(`[${opId}] Deleting highlight doc for slug: ${slug}`);
			await highlightRef.delete();
		}

		console.log(`[${opId}] Operation completed successfully`);
		return new Response(JSON.stringify({ success: true, opId }));
	} catch (error: any) {
		console.error(`[${opId}] Error in ${operation} operation:`, error);
		return new Response(JSON.stringify({ error: error.message, opId }), {
			status: 401,
		});
	}
};
