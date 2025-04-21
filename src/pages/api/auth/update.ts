export const prerender = false;
import type { APIRoute } from "astro";
import { getAuth } from "firebase-admin/auth";
import { app } from "../../../service/firebase/server";
import { clearUserCache } from "../../../middleware/auth";

export const POST: APIRoute = async ({ request, cookies }) => {
	const auth = getAuth(app);

	const sessionCookie = cookies.get("__session")?.value;
	if (!sessionCookie) {
		return new Response("Unauthorized", { status: 401 });
	}

	let formData;
	try {
		formData = await request.formData();
		const data = Object.fromEntries(formData.entries());

		const displayName = data.displayName?.toString();
		const email = data.email?.toString();
        console.log('received display name: ', displayName);

		if (!displayName || !email) {
			return new Response("Missing required fields", { status: 400 });
		}

		const decodedCookie = await auth.verifySessionCookie(sessionCookie);
		const uid = decodedCookie.uid;

		// Update user profile
		await auth.updateUser(uid, {
			displayName,
			email,
		});

		// Clear the user's cache entry to ensure fresh data on next request
		clearUserCache(uid);

		return new Response(
			JSON.stringify({
				success: true,
				user: { displayName, email },
			}),
			{
				status: 200,
				headers: { "Content-Type": "application/json" },
			}
		);
	} catch (error: any) {
		return new Response(error.message || "Something went wrong", {
			status: 400,
		});
	}
};
