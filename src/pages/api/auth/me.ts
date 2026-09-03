export const prerender = false;
import type { APIRoute } from "astro";
import { verifyUser } from "../../../middleware/auth";

// Minimal endpoint to reveal auth state for client-side hydration on static pages
export const GET: APIRoute = async ({ cookies, url }) => {
	try {
		const sessionCookie = cookies.get("__session")?.value;
		if (!sessionCookie) {
			return new Response(JSON.stringify({ signedIn: false }), {
				status: 200,
				headers: { "Content-Type": "application/json" },
			});
		}

		const forceRefresh = url.searchParams.get("fresh") === "1";
		const user = await verifyUser(sessionCookie, {
			cookies,
			forceRefresh,
		});
		if (!user) {
			return new Response(JSON.stringify({ signedIn: false }), {
				status: 200,
				headers: { "Content-Type": "application/json" },
			});
		}

		const displayName = user.displayName || user.email || "User";
		const email = user.email || null;
		return new Response(
			JSON.stringify({
				signedIn: true,
				user: {
					displayName,
					email,
					emailVerified: user.emailVerified === true,
				},
			}),
			{ status: 200, headers: { "Content-Type": "application/json" } },
		);
	} catch {
		return new Response(JSON.stringify({ signedIn: false }), {
			status: 200,
			headers: { "Content-Type": "application/json" },
		});
	}
};
