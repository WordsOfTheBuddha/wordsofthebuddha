export const prerender = false;
import type { APIRoute } from "astro";
import { getAuth } from "firebase-admin/auth";
import { verifyUser, clearUserCache } from "../../../middleware/auth";
import { app, isFirebaseInitialized } from "../../../service/firebase/server";
import {
	humanizeFirebaseAuthError,
	sendFirebaseVerificationEmail,
} from "../../../utils/firebaseAuthEmail";

/**
 * Sends Firebase’s verify-email template for the signed-in (unverified) user.
 * Runs entirely on the server so Ask / Review Room don’t depend on a second
 * client Auth session.
 */
export const POST: APIRoute = async ({ request, cookies }) => {
	if (!isFirebaseInitialized || !app) {
		return new Response(
			JSON.stringify({ success: false, error: "Auth unavailable." }),
			{ status: 503, headers: { "Content-Type": "application/json" } },
		);
	}

	const session = cookies.get("__session")?.value;
	const user = await verifyUser(session, { cookies, forceRefresh: true });
	if (!user?.email) {
		return new Response(
			JSON.stringify({ success: false, error: "Sign in required." }),
			{ status: 401, headers: { "Content-Type": "application/json" } },
		);
	}
	if (user.emailVerified) {
		clearUserCache(user.uid);
		return new Response(
			JSON.stringify({
				success: true,
				alreadyVerified: true,
				emailVerified: true,
			}),
			{ status: 200, headers: { "Content-Type": "application/json" } },
		);
	}

	const origin = new URL(request.url).origin;
	const continueUrl = `${origin}/search?mode=ai`;

	try {
		const customToken = await getAuth(app).createCustomToken(user.uid);
		const sent = await sendFirebaseVerificationEmail({
			customToken,
			continueUrl,
		});
		if (!sent.ok) {
			console.warn("resend-verification send failed:", sent.code, sent.message);
			const rateLimited = /TOO_MANY/i.test(sent.code);
			return new Response(
				JSON.stringify({
					success: false,
					error: sent.message,
					code: sent.code,
				}),
				{
					status: rateLimited ? 429 : 400,
					headers: { "Content-Type": "application/json" },
				},
			);
		}
		return new Response(
			JSON.stringify({
				success: true,
				email: user.email,
				emailVerified: false,
			}),
			{ status: 200, headers: { "Content-Type": "application/json" } },
		);
	} catch (error: unknown) {
		console.error("resend-verification failed:", error);
		const raw =
			error && typeof error === "object" && "message" in error
				? String((error as { message?: unknown }).message)
				: "SEND_FAILED";
		const code =
			error && typeof error === "object" && "code" in error
				? String((error as { code?: unknown }).code)
				: raw;
		return new Response(
			JSON.stringify({
				success: false,
				error: humanizeFirebaseAuthError(code, raw),
				code,
			}),
			{ status: 500, headers: { "Content-Type": "application/json" } },
		);
	}
};
