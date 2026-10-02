export const prerender = false;
import type { APIRoute } from "astro";
import { verifyUser } from "../../../middleware/auth";
import { db } from "../../../service/firebase/server";
import { loadHighlightDocs } from "../../../service/highlightStore";
import { isSlugFullyRead } from "../../../utils/readPages";
import { normalizeDiscourseSlug } from "../../../utils/reviewRoomStats";

type PagesMap = Record<string, unknown>;

function pagesFromDoc(data: { pages?: unknown } | undefined): PagesMap {
	const pages = data?.pages;
	if (!pages || typeof pages !== "object") return {};
	return pages as PagesMap;
}

function json(body: unknown, status = 200): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: {
			"Content-Type": "application/json",
			"Cache-Control": "private, no-store",
		},
	});
}

const signedOut = {
	signedIn: false as const,
	hasRead: false,
	isSaved: false,
	isInReadLater: false,
	highlights: null,
	legacyHighlights: [],
};

export const GET: APIRoute = async ({ cookies, url }) => {
	const sessionCookie = cookies.get("__session")?.value;
	if (!sessionCookie) {
		return json(signedOut);
	}

	const user = await verifyUser(sessionCookie, { cookies });
	if (!user) {
		return json(signedOut);
	}

	const slug = normalizeDiscourseSlug(url.searchParams.get("slug") || "");
	const highlightSlug = (url.searchParams.get("highlightSlug") || "").split(
		"?",
	)[0];

	const extras = {
		hasRead: false,
		isSaved: false,
		isInReadLater: false,
		highlights: null as Record<string, unknown> | null,
		legacyHighlights: [] as Record<string, unknown>[],
	};

	if (db) {
		const userRef = db.collection("users").doc(user.uid);
		const jobs: Promise<void>[] = [];

		if (slug) {
			jobs.push(
				userRef
					.collection("read")
					.doc("pages")
					.get()
					.then((doc) => {
						extras.hasRead = isSlugFullyRead(
							pagesFromDoc(doc.data()),
							slug,
						);
					})
					.catch(() => {}),
			);
			jobs.push(
				userRef
					.collection("saves")
					.doc("pages")
					.get()
					.then((doc) => {
						extras.isSaved = Boolean(doc.data()?.pages?.[slug]);
					})
					.catch(() => {}),
			);
			jobs.push(
				userRef
					.collection("readLater")
					.doc("pages")
					.get()
					.then((doc) => {
						extras.isInReadLater = Boolean(
							doc.data()?.pages?.[slug],
						);
					})
					.catch(() => {}),
			);
		}

		if (highlightSlug) {
			jobs.push(
				userRef
					.get()
					.then(async (userDoc) => {
						const noteId = userDoc.data()?.defaultNoteId;
						if (!noteId || !db) return;
						const lookup = await loadHighlightDocs(
							db,
							noteId,
							highlightSlug,
						);
						extras.highlights = lookup.highlights;
						extras.legacyHighlights = lookup.legacyHighlights;
					})
					.catch(() => {}),
			);
		}

		await Promise.all(jobs);
	}

	return json({
		signedIn: true,
		user: {
			displayName: user.displayName || user.email || "User",
			email: user.email || null,
			emailVerified: user.emailVerified === true,
		},
		...extras,
	});
};
