export const prerender = false;
import type { APIRoute } from "astro";
import { db } from "../../../service/firebase/server";
import { verifyUser } from "../../../middleware/auth";
import { normalizeDiscourseSlug } from "../../../utils/reviewRoomStats";
import {
	isSlugFullyRead,
	markReadPages,
	unmarkReadPages,
} from "../../../utils/readPages";

type PagesMap = Record<string, unknown>;

function pagesFromDoc(data: { pages?: unknown } | undefined): PagesMap {
	const pages = data?.pages;
	if (!pages || typeof pages !== "object") return {};
	return pages as PagesMap;
}

export const GET: APIRoute = async ({ params, cookies }) => {
	const sessionCookie = cookies.get("__session")?.value;
	let isAuthenticated = false;
	let hasRead = false;
	const slug = normalizeDiscourseSlug(params.slug || "");

	try {
		if (sessionCookie) {
			const decodedCookie = await verifyUser(sessionCookie, { cookies });

			if (decodedCookie) {
				isAuthenticated = true;

				const readDoc = await db
					.collection("users")
					.doc(decodedCookie.uid)
					.collection("read")
					.doc("pages")
					.get();

				if (readDoc.exists && slug) {
					hasRead = isSlugFullyRead(pagesFromDoc(readDoc.data()), slug);
				}
			}
		}
	} catch (error) {
		console.error("Error verifying session:", error);
	}

	return new Response(
		JSON.stringify({
			isAuthenticated,
			hasRead,
		}),
		{
			status: 200,
			headers: {
				"Content-Type": "application/json",
			},
		},
	);
};

export const POST: APIRoute = async ({ params, cookies, request }) => {
	const slug = normalizeDiscourseSlug(params.slug || "");
	if (!slug) {
		return new Response(JSON.stringify({ error: "Slug is required" }), {
			status: 400,
		});
	}

	const sessionCookie = cookies.get("__session")?.value;
	if (!sessionCookie) {
		return new Response(
			JSON.stringify({ error: "Authentication required" }),
			{
				status: 401,
			},
		);
	}

	let userId: string;
	try {
		const decodedCookie = await verifyUser(sessionCookie, { cookies });
		if (!decodedCookie) {
			throw new Error("Invalid session");
		}
		userId = decodedCookie.uid;
	} catch {
		return new Response(JSON.stringify({ error: "Invalid session" }), {
			status: 401,
		});
	}

	try {
		const body = await request.json();
		const isRead = body.isRead === true;

		const readRef = db
			.collection("users")
			.doc(userId)
			.collection("read")
			.doc("pages");

		const snap = await readRef.get();
		const existing = pagesFromDoc(snap.data());

		if (isRead) {
			const next = markReadPages(
				existing,
				slug,
				Math.floor(Date.now() / 60000),
			);
			await readRef.set({ pages: next });
		} else if (snap.exists) {
			await readRef.set({ pages: unmarkReadPages(existing, slug) });
		}

		return new Response(
			JSON.stringify({
				success: true,
				hasRead: isRead,
			}),
			{
				status: 200,
				headers: {
					"Content-Type": "application/json",
				},
			},
		);
	} catch (error) {
		console.error("Error updating read status:", error);
		return new Response(
			JSON.stringify({
				error: "Failed to update read status",
			}),
			{
				status: 500,
				headers: {
					"Content-Type": "application/json",
				},
			},
		);
	}
};
