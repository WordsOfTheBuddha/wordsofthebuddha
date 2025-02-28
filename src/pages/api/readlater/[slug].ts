export const prerender = false;
import type { APIRoute } from "astro";
import { db } from "../../../service/firebase/server";
import { verifyUser } from "../../../middleware/auth";

export const GET: APIRoute = async ({ params, cookies }) => {
	const slug = params.slug;
	let userId = null;
	let isInReadLater = false;

	if (!slug) {
		return new Response(
			JSON.stringify({ error: "Slug parameter is required" }),
			{
				status: 400,
				headers: { "Content-Type": "application/json" },
			}
		);
	}

	try {
		if (cookies.has("__session")) {
			try {
				const sessionCookie = cookies.get("__session")?.value;
				const user = await verifyUser(sessionCookie);
				userId = user.uid;

				// Check if the content is in read later
				const docRef = await db
					.collection("users")
					.doc(userId)
					.collection("readLater")
					.doc(slug)
					.get();

				isInReadLater = docRef.exists;
			} catch (error) {
				console.error("Session verification failed:", error);
				// Continue with userId = null (unauthenticated state)
			}
		}

		return new Response(
			JSON.stringify({
				isInReadLater,
				isAuthenticated: Boolean(userId),
			}),
			{
				status: 200,
				headers: { "Content-Type": "application/json" },
			}
		);
	} catch (error) {
		console.error("Error checking read later status:", error);
		return new Response(
			JSON.stringify({ error: "Failed to check read later status" }),
			{ status: 500, headers: { "Content-Type": "application/json" } }
		);
	}
};

export const POST: APIRoute = async ({ params, request, cookies }) => {
	try {
		const slug = params.slug;
		if (!slug) {
			return new Response(
				JSON.stringify({ error: "Slug parameter is required" }),
				{
					status: 400,
					headers: { "Content-Type": "application/json" },
				}
			);
		}

		const sessionCookie = cookies.get("__session")?.value;
		if (!sessionCookie) {
			return new Response(JSON.stringify({ error: "Unauthorized" }), {
				status: 401,
				headers: { "Content-Type": "application/json" },
			});
		}

		// Use centralized auth verification
		const user = await verifyUser(sessionCookie);
		const { isActive } = await request.json();

		const readLaterRef = db
			.collection("users")
			.doc(user.uid)
			.collection("readLater")
			.doc(slug);

		if (isActive) {
			await readLaterRef.set({
				addedAt: new Date(),
			});
		} else {
			await readLaterRef.delete();
		}

		return new Response(JSON.stringify({ success: true }), {
			status: 200,
			headers: { "Content-Type": "application/json" },
		});
	} catch (error) {
		console.error("Error:", error);
		if (
			error instanceof Error &&
			(error.message === "No session" ||
				error.message === "User not found")
		) {
			return new Response(JSON.stringify({ error: "Unauthorized" }), {
				status: 401,
				headers: { "Content-Type": "application/json" },
			});
		}
		return new Response(
			JSON.stringify({ error: "Internal server error" }),
			{
				status: 500,
				headers: { "Content-Type": "application/json" },
			}
		);
	}
};
