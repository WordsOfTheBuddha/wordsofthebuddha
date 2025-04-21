export const prerender = false;
import type { APIRoute } from "astro";
import { db } from "../../../service/firebase/server";
import { verifyUser } from "../../../middleware/auth";
import { FieldValue } from "firebase-admin/firestore"; // Import FieldValue

export const GET: APIRoute = async ({ params, cookies }) => {
	const slug = params.slug;
	let userId = null;
	let isSaved = false;

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

				// Check if the content is in the saves pages map
				const docRef = await db
					.collection("users")
					.doc(userId)
					.collection("saves")
					.doc("pages") // Fetch the single 'pages' document
					.get();

				if (docRef.exists) {
					const data = docRef.data();
					isSaved = Boolean(data?.pages?.[slug]); // Check if slug exists in the map
				}
			} catch (error) {
				console.error("Session verification failed:", error);
				// Continue with userId = null (unauthenticated state)
			}
		}

		return new Response(
			JSON.stringify({
				isSaved,
				isAuthenticated: Boolean(userId),
			}),
			{
				status: 200,
				headers: { "Content-Type": "application/json" },
			}
		);
	} catch (error) {
		console.error("Error checking saved status:", error);
		return new Response(
			JSON.stringify({ error: "Failed to check saved status" }),
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

		const saveRef = db
			.collection("users")
			.doc(user.uid)
			.collection("saves")
				.doc("pages"); // Reference the single 'pages' document

		if (isActive) {
			// Add/update the slug in the pages map with timestamp (minute precision)
			await saveRef.set(
				{
					pages: {
						[slug]: Math.floor(Date.now() / 60000), // Timestamp in minutes
					},
				},
				{ merge: true }
			);
		} else {
			// Remove the slug from the pages map using FieldValue.delete()
			await saveRef.update({
				[`pages.${slug}`]: FieldValue.delete(),
			});
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
